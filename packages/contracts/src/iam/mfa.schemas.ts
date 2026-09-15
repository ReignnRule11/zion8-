import { z } from 'zod';
import { uuidSchema } from '../common/primitives';
import { otpCodeSchema } from './identity.schemas';
import { assuranceLevelSchema } from './session.schemas';

export const MfaFactorType = {
  TOTP: 'TOTP',
  WEBAUTHN: 'WEBAUTHN',
} as const;

export type MfaFactorType = (typeof MfaFactorType)[keyof typeof MfaFactorType];

export const mfaFactorTypeSchema = z.enum(
  Object.values(MfaFactorType) as [MfaFactorType, ...MfaFactorType[]],
);

export const MfaFactorStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;

export type MfaFactorStatus = (typeof MfaFactorStatus)[keyof typeof MfaFactorStatus];

export const mfaFactorStatusSchema = z.enum(
  Object.values(MfaFactorStatus) as [MfaFactorStatus, ...MfaFactorStatus[]],
);

export const mfaFactorSummarySchema = z.object({
  id: uuidSchema,
  type: mfaFactorTypeSchema,
  status: mfaFactorStatusSchema,
  name: z.string(),
  confirmedAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type MfaFactorSummary = z.infer<typeof mfaFactorSummarySchema>;

export const mfaFactorListResponseSchema = z.object({
  factors: z.array(mfaFactorSummarySchema),
  recoveryCodesRemaining: z.number().int().nonnegative(),
});

export type MfaFactorListResponse = z.infer<typeof mfaFactorListResponseSchema>;

export const mfaRequiredResponseSchema = z.object({
  mfaRequired: z.literal(true),
  mfaToken: z.string().min(32).max(512),
  factors: z.array(
    z.object({
      id: uuidSchema,
      type: mfaFactorTypeSchema,
      name: z.string(),
    }),
  ),
});

export type MfaRequiredResponse = z.infer<typeof mfaRequiredResponseSchema>;

export const totpEnrollmentRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).default('Authenticator app'),
});

export type TotpEnrollmentRequest = z.infer<typeof totpEnrollmentRequestSchema>;

export const totpEnrollmentResponseSchema = z.object({
  factorId: uuidSchema,
  type: z.literal('TOTP'),
  secret: z.string(),
  otpauthUri: z.string(),
});

export type TotpEnrollmentResponse = z.infer<typeof totpEnrollmentResponseSchema>;

export const mfaConfirmTotpSchema = z.object({
  factorId: uuidSchema,
  code: otpCodeSchema,
});

export type MfaConfirmTotpRequest = z.infer<typeof mfaConfirmTotpSchema>;

export const mfaConfirmResponseSchema = z.object({
  factor: mfaFactorSummarySchema,
  recoveryCodes: z.array(z.string()),
});

export type MfaConfirmResponse = z.infer<typeof mfaConfirmResponseSchema>;

export const mfaVerifyTotpSchema = z.object({
  mfaToken: z.string().min(32).max(512),
  code: otpCodeSchema,
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type MfaVerifyTotpRequest = z.infer<typeof mfaVerifyTotpSchema>;

export const mfaVerifyRecoveryCodeSchema = z.object({
  mfaToken: z.string().min(32).max(512),
  recoveryCode: z.string().trim().min(8).max(64),
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type MfaVerifyRecoveryCodeRequest = z.infer<typeof mfaVerifyRecoveryCodeSchema>;

export const mfaDisableSchema = z.object({
  factorId: uuidSchema,
});

export type MfaDisableRequest = z.infer<typeof mfaDisableSchema>;

export const mfaRegenerateRecoveryCodesSchema = z.object({
  password: z.string().min(1).max(128),
});

export type MfaRegenerateRecoveryCodesRequest = z.infer<
  typeof mfaRegenerateRecoveryCodesSchema
>;

export const mfaRecoveryCodesResponseSchema = z.object({
  recoveryCodes: z.array(z.string()),
});

export type MfaRecoveryCodesResponse = z.infer<typeof mfaRecoveryCodesResponseSchema>;

export const mfaSessionStateSchema = z.object({
  enrolled: z.boolean(),
  assuranceLevel: assuranceLevelSchema,
  factors: z.array(mfaFactorSummarySchema),
});

export type MfaSessionState = z.infer<typeof mfaSessionStateSchema>;
