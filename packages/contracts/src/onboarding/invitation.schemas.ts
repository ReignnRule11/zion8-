import { z } from 'zod';
import { emailSchema, personNameSchema, uuidSchema } from '../common/primitives';
import { roleSchema } from '../iam/roles';

/**
 * Administrator invitations. The invitation is the business record (who, what
 * role, whether it was accepted, how many times it was sent); the bearer token
 * itself is issued through the shared VerificationChallenge primitive.
 */

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const invitationStatusSchema = z.enum(
  Object.values(InvitationStatus) as [InvitationStatus, ...InvitationStatus[]],
);

/**
 * Only roles below the inviter are assignable, and ministry-level roles are not
 * offered during onboarding: the first invitations are for people who will run
 * the workspace alongside the owner.
 */
export const INVITABLE_ONBOARDING_ROLES = [
  'ADMINISTRATOR',
  'SENIOR_PASTOR',
  'FINANCE_OFFICER',
  'MINISTRY_LEADER',
] as const;

export const invitableOnboardingRoleSchema = z.enum(
  INVITABLE_ONBOARDING_ROLES as unknown as [
    (typeof INVITABLE_ONBOARDING_ROLES)[number],
    ...(typeof INVITABLE_ONBOARDING_ROLES)[number][],
  ],
);

export const inviteAdministratorsSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: emailSchema,
        firstName: personNameSchema.optional(),
        lastName: personNameSchema.optional(),
        role: invitableOnboardingRoleSchema,
      }),
    )
    .min(1, 'Invite at least one administrator')
    .max(50, 'Invite at most 50 administrators at a time'),
});

export type InviteAdministratorsRequest = z.infer<typeof inviteAdministratorsSchema>;

export const invitationSummarySchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: roleSchema,
  status: invitationStatusSchema,
  invitedByUserId: uuidSchema.nullable(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  lastSentAt: z.string().datetime(),
  resendCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type InvitationSummary = z.infer<typeof invitationSummarySchema>;

export const invitationListResponseSchema = z.object({
  invitations: z.array(invitationSummarySchema),
});

export type InvitationListResponse = z.infer<typeof invitationListResponseSchema>;

export const invitationTokenSchema = z.object({
  token: z.string().min(16).max(512),
});

export type InvitationTokenRequest = z.infer<typeof invitationTokenSchema>;

/** Public projection returned before the invitee has an account. */
export const invitationPreviewSchema = z.object({
  tenantName: z.string(),
  tenantSlug: z.string(),
  email: z.string().email(),
  role: roleSchema,
  invitedByName: z.string().nullable(),
  expiresAt: z.string().datetime(),
  status: invitationStatusSchema,
  accountExists: z.boolean(),
});

export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(16).max(512),
  firstName: personNameSchema.optional(),
  lastName: personNameSchema.optional(),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128).optional(),
});

export type AcceptInvitationRequest = z.infer<typeof acceptInvitationSchema>;

export const declineInvitationSchema = z.object({
  token: z.string().min(16).max(512),
});

export type DeclineInvitationRequest = z.infer<typeof declineInvitationSchema>;
