import { z } from 'zod';
import { personNameSchema, slugSchema, uuidSchema } from '../common/primitives';
import { roleSchema } from '../iam/roles';

export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const tenantStatusSchema = z.enum(
  Object.values(TenantStatus) as [TenantStatus, ...TenantStatus[]],
);

export const tenantSummarySchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().min(2).max(120),
  status: tenantStatusSchema,
  createdAt: z.string().datetime(),
});

export type TenantSummary = z.infer<typeof tenantSummarySchema>;

export const churchWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Church name is required').max(120),
  slug: slugSchema,
  timezone: z.string().min(1).max(64).default('UTC'),
  locale: z.string().min(2).max(10).default('en'),
});

export type ChurchWorkspaceInput = z.infer<typeof churchWorkspaceSchema>;

export const membershipSummarySchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  tenantName: z.string(),
  tenantSlug: slugSchema,
  role: roleSchema,
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']),
  createdAt: z.string().datetime(),
});

export type MembershipSummary = z.infer<typeof membershipSummarySchema>;

export const principalSchema = z.object({
  userId: uuidSchema,
  email: z.string().email(),
  firstName: personNameSchema,
  lastName: personNameSchema,
  isPlatformAdmin: z.boolean(),
});

export type Principal = z.infer<typeof principalSchema>;
