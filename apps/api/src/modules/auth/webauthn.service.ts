import { Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { MfaFactorStatus, MfaFactorType } from '@prisma/client';
import { AppConfigService } from '../../common/config/app-config.service';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MfaService } from './mfa.service';

const CHALLENGE_TTL_SECONDS = 300;

interface StoredRegistrationChallenge {
  userId: string;
  challenge: string;
  factorId: string;
}

interface StoredAuthenticationChallenge {
  userId: string | null;
  challenge: string;
  tenantSlug?: string;
}

@Injectable()
export class WebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBoxService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly mfa: MfaService,
  ) {}

  async startRegistration(input: {
    userId: string;
    accountName: string;
    displayName: string;
    name: string;
  }) {
    const existing = await this.prisma.withScope({ userId: input.userId, isPlatformAdmin: true }, (tx) =>
      tx.webAuthnCredential.findMany({
        where: { userId: input.userId },
        select: { credentialId: true, transports: true },
      }),
    );

    const { rpId, rpName } = this.config.webauthn;
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: input.accountName,
      userDisplayName: input.displayName,
      userID: uuidToBytes(input.userId),
      attestationType: 'none',
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const factor = await this.prisma.withScope({ userId: input.userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.create({
        data: {
          userId: input.userId,
          type: MfaFactorType.WEBAUTHN,
          status: MfaFactorStatus.PENDING,
          name: input.name,
        },
        select: { id: true },
      }),
    );

    const challengeId = this.secrets.randomToken(16);
    await this.storeChallenge('reg', challengeId, {
      userId: input.userId,
      challenge: options.challenge,
      factorId: factor.id,
    });

    return { challengeId, factorId: factor.id, options };
  }

  async finishRegistration(input: {
    userId: string;
    challengeId: string;
    factorId: string;
    response: RegistrationResponseJSON;
    name?: string;
  }) {
    const stored = await this.readChallenge<StoredRegistrationChallenge>('reg', input.challengeId);
    if (stored.userId !== input.userId || stored.factorId !== input.factorId) {
      throw DomainError.webauthnFailed();
    }

    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.config.webauthn.origins,
      expectedRPID: this.config.webauthn.rpId,
    });

    if (!verification.verified) {
      throw DomainError.webauthnFailed();
    }

    const { registrationInfo } = verification;
    let becameFirstFactor = false;

    await this.prisma.withScope({ userId: input.userId, isPlatformAdmin: true }, async (tx) => {
      await tx.webAuthnCredential.create({
        data: {
          factorId: input.factorId,
          userId: input.userId,
          credentialId: registrationInfo.credential.id,
          publicKey: Buffer.from(registrationInfo.credential.publicKey),
          signCount: registrationInfo.credential.counter,
          transports: registrationInfo.credential.transports ?? [],
          aaguid: registrationInfo.aaguid,
          deviceType: registrationInfo.credentialDeviceType,
          backedUp: registrationInfo.credentialBackedUp,
        },
      });

      await tx.mfaFactor.update({
        where: { id: input.factorId },
        data: {
          status: MfaFactorStatus.ACTIVE,
          confirmedAt: new Date(),
          ...(input.name ? { name: input.name } : {}),
        },
      });

      const activeCount = await tx.mfaFactor.count({
        where: { userId: input.userId, status: MfaFactorStatus.ACTIVE },
      });
      becameFirstFactor = activeCount === 1;
    });

    await this.redis.delete(challengeKey('reg', input.challengeId));

    const recoveryCodes = becameFirstFactor
      ? await this.mfa.regenerateRecoveryCodes(input.userId)
      : [];

    const factor = await this.prisma.withScope({ userId: input.userId, isPlatformAdmin: true }, (tx) =>
      tx.mfaFactor.findUniqueOrThrow({
        where: { id: input.factorId },
        select: {
          id: true,
          type: true,
          status: true,
          name: true,
          confirmedAt: true,
          lastUsedAt: true,
          createdAt: true,
        },
      }),
    );

    return {
      factor,
      recoveryCodes,
    };
  }

  async startAuthentication(input: { email?: string; phone?: string; tenantSlug?: string }) {
    const { rpId } = this.config.webauthn;
    const user = input.email || input.phone ? await this.resolveUser(input) : null;

    const allowCredentials = user
      ? (
          await this.prisma.withScope({ userId: user.id, isPlatformAdmin: true }, (tx) =>
            tx.webAuthnCredential.findMany({
              where: { userId: user.id },
              select: { credentialId: true, transports: true },
            }),
          )
        ).map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports,
        }))
      : [];

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeId = this.secrets.randomToken(16);
    await this.storeChallenge('auth', challengeId, {
      userId: user?.id ?? null,
      challenge: options.challenge,
      tenantSlug: input.tenantSlug,
    } satisfies StoredAuthenticationChallenge);

    return { challengeId, options };
  }

  async finishAuthentication(input: { challengeId: string; response: AuthenticationResponseJSON }) {
    const stored = await this.readChallenge<StoredAuthenticationChallenge>('auth', input.challengeId);

    const credential = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.webAuthnCredential.findUnique({
        where: { credentialId: input.response.id },
      }),
    );
    if (!credential) throw DomainError.webauthnFailed();
    if (stored.userId && credential.userId !== stored.userId) throw DomainError.webauthnFailed();

    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.config.webauthn.origins,
      expectedRPID: this.config.webauthn.rpId,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.signCount,
        transports: credential.transports,
      },
    });

    if (!verification.verified) throw DomainError.webauthnFailed();

    await this.prisma.withScope({ userId: credential.userId, isPlatformAdmin: true }, async (tx) => {
      await tx.webAuthnCredential.update({
        where: { id: credential.id },
        data: {
          signCount: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        },
      });
      await tx.mfaFactor.update({
        where: { id: credential.factorId },
        data: { lastUsedAt: new Date() },
      });
    });

    await this.redis.delete(challengeKey('auth', input.challengeId));

    return { userId: credential.userId, tenantSlug: stored.tenantSlug };
  }

  private async resolveUser(input: { email?: string; phone?: string }) {
    const identity = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.findFirst({
        where: {
          OR: [
            ...(input.email ? [{ provider: 'EMAIL' as const, providerAccountId: input.email }] : []),
            ...(input.phone ? [{ provider: 'PHONE' as const, providerAccountId: input.phone }] : []),
          ],
        },
        select: { userId: true },
      }),
    );
    return identity ? { id: identity.userId } : null;
  }

  private storeChallenge(kind: 'reg' | 'auth', challengeId: string, value: unknown): Promise<boolean> {
    return this.redis.setIfAbsent(
      challengeKey(kind, challengeId),
      JSON.stringify(value),
      CHALLENGE_TTL_SECONDS,
    );
  }

  private async readChallenge<T>(kind: 'reg' | 'auth', challengeId: string): Promise<T> {
    const raw = await this.redis.connection.get(challengeKey(kind, challengeId));
    if (!raw) throw DomainError.webauthnFailed('This passkey request has expired');
    return JSON.parse(raw) as T;
  }
}

function challengeKey(kind: 'reg' | 'auth', challengeId: string): string {
  return `auth:webauthn:${kind}:${challengeId}`;
}

function uuidToBytes(uuid: string): Uint8Array<ArrayBuffer> {
  const hex = uuid.replace(/-/gu, '');
  const bytes = new Uint8Array(new ArrayBuffer(16));
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
