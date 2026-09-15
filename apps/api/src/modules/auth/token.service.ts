import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AccessTokenClaims, Role } from '@zion8/contracts';
import { AppConfigService } from '../../common/config/app-config.service';
import { DomainError } from '../../common/errors/domain-error';

const JWT_ISSUER = 'zion8';
const JWT_AUDIENCE = 'zion8-api';

export interface AccessTokenInput {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  role: Role | null;
  sessionId: string;
}

export interface IssuedRefreshToken {
  token: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(private readonly config: AppConfigService) {}

  newSessionId(): string {
    return randomUUID();
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  issueRefreshToken(sessionId?: string): IssuedRefreshToken {
    const familyId = sessionId ?? randomUUID();
    const token = randomBytes(48).toString('base64url');
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      familyId,
      expiresAt: this.refreshExpiry(),
    };
  }

  refreshExpiry(): Date {
    return new Date(Date.now() + this.config.refreshTtlSeconds * 1000);
  }

  ttlSeconds(): number {
    return this.config.refreshTtlSeconds;
  }

  signAccessToken(input: AccessTokenInput): { token: string; expiresIn: number } {
    const expiresIn = this.config.jwtAccessTtlSeconds;
    const token = jwt.sign(
      {
        email: input.email,
        isPlatformAdmin: input.isPlatformAdmin,
        tenantId: input.tenantId,
        role: input.role,
        sessionId: input.sessionId,
      },
      this.config.jwtAccessSecret,
      {
        algorithm: 'HS256',
        expiresIn,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        subject: input.userId,
      },
    );
    return { token, expiresIn };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      const payload = jwt.verify(token, this.config.jwtAccessSecret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (typeof payload === 'string') {
        throw DomainError.unauthenticated('Malformed access token');
      }
      const { sub, email, isPlatformAdmin, tenantId, role, sessionId, iat, exp } =
        payload as Record<string, unknown>;
      if (
        typeof sub !== 'string' ||
        typeof email !== 'string' ||
        typeof sessionId !== 'string' ||
        typeof iat !== 'number' ||
        typeof exp !== 'number'
      ) {
        throw DomainError.unauthenticated('Malformed access token');
      }
      return {
        sub,
        email,
        isPlatformAdmin: Boolean(isPlatformAdmin),
        tenantId: typeof tenantId === 'string' ? tenantId : null,
        role: (role as Role | null) ?? null,
        sessionId,
        iat,
        exp,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw DomainError.tokenExpired();
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw DomainError.unauthenticated('Invalid access token');
      }
      throw error;
    }
  }

  safeEqualHex(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
    return token.length > 0 ? token : null;
  }
}
