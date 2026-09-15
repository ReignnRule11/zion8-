import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { bindTenantToContext, bindUserToContext } from '../../../common/context/request-context';
import { DomainError } from '../../../common/errors/domain-error';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../../../common/security/decorators';
import { SessionService } from '../session.service';
import { TokenService } from '../token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    // A signed access token is only as trustworthy as the session behind it.
    // Revocation and expiry are enforced on every request so logging out, or a
    // revoked device, takes effect immediately rather than at token expiry.
    await this.sessions.assertSessionActive(claims.sessionId, claims.sub);

    request.principal = {
      userId: claims.sub,
      email: claims.email,
      phone: claims.phone,
      isPlatformAdmin: claims.isPlatformAdmin,
      tenantId: claims.tenantId,
      role: claims.role,
      sessionId: claims.sessionId,
      assuranceLevel: claims.aal,
      methods: claims.amr,
    };

    bindUserToContext(claims.sub);
    bindTenantToContext(claims.tenantId ?? undefined);
    return true;
  }
}
