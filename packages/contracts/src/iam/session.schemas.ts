import { z } from 'zod';
import { uuidSchema } from '../common/primitives';

export const SessionStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const sessionStatusSchema = z.enum(
  Object.values(SessionStatus) as [SessionStatus, ...SessionStatus[]],
);

export const AssuranceLevel = {
  AAL1: 'AAL1',
  AAL2: 'AAL2',
  AAL3: 'AAL3',
} as const;

export type AssuranceLevel = (typeof AssuranceLevel)[keyof typeof AssuranceLevel];

export const assuranceLevelSchema = z.enum(
  Object.values(AssuranceLevel) as [AssuranceLevel, ...AssuranceLevel[]],
);

export const AuthenticationMethod = {
  PASSWORD: 'PASSWORD',
  MAGIC_LINK: 'MAGIC_LINK',
  OTP: 'OTP',
  OAUTH: 'OAUTH',
  WEBAUTHN: 'WEBAUTHN',
  TOTP: 'TOTP',
  RECOVERY_CODE: 'RECOVERY_CODE',
  REFRESH: 'REFRESH',
} as const;

export type AuthenticationMethod = (typeof AuthenticationMethod)[keyof typeof AuthenticationMethod];

export const authenticationMethodSchema = z.enum(
  Object.values(AuthenticationMethod) as [AuthenticationMethod, ...AuthenticationMethod[]],
);

export const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  refreshExpiresIn: z.number().int().positive(),
  sessionId: uuidSchema,
  assuranceLevel: assuranceLevelSchema,
  mfaSatisfied: z.boolean(),
});

export type Session = z.infer<typeof sessionSchema>;

export const authSessionSummarySchema = z.object({
  id: uuidSchema,
  deviceName: z.string().nullable(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  status: sessionStatusSchema,
  assuranceLevel: assuranceLevelSchema,
  current: z.boolean(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  lastAuthenticatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export type AuthSessionSummary = z.infer<typeof authSessionSummarySchema>;

export const sessionListResponseSchema = z.object({
  sessions: z.array(authSessionSummarySchema),
});

export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

export const revokeSessionSchema = z.object({
  sessionId: uuidSchema,
});

export type RevokeSessionRequest = z.infer<typeof revokeSessionSchema>;
