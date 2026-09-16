import { z } from 'zod';
import { emailSchema, personNameSchema, phoneSchema, uuidSchema } from '../common/primitives';

/**
 * First member import. The import is a two-phase job so that a large file
 * cannot be half-applied: `preview` parses and validates into a persisted job,
 * `commit` applies the validated rows in resumable chunks.
 */

export const MEMBER_IMPORT_ROLES = [
  'SENIOR_PASTOR',
  'ADMINISTRATOR',
  'FINANCE_OFFICER',
  'MINISTRY_LEADER',
  'VOLUNTEER',
  'MEMBER',
  'VISITOR',
] as const;

export const memberImportRoleSchema = z.enum(
  MEMBER_IMPORT_ROLES as unknown as [
    (typeof MEMBER_IMPORT_ROLES)[number],
    ...(typeof MEMBER_IMPORT_ROLES)[number][],
  ],
);

/** Columns the CSV importer understands. Unknown columns are ignored. */
export const MEMBER_IMPORT_COLUMNS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'role',
  'joined_at',
] as const;

export const memberImportRowSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  role: memberImportRoleSchema.default('MEMBER'),
  joinedAt: z.string().datetime().optional(),
});

export type MemberImportRow = z.infer<typeof memberImportRowSchema>;

export const MAX_IMPORT_ROWS = 5000;

export const memberImportPreviewSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255).optional(),
    csv: z.string().min(1).max(5_000_000).optional(),
    rows: z.array(z.unknown()).max(MAX_IMPORT_ROWS).optional(),
  })
  .refine((value) => value.csv !== undefined || value.rows !== undefined, {
    message: 'Provide either a CSV document or an array of rows',
    path: ['csv'],
  });

export type MemberImportPreviewRequest = z.infer<typeof memberImportPreviewSchema>;

export const MemberImportErrorCode = {
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_ROLE: 'INVALID_ROLE',
  INVALID_DATE: 'INVALID_DATE',
  DUPLICATE_IN_FILE: 'DUPLICATE_IN_FILE',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  UNKNOWN_COLUMN: 'UNKNOWN_COLUMN',
} as const;

export type MemberImportErrorCode =
  (typeof MemberImportErrorCode)[keyof typeof MemberImportErrorCode];

export const memberImportErrorCodeSchema = z.enum(
  Object.values(MemberImportErrorCode) as [MemberImportErrorCode, ...MemberImportErrorCode[]],
);

export const memberImportIssueSchema = z.object({
  row: z.number().int().min(1),
  field: z.string().nullable(),
  code: memberImportErrorCodeSchema,
  message: z.string(),
  severity: z.enum(['ERROR', 'WARNING']),
});

export type MemberImportIssue = z.infer<typeof memberImportIssueSchema>;

export const MemberImportStatus = {
  READY: 'READY',
  IMPORTING: 'IMPORTING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type MemberImportStatus = (typeof MemberImportStatus)[keyof typeof MemberImportStatus];

export const memberImportStatusSchema = z.enum(
  Object.values(MemberImportStatus) as [MemberImportStatus, ...MemberImportStatus[]],
);

export const memberImportJobSchema = z.object({
  id: uuidSchema,
  status: memberImportStatusSchema,
  fileName: z.string().nullable(),
  totalRows: z.number().int().min(0),
  validRows: z.number().int().min(0),
  invalidRows: z.number().int().min(0),
  importedRows: z.number().int().min(0),
  skippedRows: z.number().int().min(0),
  duplicateRows: z.number().int().min(0),
  resumeIndex: z.number().int().min(0),
  issues: z.array(memberImportIssueSchema),
  createdByUserId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export type MemberImportJob = z.infer<typeof memberImportJobSchema>;

export const memberImportPreviewResponseSchema = z.object({
  job: memberImportJobSchema,
  preview: z.array(memberImportRowSchema.partial()).max(50),
});

export type MemberImportPreviewResponse = z.infer<typeof memberImportPreviewResponseSchema>;

export const memberImportCommitSchema = z.object({
  jobId: uuidSchema,
});

export type MemberImportCommitRequest = z.infer<typeof memberImportCommitSchema>;

export const memberImportListResponseSchema = z.object({
  jobs: z.array(memberImportJobSchema),
});

export type MemberImportListResponse = z.infer<typeof memberImportListResponseSchema>;
