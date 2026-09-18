import { Injectable } from '@nestjs/common';
import {
  ChallengePurpose,
  IdentityProvider,
  InvitationStatus,
  MembershipStatus,
  Role as PrismaRole,
  UserStatus,
} from '@prisma/client';
import {
  outranks,
  type AcceptInvitationRequest,
  type DeclineInvitationRequest,
  type InvitationListResponse,
  type InvitationPreview,
  type InvitationSummary,
  type InviteAdministratorsRequest,
  type Role,
  type Session,
} from '@zion8/contracts';
import { AppConfigService } from '../../common/config/app-config.service';
import { DomainError } from '../../common/errors/domain-error';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IdentityService } from '../auth/identity.service';
import { PasswordService } from '../auth/password.service';
import type { RequestMetadata } from '../auth/session.service';
import { SessionService } from '../auth/session.service';
import { VerificationService } from '../auth/verification.service';
import { TenantService } from '../tenancy/tenant.service';
import { OnboardingMailerService } from './onboarding-mailer.service';

interface InvitationRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: PrismaRole;
  status: InvitationStatus;
  invitedByUserId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  lastSentAt: Date;
  resendCount: number;
  createdAt: Date;
}

/**
 * Administrator invitations for the onboarding journey.
 *
 * The invitation row is the business record; the bearer token is issued through
 * the shared `VerificationChallenge` primitive and pointed at by `challengeId`.
 * Re-sending supersedes the challenge rather than minting a second parallel
 * token scheme, and acceptance is idempotent because the membership is an
 * upsert keyed by (tenantId, userId).
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verification: VerificationService,
    private readonly identities: IdentityService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tenants: TenantService,
    private readonly audit: AuditService,
    private readonly mailer: OnboardingMailerService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async list(tenantId: string): Promise<InvitationListResponse> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantInvitation.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return { invitations: rows.map(toSummary) };
  }

  async invite(
    tenantId: string,
    actor: { userId: string; role: Role },
    input: InviteAdministratorsRequest,
    meta: RequestMetadata,
  ): Promise<InvitationListResponse> {
    const tenant = await this.requireTenant(tenantId);
    const inviterName = await this.inviterDisplayName(actor.userId);

    for (const invitee of input.invitations) {
      if (!outranks(actor.role, invitee.role)) {
        throw DomainError.forbidden(
          `You cannot invite someone as ${invitee.role} because it is not below your own role.`,
        );
      }

      const existing = await this.prisma.withTenant(tenantId, (tx) =>
        tx.tenantInvitation.findUnique({
          where: { tenantId_email: { tenantId, email: invitee.email } },
        }),
      );

      if (existing?.status === InvitationStatus.ACCEPTED) {
        throw DomainError.invitationAlreadyExists(
          `${invitee.email} is already a member of this workspace.`,
        );
      }

      const expiresAt = new Date(Date.now() + this.config.invitationTtlSeconds * 1000);
      const invitation = await this.prisma.withTenant(tenantId, (tx) =>
        tx.tenantInvitation.upsert({
          where: { tenantId_email: { tenantId, email: invitee.email } },
          create: {
            tenantId,
            email: invitee.email,
            firstName: invitee.firstName ?? null,
            lastName: invitee.lastName ?? null,
            role: invitee.role as PrismaRole,
            status: InvitationStatus.PENDING,
            invitedByUserId: actor.userId,
            expiresAt,
            lastSentAt: new Date(),
          },
          update: {
            firstName: invitee.firstName ?? null,
            lastName: invitee.lastName ?? null,
            role: invitee.role as PrismaRole,
            status: InvitationStatus.PENDING,
            invitedByUserId: actor.userId,
            expiresAt,
            lastSentAt: new Date(),
            revokedAt: null,
            resendCount: { increment: 1 },
          },
        }),
      );

      await this.issueAndSend({
        tenantId,
        tenantName: tenant.name,
        invitationId: invitation.id,
        email: invitee.email,
        role: invitee.role,
        inviterName,
        inviterUserId: actor.userId,
        expiresAt,
        meta,
      });
    }

    return this.list(tenantId);
  }

  async resend(
    tenantId: string,
    actorUserId: string,
    invitationId: string,
    meta: RequestMetadata,
  ): Promise<InvitationSummary> {
    const invitation = await this.requireInvitation(tenantId, invitationId);
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw DomainError.invitationAlreadyAccepted();
    }

    const tenant = await this.requireTenant(tenantId);
    const inviterName = await this.inviterDisplayName(actorUserId);
    const expiresAt = new Date(Date.now() + this.config.invitationTtlSeconds * 1000);

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantInvitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.PENDING,
          expiresAt,
          lastSentAt: new Date(),
          revokedAt: null,
          resendCount: { increment: 1 },
        },
      }),
    );

    await this.issueAndSend({
      tenantId,
      tenantName: tenant.name,
      invitationId,
      email: invitation.email,
      role: invitation.role as Role,
      inviterName,
      inviterUserId: actorUserId,
      expiresAt,
      meta,
    });

    const updated = await this.requireInvitation(tenantId, invitationId);
    return toSummary(updated);
  }

  async revoke(
    tenantId: string,
    actorUserId: string,
    invitationId: string,
    meta: RequestMetadata,
  ): Promise<InvitationSummary> {
    const invitation = await this.requireInvitation(tenantId, invitationId);
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw DomainError.invitationAlreadyAccepted();
    }

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
      }),
    );

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'onboarding.invitation_revoked',
      resourceType: 'tenant_invitation',
      resourceId: invitationId,
      metadata: { email: invitation.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return toSummary(row);
  }

  /** Public projection shown on the accept-invitation page. */
  async preview(token: string): Promise<InvitationPreview> {
    const challenge = await this.verification.findByToken({
      purpose: ChallengePurpose.INVITATION,
      secret: token,
    });
    if (!challenge?.tenantId) throw DomainError.invitationNotFound();

    const invitationId = invitationIdFrom(challenge.metadata);
    if (!invitationId) throw DomainError.invitationNotFound();

    const invitation = await this.requireInvitation(challenge.tenantId, invitationId);
    const tenant = await this.requireTenant(challenge.tenantId);
    const account = await this.identities.findByEmail(invitation.email);
    const invitedByName = invitation.invitedByUserId
      ? await this.inviterDisplayName(invitation.invitedByUserId)
      : null;

    return {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      email: invitation.email,
      role: invitation.role as Role,
      invitedByName,
      expiresAt: invitation.expiresAt.toISOString(),
      status: effectiveStatus(invitation),
      accountExists: account !== null,
    };
  }

  /**
   * Accepting an invitation provisions the invitee into the workspace and signs
   * them in. If they already have a Zion8 account their identity is linked
   * rather than duplicated, which is what makes it safe to invite an existing
   * user from another church.
   */
  async accept(input: AcceptInvitationRequest, meta: RequestMetadata): Promise<Session> {
    const challenge = await this.verification.consumeByToken({
      purpose: ChallengePurpose.INVITATION,
      secret: input.token,
    });
    if (!challenge.tenantId) throw DomainError.invitationNotFound();

    const invitationId = invitationIdFrom(challenge.metadata);
    if (!invitationId) throw DomainError.invitationNotFound();

    const invitation = await this.requireInvitation(challenge.tenantId, invitationId);
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw DomainError.invitationAlreadyAccepted();
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw DomainError.invitationExpired('This invitation has been revoked.');
    }
    if (invitation.email !== challenge.identifier) {
      throw DomainError.invitationNotFound();
    }

    const existing = await this.identities.findByEmail(invitation.email);
    let userId: string;

    if (existing) {
      userId = existing.userId;
      await this.identities.markContactVerified({
        userId,
        provider: IdentityProvider.EMAIL,
        identifier: invitation.email,
      });
    } else {
      if (!input.password) {
        throw DomainError.validation([
          { path: 'password', message: 'Set a password to activate your account.' },
        ]);
      }
      const passwordHash = await this.passwords.hash(input.password);
      const local = invitation.email.split('@')[0] ?? 'member';
      userId = await this.provisionUser({
        email: invitation.email,
        firstName: input.firstName ?? invitation.firstName ?? capitalize(local),
        lastName: input.lastName ?? invitation.lastName ?? 'Member',
        passwordHash,
      });
    }

    await this.prisma.withScope(
      { tenantId: challenge.tenantId, userId, isPlatformAdmin: true },
      async (tx) => {
        const membership = await tx.membership.findUnique({
          where: { tenantId_userId: { tenantId: challenge.tenantId as string, userId } },
          select: { id: true },
        });
        if (!membership) {
          await this.tenants.createMembership(tx, {
            tenantId: challenge.tenantId as string,
            userId,
            role: invitation.role as Role,
            status: MembershipStatus.ACTIVE,
          });
        }

        await tx.tenantInvitation.update({
          where: { id: invitationId },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedUserId: userId,
            acceptedAt: new Date(),
          },
        });
      },
    );

    await this.audit.record({
      tenantId: challenge.tenantId,
      actorUserId: userId,
      action: 'onboarding.invitation_accepted',
      resourceType: 'tenant_invitation',
      resourceId: invitationId,
      metadata: { email: invitation.email, role: invitation.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const user = await this.identities.loadUser(userId);
    if (!user) throw DomainError.unauthenticated('Account could not be loaded');

    this.logger.log(
      `Invitation ${invitationId} accepted by ${invitation.email}`,
      'InvitationService',
    );

    return this.sessions.createSession({
      userId,
      tenantId: challenge.tenantId,
      role: invitation.role as Role,
      email: user.email,
      phone: user.phone,
      isPlatformAdmin: user.isPlatformAdmin,
      assuranceLevel: 'AAL1',
      methods: ['INVITATION'],
      meta,
    });
  }

  async decline(input: DeclineInvitationRequest, meta: RequestMetadata): Promise<void> {
    const challenge = await this.verification.consumeByToken({
      purpose: ChallengePurpose.INVITATION,
      secret: input.token,
    });
    if (!challenge.tenantId) throw DomainError.invitationNotFound();

    const invitationId = invitationIdFrom(challenge.metadata);
    if (!invitationId) throw DomainError.invitationNotFound();

    const invitation = await this.requireInvitation(challenge.tenantId, invitationId);
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw DomainError.invitationAlreadyAccepted();
    }

    await this.prisma.withTenant(challenge.tenantId, (tx) =>
      tx.tenantInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
      }),
    );

    await this.audit.record({
      tenantId: challenge.tenantId,
      action: 'onboarding.invitation_declined',
      resourceType: 'tenant_invitation',
      resourceId: invitationId,
      metadata: { email: invitation.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private async issueAndSend(input: {
    tenantId: string;
    tenantName: string;
    invitationId: string;
    email: string;
    role: Role;
    inviterName: string | null;
    inviterUserId: string;
    expiresAt: Date;
    meta: RequestMetadata;
  }): Promise<void> {
    const { secret, id: challengeId } = await this.verification.issue({
      purpose: ChallengePurpose.INVITATION,
      identifier: input.email,
      secretKind: 'token',
      userId: input.inviterUserId,
      tenantId: input.tenantId,
      metadata: { invitationId: input.invitationId, role: input.role, email: input.email },
      ttlSeconds: this.config.invitationTtlSeconds,
      ipAddress: input.meta.ipAddress,
      userAgent: input.meta.userAgent,
    });

    await this.prisma.withTenant(input.tenantId, (tx) =>
      tx.tenantInvitation.update({
        where: { id: input.invitationId },
        data: { challengeId, expiresAt: input.expiresAt },
      }),
    );

    await this.mailer.sendAdministratorInvitation({
      to: input.email,
      tenantName: input.tenantName,
      inviterName: input.inviterName,
      role: input.role,
      token: secret,
      expiresAt: input.expiresAt,
    });

    await this.audit.record({
      tenantId: input.tenantId,
      actorUserId: input.inviterUserId,
      action: 'onboarding.invitation_sent',
      resourceType: 'tenant_invitation',
      resourceId: input.invitationId,
      metadata: { email: input.email, role: input.role },
      ipAddress: input.meta.ipAddress,
      userAgent: input.meta.userAgent,
    });
  }

  private async provisionUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }): Promise<string> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    return user.id;
  }

  private async requireInvitation(
    tenantId: string,
    invitationId: string,
  ): Promise<InvitationRow & { tenantId: string; challengeId: string | null }> {
    const invitation = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantInvitation.findUnique({ where: { id: invitationId } }),
    );
    if (!invitation) throw DomainError.invitationNotFound();
    return invitation;
  }

  private async requireTenant(tenantId: string): Promise<{ name: string; slug: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });
    if (!tenant) throw DomainError.tenantNotFound();
    return tenant;
  }

  private async inviterDisplayName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) return null;
    const name = `${user.firstName} ${user.lastName}`.trim();
    return name.length > 0 ? name : null;
  }
}

function invitationIdFrom(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const value = (metadata as Record<string, unknown>).invitationId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function capitalize(value: string): string {
  if (value.length === 0) return 'Member';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function effectiveStatus(row: InvitationRow): InvitationRow['status'] {
  if (row.status === InvitationStatus.PENDING && row.expiresAt.getTime() <= Date.now()) {
    return InvitationStatus.EXPIRED;
  }
  return row.status;
}

function toSummary(row: InvitationRow): InvitationSummary {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role as Role,
    status: effectiveStatus(row),
    invitedByUserId: row.invitedByUserId,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastSentAt: row.lastSentAt.toISOString(),
    resendCount: row.resendCount,
    createdAt: row.createdAt.toISOString(),
  };
}
