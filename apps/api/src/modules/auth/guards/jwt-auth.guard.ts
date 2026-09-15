import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { bindTenantToContext, bindUserToContext } from '../../../common/context/request-context';
import { DomainError } from '../../../common/errors/domain-error';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../../../common/security/decorators';
import { TokenService } from '../token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets) ?? false;
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.tokens.extractBearerToken(request.header('authorization'));
    if (!token) {
      if (optional) return true;
      throw DomainError.unauthenticated();
    }

    const claims = this.tokens.verifyAccessToken(token);
    request.principal = {
      userId: claims.sub,
      email: claims.email,
      isPlatformAdmin: claims.isPlatformAdmin,
      tenantId: claims.tenantId,
      role: claims.role,
      sessionId: claims.sessionId,
    };

    bindUserToContext(claims.sub);
    bindTenantToContext(claims.tenantId ?? undefined);
    return true;
  }
}
