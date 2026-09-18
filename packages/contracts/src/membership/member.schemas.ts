import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { emailSchema, personNameSchema, phoneSchema, uuidSchema } from '../common/primitives';

/**
 * The Member aggregate: the church's own record of a person.
 *
 * A Member is deliberately separate from the global `User` identity. Most
 * people in a congregation never sign in, and a church must be able to keep a
 * pastoral record for someone who has no account. When a member does get an
 * account, `userId` links the two without merging the church's record into the
 * global identity model.
 */

export const MemberStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TRANSFERRED: 'TRANSFERRED',
  DECEASED: 'DECEASED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const memberStatusSchema = z.enum(
  Object.values(MemberStatus) as [MemberStatus, ...MemberStatus[]],
);

export const MemberGender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  UNDISCLOSED: 'UNDISCLOSED',
} as const;

export type MemberGender = (typeof MemberGender)[keyof typeof MemberGender];

export const memberGenderSchema = z.enum(
  Object.values(MemberGender) as [MemberGender, ...MemberGender[]],
);

export const MaritalStatus = {
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  WIDOWED: 'WIDOWED',
  DIVORCED: 'DIVORCED',
  SEPARATED: 'SEPARATED',
  UNDISCLOSED: 'UNDISCLOSED',
} as const;

export type MaritalStatus = (typeof MaritalStatus)[keyof typeof MaritalStatus];

export const maritalStatusSchema = z.enum(
  Object.values(MaritalStatus) as [MaritalStatus, ...MaritalStatus[]],
);

/** Statuses that mean the record is no longer part of the active congregation. */
export const INACTIVE_MEMBER_STATUSES: readonly MemberStatus[] = [
  MemberStatus.INACTIVE,
  MemberStatus.TRANSFERRED,
  MemberStatus.DECEASED,
  MemberStatus.ARCHIVED,
];

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date such as 1990-04-27');

const tagSchema = z.string().trim().min(1).max(40);

export const memberSchema = z.object({
  firstName: personNameSchema,
  middleName: z.string().trim().max(120).optional(),
  lastName: personNameSchema,
  preferredName: z.string().trim().max(120).optional(),
  status: memberStatusSchema.default('ACTIVE'),
  gender: memberGenderSchema.default('UNDISCLOSED'),
  maritalStatus: maritalStatusSchema.default('UNDISCLOSED'),
  dateOfBirth: isoDateSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  photoUrl: z.string().trim().url().max(2048).optional(),
  addressLine1: z.string().trim().max(180).optional(),
  addressLine2: z.string().trim().max(180).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code')
    .transform((value) => value.toUpperCase())
    .optional(),
  joinedAt: isoDateSchema.optional(),
  baptizedAt: isoDateSchema.optional(),
  notes: z.string().trim().max(4000).optional(),
  tags: z.array(tagSchema).max(25).default([]),
  customFields: z.record(z.union([z.string().max(500), z.number(), z.boolean()])).default({}),
});

export type MemberInput = z.input<typeof memberSchema>;
export type MemberRequest = z.output<typeof memberSchema>;

/** Every field optional: an update is a sparse patch, `null` clears a value. */
export const memberUpdateSchema = memberSchema.partial().extend({
  middleName: z.string().trim().max(120).nullable().optional(),
  preferredName: z.string().trim().max(120).nullable().optional(),
  dateOfBirth: isoDateSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  photoUrl: z.string().trim().url().max(2048).nullable().optional(),
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
  joinedAt: isoDateSchema.nullable().optional(),
  baptizedAt: isoDateSchema.nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  userId: uuidSchema.nullable().optional(),
});

export type MemberUpdateRequest = z.infer<typeof memberUpdateSchema>;

export const memberListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: memberStatusSchema.optional(),
  gender: memberGenderSchema.optional(),
  maritalStatus: maritalStatusSchema.optional(),
  departmentId: uuidSchema.optional(),
  familyId: uuidSchema.optional(),
  volunteerRoleId: uuidSchema.optional(),
  tag: tagSchema.optional(),
  joinedAfter: isoDateSchema.optional(),
  joinedBefore: isoDateSchema.optional(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;

export const memberSummarySchema = z.object({
  id: uuidSchema,
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string().nullable(),
  preferredName: z.string().nullable(),
  fullName: z.string(),
  status: memberStatusSchema,
  gender: memberGenderSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  photoUrl: z.string().nullable(),
  joinedAt: z.string().datetime().nullable(),
  userId: uuidSchema.nullable(),
  tags: z.array(z.string()),
  familyCount: z.number().int().min(0),
  departmentCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemberSummary = z.infer<typeof memberSummarySchema>;

export const memberResponseSchema = memberSchema.extend({
  id: uuidSchema,
  tenantId: uuidSchema,
  userId: uuidSchema.nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemberResponse = z.infer<typeof memberResponseSchema>;

export const memberPageSchema = paginatedSchema(memberSummarySchema);

export type MemberPage = z.infer<typeof memberPageSchema>;
