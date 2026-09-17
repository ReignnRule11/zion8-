import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Families group members who live or worship as a household. A family is an
 * aggregate in its own right because it is the unit the church visits, gives
 * pastoral care to, and records giving against.
 */

export const FamilyRole = {
  HEAD: 'HEAD',
  SPOUSE: 'SPOUSE',
  CHILD: 'CHILD',
  PARENT: 'PARENT',
  SIBLING: 'SIBLING',
  RELATIVE: 'RELATIVE',
  GUARDIAN: 'GUARDIAN',
  WARD: 'WARD',
  OTHER: 'OTHER',
} as const;

export type FamilyRole = (typeof FamilyRole)[keyof typeof FamilyRole];

export const familyRoleSchema = z.enum(
  Object.values(FamilyRole) as [FamilyRole, ...FamilyRole[]],
);

export const FamilyStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type FamilyStatus = (typeof FamilyStatus)[keyof typeof FamilyStatus];

export const familyStatusSchema = z.enum(
  Object.values(FamilyStatus) as [FamilyStatus, ...FamilyStatus[]],
);

export const familySchema = z.object({
  name: z.string().trim().min(2).max(120),
  status: familyStatusSchema.default('ACTIVE'),
  addressLine1: z.string().trim().max(180).optional(),
  addressLine2: z.string().trim().max(180).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  homePhone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type FamilyInput = z.input<typeof familySchema>;
export type FamilyRequest = z.output<typeof familySchema>;

export const familyUpdateSchema = familySchema.partial().extend({
  addressLine1: z.string().trim().max(180).nullable().optional(),
  addressLine2: z.string().trim().max(180).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(32).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  homePhone: z.string().trim().max(32).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type FamilyUpdateRequest = z.infer<typeof familyUpdateSchema>;

export const familyMemberAddSchema = z.object({
  memberId: uuidSchema,
  role: familyRoleSchema.default('OTHER'),
});

export type FamilyMemberAddRequest = z.infer<typeof familyMemberAddSchema>;

export const familyMemberSchema = z.object({
  id: uuidSchema,
  familyId: uuidSchema,
  memberId: uuidSchema,
  memberName: z.string(),
  memberStatus: z.string(),
  role: familyRoleSchema,
  createdAt: z.string().datetime(),
});

export type FamilyMember = z.infer<typeof familyMemberSchema>;

export const familySummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  status: familyStatusSchema,
  city: z.string().nullable(),
  memberCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FamilySummary = z.infer<typeof familySummarySchema>;

export const familyResponseSchema = familySchema.extend({
  id: uuidSchema,
  tenantId: uuidSchema,
  members: z.array(familyMemberSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FamilyResponse = z.infer<typeof familyResponseSchema>;

export const familyListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: familyStatusSchema.optional(),
  memberId: uuidSchema.optional(),
});

export type FamilyListQuery = z.infer<typeof familyListQuerySchema>;

export const familyPageSchema = paginatedSchema(familySummarySchema);

export type FamilyPage = z.infer<typeof familyPageSchema>;
