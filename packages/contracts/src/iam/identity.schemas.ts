import { z } from 'zod';
import { emailSchema, phoneSchema, uuidSchema } from '../common/primitives';
import { passwordSchema } from '../common/primitives';

export const IdentityProvider = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
  MICROSOFT: 'MICROSOFT',
} as const;

export type IdentityProvider = (typeof IdentityProvider)[keyof typeof IdentityProvider];

export const identityProviderSchema = z.enum(
  Object.values(IdentityProvider) as [IdentityProvider, ...IdentityProvider[]],
);

export const ChallengePurpose = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PHONE_VERIFICATION: 'PHONE_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  MAGIC_LINK: 'MAGIC_LINK',
  EMAIL_OTP: 'EMAIL_OTP',
  SMS_OTP: 'SMS_OTP',
  CHANGE_EMAIL: 'CHANGE_EMAIL',
  CHANGE_PHONE: 'CHANGE_PHONE',
} as const;

export type ChallengePurpose = (typeof ChallengePurpose)[keyof typeof ChallengePurpose];

export const challengePurposeSchema = z.enum(
  Object.values(ChallengePurpose) as [ChallengePurpose, ...ChallengePurpose[]],
);

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Code must be exactly 6 digits');

export const challengeTokenSchema = z.string().min(32).max(512);

const contactObjectSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

function requireSingleContact<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const { email, phone } = value as { email?: string; phone?: string };
    if (Boolean(email) === Boolean(phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of email or phone',
        path: ['email'],
      });
    }
  });
}

export const contactSchema = requireSingleContact(contactObjectSchema);

export const passwordLoginSchema = requireSingleContact(
  contactObjectSchema.extend({
    password: z.string().min(1, 'Password is required').max(128),
    tenantSlug: z.string().min(3).max(40).optional(),
  }),
);

export type PasswordLoginRequest = z.infer<typeof passwordLoginSchema>;

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkConsumeSchema = z.object({
  token: challengeTokenSchema,
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type MagicLinkConsumeRequest = z.infer<typeof magicLinkConsumeSchema>;

export const otpRequestSchema = contactSchema;

export type OtpRequestBody = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = requireSingleContact(
  contactObjectSchema.extend({
    code: otpCodeSchema,
    tenantSlug: z.string().min(3).max(40).optional(),
  }),
);

export type OtpVerifyRequest = z.infer<typeof otpVerifySchema>;

export const emailVerificationConsumeSchema = z.object({
  token: challengeTokenSchema,
});

export type EmailVerificationConsumeRequest = z.infer<typeof emailVerificationConsumeSchema>;

export const phoneVerificationRequestSchema = z.object({
  phone: phoneSchema,
});

export type PhoneVerificationRequest = z.infer<typeof phoneVerificationRequestSchema>;

export const phoneVerificationConsumeSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export type PhoneVerificationConsumeRequest = z.infer<typeof phoneVerificationConsumeSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConsumeSchema = z.object({
  token: challengeTokenSchema,
  newPassword: passwordSchema,
});

export type PasswordResetConsumeRequest = z.infer<typeof passwordResetConsumeSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export const identitySummarySchema = z.object({
  id: uuidSchema,
  provider: identityProviderSchema,
  providerAccountId: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
  verifiedAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type IdentitySummary = z.infer<typeof identitySummarySchema>;
