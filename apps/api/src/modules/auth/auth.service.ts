import { Injectable } from '@nestjs/common';
import { ChallengePurpose, IdentityProvider, MembershipStatus, UserStatus } from '@prisma/client';
import {
  Role,
  permissionsForRole,
  type AuthenticationMethod,
  type LoginResult,
  type MeResponse,
  type RegisterChurchRequest,
  type Session,
} from '@zion8/contracts';
import { bindTenantToContext, bindUserToContext } from '../../common/context/request-context';
import { DomainError } from '../../common/errors/domain-error';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { TenantService } from '../tenancy/tenant.service';
import { AuthMailerService } from './auth-mailer.service';
import { IdentityService, type LoginUser } from './identity.service';
import { MfaService } from './mfa.service';
import { OAuthService } from './oauth.service';
import { PasswordService } from './password.service';
import { SessionService, type RequestMetadata } from './session.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';
import { WebAuthnService } from './webauthn.service';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_SECONDS = 300;

export type { RequestMetadata } from './session.service';

interface SessionPriming {
  satisfiesMfa: boolean;
  assuranceLevel: 'AAL1' | 'AAL2' | 'AAL3';
  methods: AuthenticationMethod[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly identities: IdentityService,
    private readonly verification: VerificationService,
    private readonly mfa: MfaService,
    private readonly webauthn: WebAuthnService,
    private readonly oauth: OAuthService,
    private readonly mailer: AuthMailerService,
    private readonly tenants: TenantService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async registerChurch(input: RegisterChurchRequest, meta: RequestMetadata): Promise<Session> {
    const passwordHash = await this.passwords.hash(input.owner.password);

    let userId: string;
    try {
      userId = await this.prisma.withScope({ isPlatformAdmin: true }, async (tx) => {
        const slugTaken = await tx.tenant.findUnique({
          where: { slug: input.church.slug },
          select: { id: true },
        });
        if (slugTaken) throw DomainError.tenantSlugTaken();

        const emailTaken = await tx.userIdentity.findUnique({
          where: {
            provider_providerAccountId: {
              provider: IdentityProvider.EMAIL,
              providerAccountId: input.owner.email,
            },
          },
          select: { id: true },
        });
        if (emailTaken) throw DomainError.emailRegistered();

        const user = await tx.user.create({
          data: {
            email: input.owner.email,
            firstName: input.owner.firstName,
            lastName: input.owner.lastName,
            status: UserStatus.ACTIVE,
          },
          select: { id: true },
        });

        await tx.userIdentity.create({
          data: {
            userId: user.id,
            provider: IdentityProvider.EMAIL,
            providerAccountId: input.owner.email,
            email: input.owner.email,
            isPrimary: true,
          },
        });

        await tx.passwordCredential.create({
          data: { userId: user.id, passwordHash, algorithm: 'argon2id' },
        });

        const tenant = await this.tenants.createTenant(tx, {
          name: input.church.name,
          slug: input.church.slug,
          timezone: input.church.timezone,
          locale: input.church.locale,
        });

        await this.tenants.createMembership(tx, {
          tenantId: tenant.id,
          userId: user.id,
          role: Role.CHURCH_OWNER,
          status: MembershipStatus.ACTIVE,
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

        return user.id;
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (this.identities.isUniqueViolation(error, 'slug')) throw DomainError.tenantSlugTaken();
      if (this.identities.isUniqueViolation(error, 'email')) throw DomainError.emailRegistered();
      throw error;
    }

    this.logger.log(`Registered church workspace ${input.church.slug}`, 'AuthService');

    const { secret } = await this.verification.issue({
      purpose: ChallengePurpose.EMAIL_VERIFICATION,
      identifier: input.owner.email,
      secretKind: 'token',
      userId,
      metadata: { email: input.owner.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.mailer.sendEmailVerification({ to: input.owner.email, token: secret });

    const user = await this.requireUser(userId);
    await this.audit.record({
      action: 'auth.email_verification_sent',
      resourceType: 'user',
      resourceId: userId,
      metadata: { email: input.owner.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.sessionFor(user, {
      tenantSlug: input.church.slug,
      satisfiesMfa: true,
      assuranceLevel: 'AAL1',
      methods: ['PASSWORD'],
      meta,
    });
  }

  async login(input: { email?: string; phone?: string; password: string; tenantSlug?: string }, meta: RequestMetadata): Promise<LoginResult> {
    const identifier = input.email ?? input.phone ?? '';
    await this.enforceLoginRateLimit(identifier, meta.ipAddress);

    const user = await this.identities.resolveUser({ email: input.email, phone: input.phone });
    const passwordHash = user ? await this.identities.passwordHashFor(user.id) : null;

    if (!user || !passwordHash) {
      await this.passwords.verifyAgainstDummy(input.password);
      await this.audit.record({
        action: 'auth.login_failed',
        resourceType: 'user',
        metadata: { identifier, reason: 'unknown_identity' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw DomainError.invalidCredentials();
    }

    const valid = await this.passwords.verify(passwordHash, input.password);
    if (!valid) {
      await this.audit.record({
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

    await this.redis.delete(this.loginAttemptKey(identifier, meta.ipAddress));
    return this.establishSession(user, {
      tenantSlug: input.tenantSlug,
      satisfiesMfa: false,
      assuranceLevel: 'AAL1',
      methods: ['PASSWORD'],
      meta,
    });
  }

  async verifyMfaTotp(input: { mfaToken: string; code: string }, meta: RequestMetadata): Promise<Session> {
    const challenge = await this.mfa.readChallenge(input.mfaToken);
    const user = await this.requireUser(challenge.userId);
    await this.mfa.verifyTotpForUser(user.id, input.code);
    await this.mfa.completeChallenge(input.mfaToken);

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.mfa_succeeded',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { method: 'TOTP' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.sessionFor(user, {
      tenantSlug: challenge.tenantSlug,
      satisfiesMfa: true,
      assuranceLevel: 'AAL2',
      methods: [...challenge.methods, 'TOTP'],
      meta,
    });
  }

  async verifyMfaRecoveryCode(
    input: { mfaToken: string; recoveryCode: string },
    meta: RequestMetadata,
  ): Promise<Session> {
    const challenge = await this.mfa.readChallenge(input.mfaToken);
    const user = await this.requireUser(challenge.userId);
    await this.mfa.consumeRecoveryCode(user.id, input.recoveryCode);
    await this.mfa.completeChallenge(input.mfaToken);

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.mfa_succeeded',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { method: 'RECOVERY_CODE' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.sessionFor(user, {
      tenantSlug: challenge.tenantSlug,
      satisfiesMfa: true,
      assuranceLevel: 'AAL2',
      methods: [...challenge.methods, 'RECOVERY_CODE'],
      meta,
    });
  }

  async loginWithWebAuthn(
    input: { challengeId: string; response: AuthenticationResponseJSON },
    meta: RequestMetadata,
  ): Promise<LoginResult> {
    const { userId, tenantSlug } = await this.webauthn.finishAuthentication(input);
    const user = await this.requireUser(userId);

    if (user.status !== UserStatus.ACTIVE) {
      throw DomainError.forbidden('Your account is not active.');
    }

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { method: 'WEBAUTHN' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.sessionFor(user, {
      tenantSlug,
      satisfiesMfa: true,
      assuranceLevel: 'AAL3',
      methods: ['WEBAUTHN'],
      meta,
    });
  }

  async startOAuth(
    provider: 'GOOGLE' | 'APPLE' | 'MICROSOFT',
    input: { redirectPath?: string; tenantSlug?: string },
  ): Promise<{ authorizationUrl: string; state: string }> {
    return this.oauth.start(provider, input);
  }

  async loginWithOAuth(
    provider: 'GOOGLE' | 'APPLE' | 'MICROSOFT',
    input: { code: string; state: string },
    meta: RequestMetadata,
  ): Promise<LoginResult> {
    const profile = await this.oauth.resolveProfile(provider, input);
    const user = await this.requireUser(profile.userId);

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { method: 'OAUTH', provider },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.establishSession(user, {
      tenantSlug: profile.tenantSlug,
      satisfiesMfa: false,
      assuranceLevel: 'AAL1',
      methods: ['OAUTH'],
      meta,
    });
  }

  async requestMagicLink(input: { email: string; tenantSlug?: string }, meta: RequestMetadata): Promise<void> {
    const identity = await this.identities.findByEmail(input.email);
    const { secret } = await this.verification.issue({
      purpose: ChallengePurpose.MAGIC_LINK,
      identifier: input.email,
      secretKind: 'token',
      userId: identity?.userId ?? null,
      tenantId: null,
      metadata: { tenantSlug: input.tenantSlug },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (identity) {
      await this.mailer.sendMagicLink({ to: input.email, token: secret });
      await this.audit.record({
        actorUserId: identity.userId,
        action: 'auth.magic_link_sent',
        resourceType: 'user',
        resourceId: identity.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
  }

  async consumeMagicLink(input: { token: string; tenantSlug?: string }, meta: RequestMetadata): Promise<LoginResult> {
    const challenge = await this.verification.consumeByToken({
      purpose: ChallengePurpose.MAGIC_LINK,
      secret: input.token,
    });
    if (!challenge.userId) throw DomainError.invalidChallenge();

    const user = await this.requireUser(challenge.userId);
    const metadata = (challenge.metadata ?? {}) as { tenantSlug?: string };
    const tenantSlug = input.tenantSlug ?? metadata.tenantSlug;

    if (user.email && !user.emailVerifiedAt) {
      await this.identities.markContactVerified({
        userId: user.id,
        provider: IdentityProvider.EMAIL,
        identifier: user.email,
      });
    }

    return this.establishSession(user, {
      tenantSlug,
      satisfiesMfa: false,
      assuranceLevel: 'AAL1',
      methods: ['MAGIC_LINK'],
      meta,
    });
  }

  async requestOtp(input: { email?: string; phone?: string }, meta: RequestMetadata): Promise<void> {
    const identifier = input.email ?? input.phone;
    if (!identifier) throw DomainError.validation([{ path: 'email', message: 'Provide email or phone' }]);

    const purpose = input.email ? ChallengePurpose.EMAIL_OTP : ChallengePurpose.SMS_OTP;
    const identity = input.email
      ? await this.identities.findByEmail(input.email)
      : await this.identities.findByPhone(input.phone as string);

    const { secret } = await this.verification.issue({
      purpose,
      identifier,
      secretKind: 'otp',
      userId: identity?.userId ?? null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (identity) {
      if (input.email) {
        await this.mailer.sendEmailOtp({ to: input.email, code: secret });
      } else {
        await this.mailer.sendSmsOtp({ to: input.phone as string, code: secret });
      }
    }
  }

  async verifyOtp(input: { email?: string; phone?: string; code: string; tenantSlug?: string }, meta: RequestMetadata): Promise<LoginResult> {
    const identifier = input.email ?? input.phone;
    if (!identifier) throw DomainError.validation([{ path: 'email', message: 'Provide email or phone' }]);

    const purpose = input.email ? ChallengePurpose.EMAIL_OTP : ChallengePurpose.SMS_OTP;
    await this.verification.consume({ purpose, identifier, secret: input.code });

    const user = await this.identities.resolveUser({ email: input.email, phone: input.phone });
    if (!user) throw DomainError.invalidCredentials();

    if (input.email && !user.emailVerifiedAt) {
      await this.identities.markContactVerified({
        userId: user.id,
        provider: IdentityProvider.EMAIL,
        identifier,
      });
    }

    return this.establishSession(user, {
      tenantSlug: input.tenantSlug,
      satisfiesMfa: false,
      assuranceLevel: 'AAL1',
      methods: ['OTP'],
      meta,
    });
  }

  async requestEmailVerification(userId: string, meta: RequestMetadata): Promise<void> {
    const user = await this.requireUser(userId);
    if (!user.email) throw DomainError.validation([{ path: 'email', message: 'No email on file' }]);

    const { secret } = await this.verification.issue({
      purpose: ChallengePurpose.EMAIL_VERIFICATION,
      identifier: user.email,
      secretKind: 'token',
      userId,
      metadata: { email: user.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.mailer.sendEmailVerification({ to: user.email, token: secret });
  }

  async verifyEmail(input: { token: string }, meta: RequestMetadata): Promise<void> {
    const challenge = await this.verification.consumeByToken({
      purpose: ChallengePurpose.EMAIL_VERIFICATION,
      secret: input.token,
    });
    if (!challenge.userId) throw DomainError.invalidChallenge();

    await this.identities.markContactVerified({
      userId: challenge.userId,
      provider: IdentityProvider.EMAIL,
      identifier: challenge.identifier,
    });

    await this.audit.record({
      actorUserId: challenge.userId,
      action: 'auth.email_verified',
      resourceType: 'user',
      resourceId: challenge.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async requestPhoneVerification(userId: string, phone: string, meta: RequestMetadata): Promise<void> {
    const { secret } = await this.verification.issue({
      purpose: ChallengePurpose.PHONE_VERIFICATION,
      identifier: phone,
      secretKind: 'otp',
      userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.mailer.sendSmsOtp({ to: phone, code: secret });
  }

  async verifyPhone(input: { phone: string; code: string }, meta: RequestMetadata): Promise<void> {
    const challenge = await this.verification.consume({
      purpose: ChallengePurpose.PHONE_VERIFICATION,
      identifier: input.phone,
      secret: input.code,
    });
    if (!challenge.userId) throw DomainError.invalidChallenge();
    await this.identities.markContactVerified({
      userId: challenge.userId,
      provider: IdentityProvider.PHONE,
      identifier: input.phone,
    });
  }

  async requestPasswordReset(input: { email: string }, meta: RequestMetadata): Promise<void> {
    const identity = await this.identities.findByEmail(input.email);
    const { secret } = await this.verification.issue({
      purpose: ChallengePurpose.PASSWORD_RESET,
      identifier: input.email,
      secretKind: 'token',
      userId: identity?.userId ?? null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (identity) {
      await this.mailer.sendPasswordReset({ to: input.email, token: secret });
      await this.audit.record({
        actorUserId: identity.userId,
        action: 'auth.password_reset_requested',
        resourceType: 'user',
        resourceId: identity.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
  }

  async resetPassword(input: { token: string; newPassword: string }, meta: RequestMetadata): Promise<void> {
    const challenge = await this.verification.consumeByToken({
      purpose: ChallengePurpose.PASSWORD_RESET,
      secret: input.token,
    });
    if (!challenge.userId) throw DomainError.invalidChallenge();

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.identities.setPassword(challenge.userId, passwordHash);
    await this.sessions.revokeAllForUser(challenge.userId, 'password_reset');

    await this.audit.record({
      actorUserId: challenge.userId,
      action: 'auth.password_reset_completed',
      resourceType: 'user',
      resourceId: challenge.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: { currentPassword: string; newPassword: string },
    meta: RequestMetadata,
  ): Promise<void> {
    const currentHash = await this.identities.passwordHashFor(userId);
    if (!currentHash) throw DomainError.invalidCredentials();
    const valid = await this.passwords.verify(currentHash, input.currentPassword);
    if (!valid) throw DomainError.invalidCredentials('Current password is incorrect');

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.identities.setPassword(userId, passwordHash);
    await this.sessions.revokeAllForUser(userId, 'password_changed', sessionId);

    await this.audit.record({
      actorUserId: userId,
      action: 'auth.password_changed',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async refresh(input: { refreshToken: string; tenantSlug?: string }, meta: RequestMetadata): Promise<Session> {
    return this.sessions.rotateRefresh(input, meta);
  }

  async logout(input: { refreshToken: string }, meta: RequestMetadata): Promise<void> {
    await this.sessions.revokeByRefreshToken(input.refreshToken, 'logout');
    await this.audit.record({
      action: 'auth.logged_out',
      resourceType: 'session',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async switchTenant(input: { tenantId: string; refreshToken: string }, meta: RequestMetadata): Promise<Session> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const record = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.refreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true, sessionId: true },
      }),
    );
    if (!record) throw DomainError.tokenRevoked('Session is no longer valid. Please sign in again.');

    const membership = await this.tenants.findActiveMembership(record.userId, input.tenantId);
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw DomainError.membershipRequired();
    }

    await this.sessions.revokeSession(record.sessionId, record.userId, 'tenant_switched');

    const user = await this.requireUser(record.userId);
    await this.audit.record({
      tenantId: input.tenantId,
      actorUserId: user.id,
      action: 'auth.tenant_switched',
      resourceType: 'membership',
      metadata: { toTenantId: input.tenantId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.sessionFor(user, {
      tenantSlug: undefined,
      tenantId: input.tenantId,
      role: membership.role as Role,
      satisfiesMfa: true,
      assuranceLevel: 'AAL1',
      methods: ['REFRESH'],
      meta,
    });
  }

  async me(userId: string, tenantId: string | null, assuranceLevel: 'AAL1' | 'AAL2' | 'AAL3'): Promise<MeResponse> {
    const user = await this.requireUser(userId);
    const memberships = await this.tenants.listMembershipsForUser(userId);
    const activeMembership = tenantId
      ? (memberships.find((membership) => membership.tenantId === tenantId) ?? null)
      : null;

    if (tenantId && !activeMembership) {
      throw DomainError.membershipRequired();
    }

    const role = activeMembership?.role ?? null;
    const mfaEnrolled = (await this.mfa.activeFactorCount(userId)) > 0;

    return {
      principal: {
        userId: user.id,
        email: user.email,
        phone: user.phone,
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
      assuranceLevel,
      mfaEnrolled,
      memberships: memberships.map((membership) => ({
        tenantId: membership.tenantId,
        tenantName: membership.tenantName,
        tenantSlug: membership.tenantSlug,
        role: membership.role,
        status: membership.status,
      })),
    };
  }

  async listSessions(userId: string, sessionId: string) {
    return this.sessions.listSessions(userId, sessionId);
  }

  async revokeSession(userId: string, sessionId: string, meta: RequestMetadata): Promise<void> {
    await this.sessions.revokeSession(sessionId, userId, 'user_revoked');
    await this.audit.record({
      actorUserId: userId,
      action: 'auth.session_revoked',
      resourceType: 'session',
      resourceId: sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async listFactors(userId: string) {
    return this.mfa.listFactors(userId);
  }

  async listIdentities(userId: string) {
    return this.identities.listIdentities(userId);
  }

  async enrollTotp(userId: string, name: string) {
    const user = await this.requireUser(userId);
    const accountName = user.email ?? user.phone ?? user.id;
    return this.mfa.enrollTotp(userId, accountName, name);
  }

  async confirmTotp(userId: string, factorId: string, code: string, meta: RequestMetadata) {
    const result = await this.mfa.confirmTotp(userId, factorId, code);
    await this.audit.record({
      actorUserId: userId,
      action: 'auth.mfa_enrolled',
      resourceType: 'mfa_factor',
      resourceId: factorId,
      metadata: { type: 'TOTP' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return result;
  }

  async disableMfaFactor(userId: string, factorId: string, meta: RequestMetadata): Promise<void> {
    await this.mfa.disableFactor(userId, factorId);
    await this.audit.record({
      actorUserId: userId,
      action: 'auth.mfa_disabled',
      resourceType: 'mfa_factor',
      resourceId: factorId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async regenerateRecoveryCodes(
    userId: string,
    currentPassword: string,
    meta: RequestMetadata,
  ): Promise<string[]> {
    const currentHash = await this.identities.passwordHashFor(userId);
    if (currentHash) {
      const valid = await this.passwords.verify(currentHash, currentPassword);
      if (!valid) throw DomainError.invalidCredentials('Password is incorrect');
    }
    const codes = await this.mfa.regenerateRecoveryCodes(userId);
    await this.audit.record({
      actorUserId: userId,
      action: 'auth.mfa_recovery_codes_regenerated',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return codes;
  }

  async startWebAuthnRegistration(userId: string, name: string) {
    const user = await this.requireUser(userId);
    const accountName = user.email ?? user.phone ?? user.id;
    return this.webauthn.startRegistration({
      userId,
      accountName,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      name,
    });
  }

  async startWebAuthnAuthentication(input: { email?: string; phone?: string; tenantSlug?: string }) {
    return this.webauthn.startAuthentication(input);
  }

  async finishWebAuthnRegistration(
    userId: string,
    input: {
      challengeId: string;
      factorId: string;
      response: RegistrationResponseJSON;
      name?: string;
    },
    meta: RequestMetadata,
  ) {
    const result = await this.webauthn.finishRegistration({ userId, ...input });
    await this.audit.record({
      actorUserId: userId,
      action: 'auth.mfa_enrolled',
      resourceType: 'mfa_factor',
      resourceId: input.factorId,
      metadata: { type: 'WEBAUTHN' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return result;
  }

  private async establishSession(
    user: LoginUser,
    input: SessionPriming & { tenantSlug?: string; meta: RequestMetadata },
  ): Promise<LoginResult> {
    if (user.status !== UserStatus.ACTIVE) {
      throw DomainError.forbidden('Your account is not active. Please contact your administrator.');
    }

    const activeMfa = await this.mfa.activeFactorCount(user.id);
    if (activeMfa > 0 && !input.satisfiesMfa) {
      const mfaToken = await this.mfa.issueChallenge(user.id, input.tenantSlug, input.methods);
      const { factors } = await this.mfa.listFactors(user.id);
      return {
        mfaRequired: true,
        mfaToken,
        factors: factors
          .filter((factor) => factor.status === 'ACTIVE')
          .map((factor) => ({ id: factor.id, type: factor.type, name: factor.name })),
      };
    }

    return this.sessionFor(user, input);
  }

  private async sessionFor(
    user: LoginUser,
    input: SessionPriming & {
      tenantSlug?: string;
      tenantId?: string;
      role?: Role;
      meta: RequestMetadata;
    },
  ): Promise<Session> {
    bindUserToContext(user.id);

    let tenantId = input.tenantId ?? null;
    let role: Role | null = input.role ?? null;

    if (!tenantId) {
      const resolution = await this.tenants.resolveTenantForLogin(user.id, input.tenantSlug);
      if (input.tenantSlug && !resolution.tenantId) throw DomainError.membershipRequired();
      tenantId = resolution.tenantId;
      role = resolution.role;
      if (tenantId && !role) throw DomainError.membershipRequired();
    }

    bindTenantToContext(tenantId ?? undefined);
    await this.identities.touchLastLogin(user.id);

    const session = await this.sessions.createSession({
      userId: user.id,
      tenantId,
      role,
      email: user.email,
      phone: user.phone,
      isPlatformAdmin: user.isPlatformAdmin,
      assuranceLevel: input.assuranceLevel,
      methods: input.methods,
      meta: input.meta,
    });

    await this.audit.record({
      tenantId,
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { tenantId, role, aal: input.assuranceLevel, amr: input.methods },
      ipAddress: input.meta.ipAddress,
      userAgent: input.meta.userAgent,
    });

    return session;
  }

  private async requireUser(userId: string): Promise<LoginUser> {
    const user = await this.identities.loadUser(userId);
    if (!user) throw DomainError.unauthenticated('Account no longer exists');
    return user;
  }

  private loginAttemptKey(identifier: string, ipAddress?: string | null): string {
    return `auth:login-attempt:${ipAddress ?? 'unknown'}:${identifier}`;
  }

  private async enforceLoginRateLimit(identifier: string, ipAddress?: string | null): Promise<void> {
    const attempts = await this.redis.incrementWithTtl(
      this.loginAttemptKey(identifier, ipAddress),
      LOGIN_ATTEMPT_WINDOW_SECONDS,
    );
    if (attempts > LOGIN_ATTEMPT_LIMIT) {
      throw DomainError.rateLimited('Too many sign-in attempts. Please try again later.');
    }
  }
}
