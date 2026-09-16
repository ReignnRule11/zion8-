import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ErrorCode, type ApiError, type FieldIssue } from '@zion8/contracts';
import type { Response } from 'express';
import { AppLogger } from '../logger/app-logger.service';
import { currentRequestId } from '../context/request-context';
import { isDomainError } from './domain-error';

const HTTP_STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.RESOURCE_NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.RESOURCE_CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

function extractHttpDetails(response: string | object): FieldIssue[] | undefined {
  if (typeof response !== 'object' || response === null) return undefined;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message.map((entry) => ({ path: '', message: String(entry) }));
  }
  return undefined;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // Only the HTTP surface writes an envelope here. GraphQL carries errors in
    // the response body next to the data, so the original error is rethrown and
    // normalized by the driver's `formatError` instead.
    if (host.getType<'http' | 'graphql' | 'rpc' | 'ws'>() !== 'http') {
      throw exception;
    }

    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const requestId = currentRequestId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: FieldIssue[] | undefined;

    if (isDomainError(exception)) {
      status = exception.httpStatus;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HTTP_STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (((body as { message?: string }).message as string) ?? exception.message);
      details = extractHttpDetails(body);
      if (Array.isArray(message)) {
        details = (message as unknown as string[]).map((entry) => ({ path: '', message: entry }));
        message = 'Request validation failed';
      }
    }

    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    if (isServerError) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
      );
    } else {
      this.logger.warn(`${code} ${message}`, 'GlobalExceptionFilter');
    }

    const payload: ApiError = {
      error: {
        code,
        message,
        details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(status).json(payload);
  }
}
