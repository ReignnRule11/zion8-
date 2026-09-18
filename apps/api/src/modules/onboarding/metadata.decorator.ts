import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { requestMetadata } from '../auth/request-metadata';
import type { RequestMetadata } from '../auth/session.service';

/**
 * Injects the caller's network context (IP and user agent) so audit records
 * capture where an action came from without every handler reaching into the
 * raw request.
 */
export const Metadata = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestMetadata => {
    const request = context.switchToHttp().getRequest<Request>();
    return requestMetadata(request);
  },
);
