import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JsonApiContentTypeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { method?: string; headers?: any }>();
    const res = http.getResponse<any>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) {
      res?.setHeader?.('Content-Type', 'application/vnd.api+json');
    }

    const method = (req?.method || '').toUpperCase();
    if (
      !isPublic &&
      (method === 'POST' || method === 'PATCH' || method === 'PUT')
    ) {
      const contentType = String(req?.headers?.['content-type'] || '');
      if (!contentType.startsWith('application/vnd.api+json')) {
        throw new UnsupportedMediaTypeException(
          'Content-Type must be application/vnd.api+json',
        );
      }
    }

    return next.handle();
  }
}
