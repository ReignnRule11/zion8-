import type { Request } from 'express';
import type { RequestMetadata } from './session.service';

export function requestMetadata(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
  };
}
