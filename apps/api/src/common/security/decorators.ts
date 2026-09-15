import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission, Role } from '@zion8/contracts';
import type { Request } from 'express';
import { DomainError } from '../errors/domain-error';
import type { AuthenticatedPrincipal } from './principal';

export const IS_PUBLIC_KEY = 'zion8:isPublic';
export const OPTIONAL_AUTH_KEY = 'zion8:optionalAuth';
export const PERMISSIONS_KEY = 'zion8:permissions';
export const ROLES_KEY = 'zion8:roles';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const OptionalAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(OPTIONAL_AUTH_KEY, true);

export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireRoles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.principal) {
      throw DomainError.unauthenticated();
    }
    return request.principal;
  },
);

export const OptionalPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.principal;
  },
);
