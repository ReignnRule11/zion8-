import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Attendance is recorded per session, not per member, because that is the unit
 * a church actually runs: a Sunday service, a midweek class, a youth night.
 * A record references either a member or a visitor, so a first-time guest can be
 * counted on the day they arrive without first becoming a member.
 */

export const AttendanceSessionKind = {
  SERVICE: 'SERVICE',
  EVENT: 'EVENT',
  CLASS: 'CLASS',
  GROUP: 'GROUP',
  OUTREACH: 'OUTREACH',
  OTHER: 'OTHER',
} as const;

export type AttendanceSessionKind =
  (typeof AttendanceSessionKind)[keyof typeof AttendanceSessionKind];

export const attendanceSessionKindSchema = z.enum(
  Object.values(AttendanceSessionKind) as [AttendanceSessionKind, ...AttendanceSessionKind[]],
);

export const AttendanceSessionStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export type AttendanceSessionStatus =
  (typeof AttendanceSessionStatus)[keyof typeof AttendanceSessionStatus];

export const attendanceSessionStatusSchema = z.enum(
  Object.values(AttendanceSessionStatus) as [
    AttendanceSessionStatus,
    ...AttendanceSessionStatus[],
  ],
);

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED',
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const attendanceStatusSchema = z.enum(
  Object.values(AttendanceStatus) as [AttendanceStatus, ...AttendanceStatus[]],
);

export const AttendanceMethod = {
  MANUAL: 'MANUAL',
  SELF: 'SELF',
  QR: 'QR',
  KIOSK: 'KIOSK',
  IMPORT: 'IMPORT',
} as const;

export type AttendanceMethod = (typeof AttendanceMethod)[keyof typeof AttendanceMethod];

export const attendanceMethodSchema = z.enum(
  Object.values(AttendanceMethod) as [AttendanceMethod, ...AttendanceMethod[]],
);

/** Statuses that count as the person having attended. */
export const ATTENDING_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
];

export const attendanceSessionSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: attendanceSessionKindSchema.default('SERVICE'),
  occurredAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  location: z.string().trim().max(160).optional(),
  departmentId: uuidSchema.optional(),
  expectedCount: z.number().int().min(0).max(1_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type AttendanceSessionRequest = z.infer<typeof attendanceSessionSchema>;

export const attendanceSessionUpdateSchema = attendanceSessionSchema
  .partial()
  .extend({
    location: z.string().trim().max(160).nullable().optional(),
    departmentId: uuidSchema.nullable().optional(),
    endedAt: z.string().datetime().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  });

export type AttendanceSessionUpdateRequest = z.infer<typeof attendanceSessionUpdateSchema>;

export const attendanceMarkSchema = z.object({
  memberId: uuidSchema.optional(),
  visitorId: uuidSchema.optional(),
  status: attendanceStatusSchema.default('PRESENT'),
  method: attendanceMethodSchema.default('MANUAL'),
  checkedInAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type AttendanceMarkRequest = z.infer<typeof attendanceMarkSchema>;

/** Bulk marking is the normal path: a roster is submitted after a service. */
export const attendanceBulkMarkSchema = z.object({
  records: z
    .array(
      attendanceMarkSchema.refine((value) => value.memberId || value.visitorId, {
        message: 'Each record needs a memberId or a visitorId',
        path: ['memberId'],
      }),
    )
    .min(1)
    .max(2000),
});

export type AttendanceBulkMarkRequest = z.infer<typeof attendanceBulkMarkSchema>;

export const attendanceRecordSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  memberId: uuidSchema.nullable(),
  visitorId: uuidSchema.nullable(),
  attendeeName: z.string(),
  status: attendanceStatusSchema,
  method: attendanceMethodSchema,
  checkedInAt: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

export const attendanceSessionSummarySchema = z.object({
  id: uuidSchema,
  title: z.string(),
  kind: attendanceSessionKindSchema,
  status: attendanceSessionStatusSchema,
  occurredAt: z.string().datetime(),
  location: z.string().nullable(),
  departmentId: uuidSchema.nullable(),
  attendedCount: z.number().int().min(0),
  absentCount: z.number().int().min(0),
  expectedCount: z.number().int().nullable(),
  recordedByUserId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AttendanceSessionSummary = z.infer<typeof attendanceSessionSummarySchema>;

export const attendanceSessionResponseSchema = attendanceSessionSchema.extend({
  id: uuidSchema,
  tenantId: uuidSchema,
  status: attendanceSessionStatusSchema,
  recordedByUserId: uuidSchema.nullable(),
  attendedCount: z.number().int().min(0),
  absentCount: z.number().int().min(0),
  records: z.array(attendanceRecordSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AttendanceSessionResponse = z.infer<typeof attendanceSessionResponseSchema>;

export const attendanceSessionListQuerySchema = paginationQuerySchema.extend({
  kind: attendanceSessionKindSchema.optional(),
  status: attendanceSessionStatusSchema.optional(),
  departmentId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AttendanceSessionListQuery = z.infer<typeof attendanceSessionListQuerySchema>;

export const attendanceSessionPageSchema = paginatedSchema(attendanceSessionSummarySchema);

export type AttendanceSessionPage = z.infer<typeof attendanceSessionPageSchema>;

/** Per-member attendance statistics used on the profile and in summaries. */
export const memberAttendanceStatsSchema = z.object({
  memberId: uuidSchema,
  sessionsAttended: z.number().int().min(0),
  sessionsRecorded: z.number().int().min(0),
  attendanceRate: z.number().min(0).max(1),
  lastAttendedAt: z.string().datetime().nullable(),
  currentStreak: z.number().int().min(0),
});

export type MemberAttendanceStats = z.infer<typeof memberAttendanceStatsSchema>;
