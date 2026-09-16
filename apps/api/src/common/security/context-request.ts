import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Resolve the underlying Express request for either transport.
 *
 * The same authentication and authorization guards protect REST controllers and
 * GraphQL resolvers. GraphQL does not run on `switchToHttp`, so the request is
 * read from the GraphQL context arguments instead. Keeping this in one helper
 * means the guards are written once and behave identically on both surfaces.
 */
export function requestFromContext(context: ExecutionContext): Request | undefined {
  if (context.getType<'http' | 'graphql'>() === 'graphql') {
    const args = context.getArgs<[unknown, unknown, { req?: Request }?]>();
    return args?.[2]?.req;
  }
  return context.switchToHttp().getRequest<Request | undefined>();
}
