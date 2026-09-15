import { Injectable } from '@nestjs/common';
import { MfaFactorStatus, MfaFactorType, Prisma } from '@prisma/client';
import type { AuthenticationMethod } from '@zion8/contracts';
import { generateTotpSecret, totpAuthUri, verifyTotp } from '../../common/crypto/totp';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5;

export interface MfaChallenge {
  userId: string;
  tenantSlug?: string;
  methods: AuthenticationMethod[];
}

export interface FactorView {
  id: string;
  type: MfaFactorType;
  status: MfaFactorStatus;
  name: string;
  confirmedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBoxService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async listFactors(userId: string): Promise<{
    factors: FactorView[];
    recoveryCodesRemaining: number;
  }> {
    const { factors, recoveryCodesRemaining } = await this.prisma.withScope(
      { userId, isPlatformAdmin: true },
      async (tx) => {
        const factors = await tx.mfaFactor.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        const recoveryCodesRemaining = await tx.mfaRecoveryCode.count({
          where: { userId, usedAt: null },
        });
        return { factors, recoveryCodesRemaining };
      },
    );

    return { factors, recoveryCodesRemaining };
  }

  async activeFactorCount(userId: string): Promise<number> {
    return this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.count({ where: { userId, status: MfaFactorStatus.ACTIVE } }),
    );
  }

  async enrollTotp(userId: string, accountName: string, name: string) {
    const secret = generateTotpSecret();
    const factor = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.create({
        data: {
          userId,
          type: MfaFactorType.TOTP,
          status: MfaFactorStatus.PENDING,
          name,
          secretCiphertext: this.secrets.encrypt(secret),
        },
        select: { id: true },
      }),
    );

    return {
      factorId: factor.id,
      secret,
      otpauthUri: totpAuthUri({ secret, accountName, issuer: this.config.totpIssuer }),
    };
  }

  async confirmTotp(userId: string, factorId: string, code: string) {
    const factor = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.findFirst({ where: { id: factorId, userId, type: MfaFactorType.TOTP } }),
    );
    if (!factor) throw DomainError.mfaFactorNotFound();
    if (factor.status === MfaFactorStatus.ACTIVE) throw DomainError.conflict('Factor is already active');
    if (!factor.secretCiphertext) throw DomainError.internal('Factor secret is unavailable');

    const secret = this.secrets.decrypt(factor.secretCiphertext);
    if (!verifyTotp(secret, code)) {
      throw DomainError.mfaInvalidCode();
    }

    const recoveryCodes = await this.prisma.withScope(
      { userId, isPlatformAdmin: true },
      async (tx) => {
        const updated = await tx.mfaFactor.update({
          where: { id: factor.id },
          data: { status: MfaFactorStatus.ACTIVE, confirmedAt: new Date() },
        });
        const codes = await this.replaceRecoveryCodes(tx, userId);
        return { updated, codes };
      },
    );

    return {
      factor: toFactorView(recoveryCodes.updated),
      recoveryCodes: recoveryCodes.codes,
    };
  }

  async disableFactor(userId: string, factorId: string): Promise<void> {
    const factor = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.findFirst({ where: { id: factorId, userId } }),
    );
    if (!factor) throw DomainError.mfaFactorNotFound();

    await this.prisma.withScope({ userId, isPlatformAdmin: true }, async (tx) => {
      await tx.mfaFactor.update({
        where: { id: factor.id },
        data: { status: MfaFactorStatus.DISABLED, secretCiphertext: null },
      });
      if (factor.type === MfaFactorType.WEBAUTHN) {
        await tx.webAuthnCredential.deleteMany({ where: { factorId: factor.id } });
      }
      const remaining = await tx.mfaFactor.count({
        where: { userId, status: MfaFactorStatus.ACTIVE },
      });
      if (remaining === 0) {
        await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      }
    });
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    return this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      this.replaceRecoveryCodes(tx, userId),
    );
  }

  /**
   * Verifies a TOTP code against every active factor. Returns the matching
   * factor so the caller can update last-used metadata.
   */
  async verifyTotpForUser(userId: string, code: string): Promise<{ factorId: string }> {
    const factors = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.findMany({
        where: { userId, type: MfaFactorType.TOTP, status: MfaFactorStatus.ACTIVE },
        select: { id: true, secretCiphertext: true },
      }),
    );

    for (const factor of factors) {
      if (!factor.secretCiphertext) continue;
      const secret = this.secrets.decrypt(factor.secretCiphertext);
      if (verifyTotp(secret, code)) {
        await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
          tx.mfaFactor.update({ where: { id: factor.id }, data: { lastUsedAt: new Date() } }),
        );
        return { factorId: factor.id };
      }
    }

    throw DomainError.mfaInvalidCode();
  }

  async consumeRecoveryCode(userId: string, code: string): Promise<void> {
    const normalized = code.trim().toLowerCase();
    const codeHash = this.secrets.hash(normalized);

    const consumed = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaRecoveryCode.updateMany({
        where: { userId, codeHash, usedAt: null },
        data: { usedAt: new Date() },
      }),
    );

    if (consumed.count === 0) {
      throw DomainError.mfaInvalidCode('That recovery code is not valid or has been used');
    }
  }

  async issueChallenge(
    userId: string,
    tenantSlug: string | undefined,
    methods: AuthenticationMethod[],
  ): Promise<string> {
    const token = this.secrets.randomToken(32);
    const stored = await this.redis.setIfAbsent(
      challengeKey(token),
      JSON.stringify({ userId, tenantSlug, methods } satisfies MfaChallenge),
      this.config.mfaChallengeTtlSeconds,
    );
    if (!stored) {
      throw DomainError.internal('Unable to create a verification challenge');
    }
    return token;
  }

  async readChallenge(token: string): Promise<MfaChallenge> {
    const raw = await this.redis.connection.get(challengeKey(token));
    if (!raw) throw DomainError.mfaRequired('Your verification window has expired. Please sign in again.');
    return JSON.parse(raw) as MfaChallenge;
  }

  async completeChallenge(token: string): Promise<void> {
    await this.redis.delete(challengeKey(token));
  }

  private async replaceRecoveryCodes(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<string[]> {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.secrets.randomToken(RECOVERY_CODE_BYTES).toLowerCase(),
    );
    await tx.mfaRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: this.secrets.hash(code) })),
    });
    return codes;
  }
}

function challengeKey(token: string): string {
  return `auth:mfa-challenge:${token}`;
}

function toFactorView(factor: {
  id: string;
  type: MfaFactorType;
  status: MfaFactorStatus;
  name: string;
  confirmedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}): FactorView {
  return {
    id: factor.id,
    type: factor.type,
    status: factor.status,
    name: factor.name,
    confirmedAt: factor.confirmedAt,
    lastUsedAt: factor.lastUsedAt,
    createdAt: factor.createdAt,
  };
}
