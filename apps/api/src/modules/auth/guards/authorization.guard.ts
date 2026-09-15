import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Permission, type Role, roleHasPermission } from '@zion8/contracts';
import { DomainError } from '../../../common/errors/domain-error';
import {
  IS_PUBLIC_KEY,
  OPTIONAL_AUTH_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets) ?? [];
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets) ?? [];
    if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.principal;
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets) ?? false;

    if (!principal) {
      if (optional) return true;
      throw DomainError.unauthenticated();
    }

    if (principal.isPlatformAdmin) {
      return true;
    }

    if (!principal.role) {
      throw DomainError.forbidden('An active church workspace role is required');
    }

    this.assertTenantContext(principal);

    if (requiredRoles.length > 0 && !requiredRoles.includes(principal.role)) {
      throw DomainError.forbidden('Your role does not permit this action');
    }

    const missing = requiredPermissions.filter(
      (permission) => !roleHasPermission(principal.role as Role, permission),
    );
    if (missing.length > 0) {
      throw DomainError.forbidden(`Missing required permission(s): ${missing.join(', ')}`);
    }

    return true;
  }

  private assertTenantContext(principal: AuthenticatedPrincipal): void {
    if (!principal.tenantId) {
      throw DomainError.tenantRequired();
    }
  }
}
