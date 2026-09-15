import { Injectable } from '@nestjs/common';
import { AssuranceLevel, SessionStatus, UserStatus } from '@prisma/client';
import type {
  AssuranceLevel as ContractAssuranceLevel,
  AuthenticationMethod,
  Role,
  Session,
} from '@zion8/contracts';
import { MembershipStatus } from '@prisma/client';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TenantService } from '../tenancy/tenant.service';
import { TokenService } from './token.service';

export interface RequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateSessionInput {
  userId: string;
  tenantId: string | null;
  role: Role | null;
  email: string | null;
  phone: string | null;
  isPlatformAdmin: boolean;
  assuranceLevel: ContractAssuranceLevel;
  methods: AuthenticationMethod[];
  meta: RequestMetadata;
  deviceName?: string | null;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly tenants: TenantService,
  ) {}

  async createSession(input: CreateSessionInput): Promise<Session> {
    const sessionId = this.tokens.newSessionId();
    const expiresAt = this.tokens.refreshExpiry();
    const refresh = this.tokens.issueRefreshToken(sessionId);
    const now = new Date();

    await this.prisma.withScope(
      { tenantId: input.tenantId, userId: input.userId, isPlatformAdmin: true },
      async (tx) => {
        await tx.authSession.create({
          data: {
            id: sessionId,
            userId: input.userId,
            tenantId: input.tenantId,
            status: SessionStatus.ACTIVE,
            assuranceLevel: input.assuranceLevel as AssuranceLevel,
            deviceName: input.deviceName ?? null,
            userAgent: input.meta.userAgent ?? null,
            ipAddress: input.meta.ipAddress ?? null,
            mfaSatisfiedAt: input.assuranceLevel === 'AAL1' ? null : now,
            createdAt: now,
            lastSeenAt: now,
            lastAuthenticatedAt: now,
            expiresAt,
          },
        });

        await tx.refreshToken.create({
          data: {
            userId: input.userId,
            sessionId,
            tenantId: input.tenantId,
            tokenHash: refresh.tokenHash,
            expiresAt: refresh.expiresAt,
            userAgent: input.meta.userAgent ?? null,
            ipAddress: input.meta.ipAddress ?? null,
          },
        });
      },
    );

    const access = this.tokens.signAccessToken({
      userId: input.userId,
      email: input.email,
      phone: input.phone,
      isPlatformAdmin: input.isPlatformAdmin,
      tenantId: input.tenantId,
      role: input.role,
      sessionId,
      assuranceLevel: input.assuranceLevel,
      methods: input.methods,
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      refreshExpiresIn: this.tokens.ttlSeconds(),
      sessionId,
      assuranceLevel: input.assuranceLevel,
      mfaSatisfied: input.assuranceLevel !== 'AAL1',
    };
  }

  async rotateRefresh(
    input: { refreshToken: string; tenantSlug?: string },
    meta: RequestMetadata,
  ): Promise<Session> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.refreshToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          tenantId: true,
          sessionId: true,
          expiresAt: true,
          revokedAt: true,
          session: {
            select: { status: true, assuranceLevel: true, expiresAt: true },
          },
        },
      }),
    );

    if (!record) {
      throw DomainError.unauthenticated('Refresh token is not recognized');
    }

    if (record.revokedAt || record.session.status !== SessionStatus.ACTIVE) {
      await this.revokeSession(record.sessionId, record.userId, 'refresh_reuse_detected');
      throw DomainError.tokenRevoked('Session was already rotated. Please sign in again.');
    }

    if (record.expiresAt.getTime() <= Date.now() || record.session.expiresAt.getTime() <= Date.now()) {
      await this.revokeSession(record.sessionId, record.userId, 'expired');
      throw DomainError.tokenExpired();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, email: true, phone: true, status: true, isPlatformAdmin: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.revokeSession(record.sessionId, record.userId, 'account_inactive');
      throw DomainError.forbidden('Your account is not active.');
    }

    let tenantId = record.tenantId;
    let role = await this.resolveRole(record.userId, tenantId);

    if (input.tenantSlug) {
      const tenant = await this.tenants.requireActiveTenant(input.tenantSlug);
      const membership = await this.tenants.findActiveMembership(record.userId, tenant.id);
      if (!membership || membership.status !== MembershipStatus.ACTIVE) {
        throw DomainError.membershipRequired();
      }
      tenantId = tenant.id;
      role = membership.role as Role;
    } else if (tenantId && !role) {
      await this.revokeSession(record.sessionId, record.userId, 'membership_revoked');
      throw DomainError.membershipRequired();
    }

    const issued = this.tokens.issueRefreshToken(record.sessionId);

    const rotated = await this.prisma.withScope(
      { tenantId, userId: record.userId, isPlatformAdmin: true },
      async (tx) => {
        const reclaimed = await tx.refreshToken.updateMany({
          where: { id: record.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (reclaimed.count === 0) return null;

        const replacement = await tx.refreshToken.create({
          data: {
            userId: record.userId,
            sessionId: record.sessionId,
            tenantId,
            tokenHash: issued.tokenHash,
            expiresAt: issued.expiresAt,
            userAgent: meta.userAgent ?? null,
            ipAddress: meta.ipAddress ?? null,
          },
          select: { id: true },
        });

        await tx.refreshToken.update({
          where: { id: record.id },
          data: { replacedByTokenId: replacement.id },
        });

        await tx.authSession.update({
          where: { id: record.sessionId },
          data: { lastSeenAt: new Date(), tenantId },
        });

        return replacement.id;
      },
    );

    if (!rotated) {
      await this.revokeSession(record.sessionId, record.userId, 'concurrent_rotation');
      throw DomainError.tokenRevoked('Concurrent session rotation detected. Please sign in again.');
    }

    const access = this.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      isPlatformAdmin: user.isPlatformAdmin,
      tenantId,
      role,
      sessionId: record.sessionId,
      assuranceLevel: record.session.assuranceLevel as ContractAssuranceLevel,
      methods: ['REFRESH'],
    });

    return {
      accessToken: access.token,
      refreshToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      refreshExpiresIn: this.tokens.ttlSeconds(),
      sessionId: record.sessionId,
      assuranceLevel: record.session.assuranceLevel as ContractAssuranceLevel,
      mfaSatisfied: record.session.assuranceLevel !== 'AAL1',
    };
  }

  async revokeByRefreshToken(refreshToken: string, reason = 'logout'): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const record = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.refreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true, sessionId: true },
      }),
    );
    if (!record) return;
    await this.revokeSession(record.sessionId, record.userId, reason);
  }

  async revokeSession(sessionId: string, userId: string, reason: string): Promise<void> {
    await this.prisma.withScope({ userId, isPlatformAdmin: true }, async (tx) => {
      await tx.authSession.updateMany({
        where: { id: sessionId, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokedReason: reason },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<void> {
    await this.prisma.withScope({ userId, isPlatformAdmin: true }, async (tx) => {
      await tx.authSession.updateMany({
        where: {
          userId,
          status: SessionStatus.ACTIVE,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
        },
        data: { status: SessionStatus.REVOKED, revokedAt: new Date(), revokedReason: reason },
      });
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
        },
        data: { revokedAt: new Date() },
      });
    });
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.authSession.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        take: 50,
      }),
    );

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      status: session.status,
      assuranceLevel: session.assuranceLevel as ContractAssuranceLevel,
      current: session.id === currentSessionId,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      lastAuthenticatedAt: session.lastAuthenticatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
    }));
  }

  async assertSessionActive(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.authSession.findUnique({
        where: { id: sessionId },
        select: { status: true, expiresAt: true, userId: true },
      }),
    );
    if (!session || session.userId !== userId) {
      throw DomainError.unauthenticated('Session no longer exists');
    }
    if (session.status !== SessionStatus.ACTIVE || session.expiresAt.getTime() <= Date.now()) {
      throw DomainError.tokenRevoked('Session has been revoked');
    }
  }

  private async resolveRole(userId: string, tenantId: string | null): Promise<Role | null> {
    if (!tenantId) return null;
    const membership = await this.tenants.findActiveMembership(userId, tenantId);
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return null;
    return membership.role as Role;
  }
}
