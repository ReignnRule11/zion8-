import { Injectable } from '@nestjs/common';
import { IdentityProvider, Prisma, UserStatus } from '@prisma/client';
import type { IdentitySummary } from '@zion8/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface LoginUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: UserStatus;
  isPlatformAdmin: boolean;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
}

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<{ userId: string } | null> {
    return this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: IdentityProvider.EMAIL,
            providerAccountId: email,
          },
        },
        select: { userId: true },
      }),
    );
  }

  async findByPhone(phone: string): Promise<{ userId: string } | null> {
    return this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: IdentityProvider.PHONE,
            providerAccountId: phone,
          },
        },
        select: { userId: true },
      }),
    );
  }

  async resolveUser(input: { email?: string; phone?: string }): Promise<LoginUser | null> {
    const identity = input.email
      ? await this.findByEmail(input.email)
      : input.phone
        ? await this.findByPhone(input.phone)
        : null;
    if (!identity) return null;
    return this.loadUser(identity.userId);
  }

  async loadUser(userId: string): Promise<LoginUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        status: true,
        isPlatformAdmin: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
      },
    });
    return user;
  }

  async passwordHashFor(userId: string): Promise<string | null> {
    const credential = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.passwordCredential.findUnique({
        where: { userId },
        select: { passwordHash: true, needsRehash: true },
      }),
    );
    return credential?.passwordHash ?? null;
  }

  async passwordNeedsRehash(userId: string): Promise<boolean> {
    const credential = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.passwordCredential.findUnique({ where: { userId }, select: { needsRehash: true } }),
    );
    return credential?.needsRehash ?? false;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.passwordCredential.upsert({
        where: { userId },
        create: { userId, passwordHash, algorithm: 'argon2id' },
        update: { passwordHash, passwordChangedAt: new Date(), needsRehash: false },
      }),
    );
  }

  async attachEmailIdentity(input: {
    userId: string;
    email: string;
    verified: boolean;
    isPrimary?: boolean;
  }): Promise<void> {
    await this.prisma.withScope({ userId: input.userId, isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.upsert({
        where: {
          provider_providerAccountId: {
            provider: IdentityProvider.EMAIL,
            providerAccountId: input.email,
          },
        },
        create: {
          userId: input.userId,
          provider: IdentityProvider.EMAIL,
          providerAccountId: input.email,
          email: input.email,
          isPrimary: input.isPrimary ?? true,
          verifiedAt: input.verified ? new Date() : null,
        },
        update: {
          email: input.email,
          ...(input.verified ? { verifiedAt: new Date() } : {}),
        },
      }),
    );
  }

  async markContactVerified(input: {
    userId: string;
    provider: IdentityProvider;
    identifier: string;
  }): Promise<void> {
    const now = new Date();
    await this.prisma.withScope({ userId: input.userId, isPlatformAdmin: true }, async (tx) => {
      await tx.userIdentity.updateMany({
        where: {
          userId: input.userId,
          provider: input.provider,
          providerAccountId: input.identifier,
        },
        data: { verifiedAt: now, lastUsedAt: now },
      });

      if (input.provider === IdentityProvider.EMAIL) {
        await tx.user.update({ where: { id: input.userId }, data: { emailVerifiedAt: now } });
      } else if (input.provider === IdentityProvider.PHONE) {
        await tx.user.update({ where: { id: input.userId }, data: { phoneVerifiedAt: now } });
      }
    });
  }

  async listIdentities(userId: string): Promise<IdentitySummary[]> {
    const identities = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    );

    return identities.map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      email: identity.email,
      phone: identity.phone,
      isPrimary: identity.isPrimary,
      verifiedAt: identity.verifiedAt ? identity.verifiedAt.toISOString() : null,
      lastUsedAt: identity.lastUsedAt ? identity.lastUsedAt.toISOString() : null,
      createdAt: identity.createdAt.toISOString(),
    }));
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  isUniqueViolation(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }
    const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]) : [];
    return target.includes(field);
  }
}
