import { Injectable } from '@nestjs/common';
import { ChallengePurpose, Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { DomainError } from '../../common/errors/domain-error';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

const OTP_DIGITS = 6;
const OTP_MAX_ATTEMPTS = 5;
const ISSUE_LIMIT_PER_WINDOW = 5;
const ISSUE_WINDOW_SECONDS = 3600;

export type ChallengeSecretKind = 'token' | 'otp';

export interface IssueChallengeInput {
  purpose: ChallengePurpose;
  identifier: string;
  secretKind: ChallengeSecretKind;
  userId?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
  ttlSeconds?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IssuedChallenge {
  id: string;
  secret: string;
  expiresAt: Date;
}

export interface ConsumedChallenge {
  id: string;
  purpose: ChallengePurpose;
  identifier: string;
  userId: string | null;
  tenantId: string | null;
  metadata: Prisma.JsonValue;
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBoxService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async issue(input: IssueChallengeInput): Promise<IssuedChallenge> {
    await this.enforceIssueLimit(input.purpose, input.identifier);

    const secret =
      input.secretKind === 'otp'
        ? randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0')
        : this.secrets.randomToken(32);

    const ttlSeconds = input.ttlSeconds ?? this.defaultTtl(input.purpose);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const challenge = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.verificationChallenge.create({
        data: {
          purpose: input.purpose,
          identifier: input.identifier,
          secretHash: this.secrets.hash(secret),
          userId: input.userId ?? null,
          tenantId: input.tenantId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          maxAttempts: OTP_MAX_ATTEMPTS,
          expiresAt,
        },
        select: { id: true },
      }),
    );

    return { id: challenge.id, secret, expiresAt };
  }

  /**
   * Validates a presented secret against the most recent open challenge for the
   * identifier and purpose. Attempts are counted against the challenge so a
   * caller cannot brute-force a six-digit code, and consumption is a
   * compare-and-set so two concurrent requests cannot both succeed.
   */
  async consume(input: {
    purpose: ChallengePurpose;
    identifier: string;
    secret: string;
  }): Promise<ConsumedChallenge> {
    const presentedHash = this.secrets.hash(input.secret);

    const challenge = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.verificationChallenge.findFirst({
        where: {
          purpose: input.purpose,
          identifier: input.identifier,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    if (!challenge) {
      throw DomainError.invalidChallenge();
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw DomainError.rateLimited('Too many attempts. Please request a new code.');
    }

    if (!this.secrets.safeEqual(challenge.secretHash, presentedHash)) {
      await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
        tx.verificationChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        }),
      );
      throw DomainError.invalidChallenge();
    }

    const consumed = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.verificationChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
    );

    if (consumed.count === 0) {
      throw DomainError.challengeConsumed();
    }

    return {
      id: challenge.id,
      purpose: challenge.purpose,
      identifier: challenge.identifier,
      userId: challenge.userId,
      tenantId: challenge.tenantId,
      metadata: challenge.metadata,
    };
  }

  /**
   * Looks up a token challenge without consuming it. Used to render a preview
   * page (for example "You have been invited to ...") before the bearer decides
   * whether to accept, and again when they do. The caller is responsible for
   * enforcing expiry and consumed state, which `consumeByToken` still does.
   */
  async findByToken(input: {
    purpose: ChallengePurpose;
    secret: string;
  }): Promise<ConsumedChallenge | null> {
    const secretHash = this.secrets.hash(input.secret);
    const challenge = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.verificationChallenge.findFirst({
        where: { purpose: input.purpose, secretHash },
      }),
    );
    if (!challenge) return null;

    return {
      id: challenge.id,
      purpose: challenge.purpose,
      identifier: challenge.identifier,
      userId: challenge.userId,
      tenantId: challenge.tenantId,
      metadata: challenge.metadata,
    };
  }

  /**
   * Consumes a high-entropy token challenge where the caller only presents the
   * token and not the identifier it was issued for (magic links, email
   * verification, password reset). Attempt limiting is unnecessary here because
   * the lookup is by the token's own hash; possession of the token is the proof.
   */
  async consumeByToken(input: {
    purpose: ChallengePurpose;
    secret: string;
  }): Promise<ConsumedChallenge> {
    const secretHash = this.secrets.hash(input.secret);
    const challenge = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.verificationChallenge.findFirst({
        where: { purpose: input.purpose, secretHash },
      }),
    );

    if (!challenge) throw DomainError.invalidChallenge();
    if (challenge.consumedAt) throw DomainError.challengeConsumed();
    if (challenge.expiresAt.getTime() <= Date.now()) throw DomainError.challengeExpired();

    const consumed = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.verificationChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
    );
    if (consumed.count === 0) throw DomainError.challengeConsumed();

    return {
      id: challenge.id,
      purpose: challenge.purpose,
      identifier: challenge.identifier,
      userId: challenge.userId,
      tenantId: challenge.tenantId,
      metadata: challenge.metadata,
    };
  }

  private defaultTtl(purpose: ChallengePurpose): number {
    if (purpose === ChallengePurpose.MAGIC_LINK) return this.config.magicLinkTtlSeconds;
    return this.config.verificationTtlSeconds;
  }

  private issueKey(purpose: ChallengePurpose, identifier: string): string {
    return `auth:challenge-issue:${purpose}:${identifier}`;
  }

  private async enforceIssueLimit(purpose: ChallengePurpose, identifier: string): Promise<void> {
    const count = await this.redis.incrementWithTtl(
      this.issueKey(purpose, identifier),
      ISSUE_WINDOW_SECONDS,
    );
    if (count > ISSUE_LIMIT_PER_WINDOW) {
      this.logger.warn(
        `Challenge issuance throttled for ${purpose} (${identifier})`,
        'VerificationService',
      );
      throw DomainError.rateLimited('Too many requests. Please try again later.');
    }
  }
}
