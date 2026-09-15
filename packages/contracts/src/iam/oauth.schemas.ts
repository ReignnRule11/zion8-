import { z } from 'zod';

export const OAuthProvider = {
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
  MICROSOFT: 'MICROSOFT',
} as const;

export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

export const oauthProviderSchema = z.enum(
  Object.values(OAuthProvider) as [OAuthProvider, ...OAuthProvider[]],
);

export const oauthStartQuerySchema = z.object({
  redirectPath: z.string().max(512).optional(),
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type OAuthStartQuery = z.infer<typeof oauthStartQuerySchema>;

export const oauthStartResponseSchema = z.object({
  authorizationUrl: z.string().url(),
  state: z.string(),
});

export type OAuthStartResponse = z.infer<typeof oauthStartResponseSchema>;

export const oauthCallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(512),
});

export type OAuthCallbackRequest = z.infer<typeof oauthCallbackSchema>;
