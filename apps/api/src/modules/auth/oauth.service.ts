import { Injectable } from '@nestjs/common';
import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from 'jose';
import { IdentityProvider, UserStatus } from '@prisma/client';
import type { OAuthProvider } from '@zion8/contracts';
import { AppConfigService } from '../../common/config/app-config.service';
import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { DomainError } from '../../common/errors/domain-error';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

const STATE_TTL_SECONDS = 600;

interface ProviderEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  issuer: string | string[];
  scopes: string;
  clientId: string;
  clientSecret: () => Promise<string>;
  provider: IdentityProvider;
}

interface StoredState {
  provider: OAuthProvider;
  codeVerifier: string;
  nonce: string;
  redirectPath?: string;
  tenantSlug?: string;
}

export interface OAuthProfile {
  userId: string;
  provider: IdentityProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  tenantSlug?: string;
}

@Injectable()
export class OAuthService {
  private readonly jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBoxService,
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async start(
    provider: OAuthProvider,
    input: { redirectPath?: string; tenantSlug?: string },
  ): Promise<{ authorizationUrl: string; state: string }> {
    const endpoints = await this.endpoints(provider);
    const state = this.secrets.randomToken(24);
    const codeVerifier = this.secrets.randomToken(32);
    const nonce = this.secrets.randomToken(16);

    await this.redis.setIfAbsent(
      stateKey(state),
      JSON.stringify({ provider, codeVerifier, nonce, ...input } satisfies StoredState),
      STATE_TTL_SECONDS,
    );

    const url = new URL(endpoints.authorizationEndpoint);
    url.searchParams.set('client_id', endpoints.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri(provider));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', endpoints.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', await this.codeChallenge(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
    if (provider === 'MICROSOFT') {
      url.searchParams.set('response_mode', 'query');
    }
    if (provider === 'APPLE') {
      url.searchParams.set('response_mode', 'form_post');
    }

    return { authorizationUrl: url.toString(), state };
  }

  async resolveProfile(provider: OAuthProvider, input: { code: string; state: string }): Promise<OAuthProfile> {
    const raw = await this.redis.connection.get(stateKey(input.state));
    if (!raw) throw DomainError.oauthFailed('This sign-in attempt has expired. Please try again.');
    await this.redis.delete(stateKey(input.state));

    const stored = JSON.parse(raw) as StoredState;
    if (stored.provider !== provider) throw DomainError.oauthFailed();

    const endpoints = await this.endpoints(provider);
    const tokens = await this.exchangeCode(endpoints, input.code, stored.codeVerifier);
    const claims = await this.verifyIdToken(endpoints, tokens.id_token, stored.nonce);

    const accountId = typeof claims.sub === 'string' ? claims.sub : null;
    if (!accountId) throw DomainError.oauthFailed();

    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
    const emailVerified = claims.email_verified === true;
    const { firstName, lastName } = splitName(claims, email);

    const userId = await this.resolveUser({
      provider: endpoints.provider,
      accountId,
      email,
      emailVerified,
      firstName,
      lastName,
      avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
    });

    return {
      userId,
      provider: endpoints.provider,
      providerAccountId: accountId,
      email,
      emailVerified,
      firstName,
      lastName,
      avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
      tenantSlug: stored.tenantSlug,
    };
  }

  async endpoints(provider: OAuthProvider): Promise<ProviderEndpoints> {
    const oauth = this.config.oauth;
    switch (provider) {
      case 'GOOGLE': {
        if (!oauth.google.clientId || !oauth.google.clientSecret) {
          throw DomainError.oauthProviderUnavailable('Google sign-in is not configured');
        }
        return {
          provider: IdentityProvider.GOOGLE,
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
          jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          scopes: 'openid email profile',
          clientId: oauth.google.clientId,
          clientSecret: async () => oauth.google.clientSecret,
        };
      }
      case 'MICROSOFT': {
        if (!oauth.microsoft.clientId || !oauth.microsoft.clientSecret) {
          throw DomainError.oauthProviderUnavailable('Microsoft sign-in is not configured');
        }
        const tenant = oauth.microsoft.tenantId || 'common';
        return {
          provider: IdentityProvider.MICROSOFT,
          authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
          tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
          jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
          issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
          scopes: 'openid email profile',
          clientId: oauth.microsoft.clientId,
          clientSecret: async () => oauth.microsoft.clientSecret,
        };
      }
      case 'APPLE': {
        if (!oauth.apple.clientId || !oauth.apple.privateKey) {
          throw DomainError.oauthProviderUnavailable('Apple sign-in is not configured');
        }
        return {
          provider: IdentityProvider.APPLE,
          authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
          tokenEndpoint: 'https://appleid.apple.com/auth/token',
          jwksUri: 'https://appleid.apple.com/auth/keys',
          issuer: 'https://appleid.apple.com',
          scopes: 'openid email name',
          clientId: oauth.apple.clientId,
          clientSecret: () => this.appleClientSecret(),
        };
      }
      default:
        throw DomainError.oauthProviderUnavailable();
    }
  }

  private async exchangeCode(
    endpoints: ProviderEndpoints,
    code: string,
    codeVerifier: string,
  ): Promise<{ id_token?: string }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(providerName(endpoints.provider)),
      client_id: endpoints.clientId,
      code_verifier: codeVerifier,
    });

    const clientSecret = await endpoints.clientSecret();
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await fetch(endpoints.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      this.logger.warn(`OAuth token exchange failed (${response.status})`, 'OAuthService');
      throw DomainError.oauthFailed();
    }

    return (await response.json()) as { id_token?: string };
  }

  private async verifyIdToken(
    endpoints: ProviderEndpoints,
    idToken: string | undefined,
    nonce: string,
  ): Promise<JWTPayload> {
    if (!idToken) throw DomainError.oauthFailed('The provider did not return an identity token');

    const jwks = this.jwks(endpoints.jwksUri);
    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: endpoints.issuer,
        audience: endpoints.clientId,
      });
      if (payload.nonce && payload.nonce !== nonce) {
        throw DomainError.oauthFailed();
      }
      return payload;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.logger.warn(
        `ID token verification failed: ${error instanceof Error ? error.message : String(error)}`,
        'OAuthService',
      );
      throw DomainError.oauthFailed();
    }
  }

  private jwks(uri: string) {
    const cached = this.jwksCache.get(uri);
    if (cached) return cached;
    const created = createRemoteJWKSet(new URL(uri));
    this.jwksCache.set(uri, created);
    return created;
  }

  private async resolveUser(input: {
    provider: IdentityProvider;
    accountId: string;
    email: string | null;
    emailVerified: boolean;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  }): Promise<string> {
    const existing = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: input.provider,
            providerAccountId: input.accountId,
          },
        },
        select: { userId: true },
      }),
    );

    if (existing) {
      await this.prisma.withScope({ userId: existing.userId, isPlatformAdmin: true }, (tx) =>
        tx.userIdentity.update({
          where: {
            provider_providerAccountId: {
              provider: input.provider,
              providerAccountId: input.accountId,
            },
          },
          data: { lastUsedAt: new Date(), profile: profileJson(input.avatarUrl) },
        }),
      );
      return existing.userId;
    }

    return this.prisma.withScope({ isPlatformAdmin: true }, async (tx) => {
      const linkedUser =
        input.email && input.emailVerified
          ? await tx.userIdentity.findFirst({
              where: { provider: IdentityProvider.EMAIL, providerAccountId: input.email },
              select: { userId: true },
            })
          : null;

      const contactUser =
        linkedUser || !input.email
          ? null
          : await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });

      const userId =
        linkedUser?.userId ??
        contactUser?.id ??
        (
          await tx.user.create({
            data: {
              email: input.email && input.emailVerified ? input.email : null,
              emailVerifiedAt: input.email && input.emailVerified ? new Date() : null,
              firstName: input.firstName,
              lastName: input.lastName,
              status: UserStatus.ACTIVE,
            },
            select: { id: true },
          })
        ).id;

      await tx.userIdentity.create({
        data: {
          userId,
          provider: input.provider,
          providerAccountId: input.accountId,
          email: input.email,
          isPrimary: !linkedUser,
          verifiedAt: input.emailVerified ? new Date() : null,
          profile: profileJson(input.avatarUrl),
          lastUsedAt: new Date(),
        },
      });

      return userId;
    });
  }

  private async appleClientSecret(): Promise<string> {
    const { clientId, teamId, keyId, privateKey } = this.config.oauth.apple;
    const key = await importPKCS8(privateKey, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setAudience('https://appleid.apple.com')
      .setSubject(clientId)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(key);
  }

  private async codeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return Buffer.from(new Uint8Array(digest)).toString('base64url');
  }

  private redirectUri(provider: OAuthProvider): string {
    const base = this.config.appBaseUrl.replace(/\/+$/u, '');
    return `${base}/${this.config.globalPrefix}/v${this.config.apiVersion}/auth/oauth/${provider.toLowerCase()}/callback`;
  }
}

function stateKey(state: string): string {
  return `auth:oauth:state:${state}`;
}

function providerName(provider: IdentityProvider): OAuthProvider {
  return provider as unknown as OAuthProvider;
}

function profileJson(avatarUrl: string | null) {
  return avatarUrl ? { avatarUrl } : {};
}

function splitName(claims: JWTPayload, email: string | null): { firstName: string; lastName: string } {
  const given = typeof claims.given_name === 'string' ? claims.given_name : null;
  const family = typeof claims.family_name === 'string' ? claims.family_name : null;
  if (given || family) {
    return { firstName: given ?? 'Member', lastName: family ?? '' };
  }
  const name = typeof claims.name === 'string' ? claims.name : null;
  if (name) {
    const [first, ...rest] = name.trim().split(/\s+/u);
    return { firstName: first || 'Member', lastName: rest.join(' ') };
  }
  const local = email ? (email.split('@')[0] ?? 'Member') : 'Member';
  return { firstName: local || 'Member', lastName: '' };
}
