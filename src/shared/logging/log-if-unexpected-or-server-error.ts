import { HttpException } from '@nestjs/common';

type ErrorLogger = {
  error: (message: any, stack?: string, ...optionalParams: any[]) => any;
};

export const logIfUnexpectedOrServerError = (
  logger: ErrorLogger,
  error: unknown,
): void => {
  if (error instanceof HttpException && error.getStatus() < 500) return;

  if (error instanceof Error) {
    logger.error(error.message, error.stack);
    return;
  }

  if (typeof error === 'string') {
    logger.error(error);
    return;
  }

  logger.error('Unexpected error');
};
