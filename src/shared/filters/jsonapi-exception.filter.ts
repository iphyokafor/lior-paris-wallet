import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

type NestHttpExceptionResponse =
  | string
  | {
      message?: string | string[];
      error?: string;
      statusCode?: number;
      issues?: Array<{
        path?: Array<string | number>;
        message: string;
        code?: string;
        keys?: string[];
      }>;
    };

type JsonApiErrorObject = {
  status: string;
  title: string;
  detail?: string;
  code?: string;
  source?: {
    pointer?: string;
  };
};

const toPointerFromPath = (path?: Array<string | number>) => {
  if (!path || path.length === 0) return undefined;
  const pathStr = path.map(String).join('/');
  return `/data/attributes/${pathStr}`;
};

const errorsFromZodIssues = (
  status: number,
  title: string,
  issues: NonNullable<Exclude<NestHttpExceptionResponse, string>['issues']>,
): JsonApiErrorObject[] => {
  const errors: JsonApiErrorObject[] = [];

  for (const issue of issues) {
    if (issue?.code === 'unrecognized_keys' && Array.isArray(issue?.keys)) {
      for (const key of issue.keys) {
        errors.push({
          status: String(status),
          title,
          code: 'VALIDATION_ERROR',
          detail: `Unrecognized field: ${key}`,
          source: { pointer: `/data/attributes/${key}` },
        });
      }
      continue;
    }

    const pointer = toPointerFromPath(issue?.path);
    errors.push({
      status: String(status),
      title,
      code: 'VALIDATION_ERROR',
      detail: issue?.message,
      ...(pointer ? { source: { pointer } } : {}),
    });
  }

  return errors;
};

const normalizeMessages = (msg?: string | string[]) => {
  if (!msg) return [];
  if (Array.isArray(msg)) return msg;
  return [msg];
};

const errorsFromMessages = (
  status: number,
  title: string,
  messages: string[],
): JsonApiErrorObject[] => {
  const errors: JsonApiErrorObject[] = [];
  for (const message of messages) {
    const text = String(message);
    const maybeField = text.split(' ')[0];
    const pointer = maybeField ? `/data/attributes/${maybeField}` : undefined;

    errors.push({
      status: String(status),
      title,
      code: status === 400 ? 'VALIDATION_ERROR' : undefined,
      detail: text,
      ...(pointer ? { source: { pointer } } : {}),
    });
  }
  return errors;
};

const errorsFromHttpResponse = (
  status: number,
  title: string,
  res: NestHttpExceptionResponse,
): JsonApiErrorObject[] => {
  if (typeof res === 'string') {
    return [{ status: String(status), title, detail: res }];
  }

  if (Array.isArray(res?.issues) && res.issues.length > 0) {
    return errorsFromZodIssues(status, title, res.issues);
  }

  const messages = normalizeMessages(res?.message);
  if (messages.length > 0) {
    return errorsFromMessages(status, title, messages);
  }

  return [{ status: String(status), title, detail: res?.error }];
};

@Catch()
export class JsonApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();

    const httpException = exception instanceof HttpException ? exception : null;
    const status = httpException
      ? httpException.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const title = httpException ? httpException.name : 'InternalServerError';

    let errors: JsonApiErrorObject[];
    if (httpException) {
      errors = errorsFromHttpResponse(
        status,
        title,
        httpException.getResponse() as NestHttpExceptionResponse,
      );
    } else if (exception && typeof exception === 'object') {
      errors = [
        {
          status: String(status),
          title,
          detail: (exception as any).message,
        },
      ];
    } else {
      errors = [{ status: String(status), title }];
    }

    response.setHeader('Content-Type', 'application/vnd.api+json');
    response.status(status).json({
      errors,
    });
  }
}
