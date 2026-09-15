import { Injectable } from '@nestjs/common';
import { MembershipStatus, Prisma, UserStatus } from '@prisma/client';
import {
  Role,
  permissionsForRole,
  type MeResponse,
  type RegisterChurchRequest,
  type Session,
} from '@zion8/contracts';
import { AppLogger } from '../../common/logger/app-logger.service';
import { bindTenantToContext, bindUserToContext } from '../../common/context/request-context';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { TenantService } from '../tenancy/tenant.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface RequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface RefreshRecord {
  id: string;
  userId: string;
  tenantId: string | null;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_SECONDS = 300;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly tenants: TenantService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async registerChurch(input: RegisterChurchRequest, meta: RequestMetadata): Promise<Session> {
    const passwordHash = await this.passwords.hash(input.owner.password);

    try {
      const created = await this.prisma.withScope({ isPlatformAdmin: true }, async (tx) => {
        const slugTaken = await tx.tenant.findUnique({
          where: { slug: input.church.slug },
          select: { id: true },
        });
        if (slugTaken) throw DomainError.tenantSlugTaken();

        const emailTaken = await tx.user.findUnique({
          where: { email: input.owner.email },
          select: { id: true },
        });
        if (emailTaken) throw DomainError.emailRegistered();

        const user = await tx.user.create({
          data: {
            email: input.owner.email,
            passwordHash,
            firstName: input.owner.firstName,
            lastName: input.owner.lastName,
            status: UserStatus.ACTIVE,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isPlatformAdmin: true,
          },
        });

        const tenant = await tx.tenant.create({
          data: {
            name: input.church.name,
            slug: input.church.slug,
            timezone: input.church.timezone,
            locale: input.church.locale,
          },
          select: { id: true, slug: true, name: true, status: true, createdAt: true },
        });

        await tx.membership.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: Role.CHURCH_OWNER,
            status: MembershipStatus.ACTIVE,
          },
        });

        await this.audit.record(
          {
            tenantId: tenant.id,
            actorUserId: user.id,
            action: 'church.registered',
            resourceType: 'tenant',
            resourceId: tenant.id,
            metadata: { slug: tenant.slug },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
          tx,
        );

        return { user, tenant };
      });

      this.logger.log(`Registered church workspace ${created.tenant.slug}`, 'AuthService');

      return this.issueSession({
        userId: created.user.id,
        email: created.user.email,
        isPlatformAdmin: created.user.isPlatformAdmin,
        tenantId: created.tenant.id,
        role: Role.CHURCH_OWNER,
        meta,
      });
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async login(
    input: { email: string; password: string; tenantSlug?: string },
    meta: RequestMetadata,
  ): Promise<Session> {
    await this.enforceLoginRateLimit(input.email, meta.ipAddress);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        isPlatformAdmin: true,
      },
    });

    if (!user) {
      await this.passwords.verifyAgainstDummy(input.password);
      await this.audit.record({
        action: 'auth.login_failed',
        resourceType: 'user',
        metadata: { email: input.email, reason: 'unknown_account' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw DomainError.invalidCredentials();
    }

    const passwordValid = await this.passwords.verify(user.passwordHash, input.password);
    if (!passwordValid) {
      await this.audit.record({
        tenantId: null,
        actorUserId: user.id,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { reason: 'invalid_password' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw DomainError.invalidCredentials();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw DomainError.forbidden('Your account is not active. Please contact your administrator.');
    }

    const resolution = await this.tenants.resolveTenantForLogin(user.id, input.tenantSlug);

    if (input.tenantSlug && resolution.tenantId === null) {
      throw DomainError.membershipRequired();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      tenantId: resolution.tenantId,
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { tenantId: resolution.tenantId, role: resolution.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await this.redis.delete(this.loginAttemptKey(input.email, meta.ipAddress));

    return this.issueSession({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      tenantId: resolution.tenantId,
      role: resolution.role,
      meta,
    });
  }

  async refresh(
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
          familyId: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
    );

    if (!record) {
      throw DomainError.unauthenticated('Refresh token is not recognized');
    }

    if (record.revokedAt) {
      await this.revokeFamily(record.familyId, record.userId);
      await this.audit.record({
        tenantId: record.tenantId,
        actorUserId: record.userId,
        action: 'auth.refresh_reuse_detected',
        resourceType: 'session',
        resourceId: record.familyId,
        metadata: { familyId: record.familyId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw DomainError.tokenRevoked('Session was already rotated. Please sign in again.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw DomainError.tokenExpired();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: {
        id: true,
        email: true,
        status: true,
        isPlatformAdmin: true,
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.revokeFamily(record.familyId, record.userId);
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
    } else if (tenantId) {
      if (!role) {
        await this.revokeFamily(record.familyId, record.userId);
        throw DomainError.membershipRequired();
      }
    }

    const issued = this.tokens.issueRefreshToken(record.familyId);

    const rotated = await this.prisma.withScope({ tenantId, userId: record.userId }, async (tx) => {
      const reclaimed = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (reclaimed.count === 0) return null;

      const replacement = await tx.refreshToken.create({
        data: {
          userId: record.userId,
          tenantId,
          familyId: issued.familyId,
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

      return replacement.id;
    });

    if (!rotated) {
      await this.revokeFamily(record.familyId, record.userId);
      throw DomainError.tokenRevoked('Concurrent session rotation detected. Please sign in again.');
    }

    const access = this.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      tenantId,
      role,
      sessionId: issued.familyId,
    });

    return {
      accessToken: access.token,
      refreshToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      refreshExpiresIn: this.tokens.ttlSeconds(),
    };
  }

  async logout(input: { refreshToken: string }, meta: RequestMetadata): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.refreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true, tenantId: true, familyId: true },
      }),
    );
    if (!record) return;

    await this.revokeFamily(record.familyId, record.userId);
    await this.audit.record({
      tenantId: record.tenantId,
      actorUserId: record.userId,
      action: 'auth.logged_out',
      resourceType: 'session',
      resourceId: record.familyId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async switchTenant(
    input: { tenantId: string; refreshToken: string },
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
          familyId: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
    );

    if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
      throw DomainError.tokenRevoked('Session is no longer valid. Please sign in again.');
    }

    const membership = await this.tenants.findActiveMembership(record.userId, input.tenantId);
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw DomainError.membershipRequired();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, email: true, status: true, isPlatformAdmin: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw DomainError.forbidden('Your account is not active.');
    }

    await this.prisma.withScope({ tenantId: record.tenantId, userId: record.userId }, (tx) =>
      tx.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );

    await this.audit.record({
      tenantId: input.tenantId,
      actorUserId: user.id,
      action: 'auth.tenant_switched',
      resourceType: 'membership',
      resourceId: membership.id,
      metadata: { fromTenantId: record.tenantId, toTenantId: input.tenantId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.issueSession({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      tenantId: input.tenantId,
      role: membership.role as Role,
      meta,
    });
  }

  async me(userId: string, tenantId: string | null): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isPlatformAdmin: true,
      },
    });
    if (!user) throw DomainError.unauthenticated('Account no longer exists');

    const memberships = await this.tenants.listMembershipsForUser(userId);
    const activeMembership = tenantId
      ? (memberships.find((membership) => membership.tenantId === tenantId) ?? null)
      : null;

    if (tenantId && !activeMembership) {
      throw DomainError.membershipRequired();
    }

    const role = activeMembership?.role ?? null;

    return {
      principal: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      activeTenant: activeMembership
        ? {
            id: activeMembership.tenantId,
            slug: activeMembership.tenantSlug,
            name: activeMembership.tenantName,
            status: 'ACTIVE',
            createdAt: activeMembership.createdAt.toISOString(),
          }
        : null,
      role,
      permissions: role ? permissionsForRole(role) : [],
      memberships: memberships.map((membership) => ({
        tenantId: membership.tenantId,
        tenantName: membership.tenantName,
        tenantSlug: membership.tenantSlug,
        role: membership.role,
        status: membership.status,
      })),
    };
  }

  private async issueSession(input: {
    userId: string;
    email: string;
    isPlatformAdmin: boolean;
    tenantId: string | null;
    role: Role | null;
    meta: RequestMetadata;
  }): Promise<Session> {
    bindUserToContext(input.userId);
    bindTenantToContext(input.tenantId ?? undefined);

    const issued = this.tokens.issueRefreshToken();

    await this.prisma.withScope({ tenantId: input.tenantId, userId: input.userId }, (tx) =>
      tx.refreshToken.create({
        data: {
          userId: input.userId,
          tenantId: input.tenantId,
          familyId: issued.familyId,
          tokenHash: issued.tokenHash,
          expiresAt: issued.expiresAt,
          userAgent: input.meta.userAgent ?? null,
          ipAddress: input.meta.ipAddress ?? null,
        },
      }),
    );

    const access = this.tokens.signAccessToken({
      userId: input.userId,
      email: input.email,
      isPlatformAdmin: input.isPlatformAdmin,
      tenantId: input.tenantId,
      role: input.role,
      sessionId: issued.familyId,
    });

    return {
      accessToken: access.token,
      refreshToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      refreshExpiresIn: this.tokens.ttlSeconds(),
    };
  }

  private async resolveRole(userId: string, tenantId: string | null): Promise<Role | null> {
    if (!tenantId) return null;
    const membership = await this.tenants.findActiveMembership(userId, tenantId);
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return null;
    return membership.role as Role;
  }

  private async revokeFamily(familyId: string, userId: string): Promise<void> {
    await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  private loginAttemptKey(email: string, ipAddress?: string | null): string {
    return `auth:login-attempt:${ipAddress ?? 'unknown'}:${email}`;
  }

  private async enforceLoginRateLimit(email: string, ipAddress?: string | null): Promise<void> {
    const attempts = await this.redis.incrementWithTtl(
      this.loginAttemptKey(email, ipAddress),
      LOGIN_ATTEMPT_WINDOW_SECONDS,
    );
    if (attempts > LOGIN_ATTEMPT_LIMIT) {
      throw DomainError.rateLimited('Too many sign-in attempts. Please try again later.');
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target : [];
      if (target.includes('slug')) return DomainError.tenantSlugTaken();
      if (target.includes('email')) return DomainError.emailRegistered();
      return DomainError.conflict();
    }
    return error;
  }
}
