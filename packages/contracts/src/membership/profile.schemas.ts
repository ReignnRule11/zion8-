import { z } from 'zod';
import { uuidSchema } from '../common/primitives';
import { attendanceSessionKindSchema, memberAttendanceStatsSchema } from './attendance.schemas';
import { departmentKindSchema, departmentMemberRoleSchema, departmentMemberStatusSchema } from './department.schemas';
import { documentResponseSchema } from './document.schemas';
import { familyRoleSchema, familyStatusSchema } from './family.schemas';
import { memberResponseSchema } from './member.schemas';
import { relationshipResponseSchema } from './relationship.schemas';
import { memberAiSummaryResponseSchema } from './summary.schemas';
import { timelineEntryResponseSchema } from './timeline.schemas';
import { volunteerAssignmentStatusSchema, volunteerCommitmentSchema } from './volunteer.schemas';

/**
 * The composite read behind a member profile page. It exists so the web and
 * mobile clients render a profile in one round trip instead of fanning out to a
 * dozen endpoints, and so the aggregate stays a single, cacheable projection.
 */

export const profileFamilySchema = z.object({
  familyId: uuidSchema,
  familyName: z.string(),
  familyStatus: familyStatusSchema,
  role: familyRoleSchema,
});

export type ProfileFamily = z.infer<typeof profileFamilySchema>;

export const profileDepartmentSchema = z.object({
  departmentId: uuidSchema,
  name: z.string(),
  kind: departmentKindSchema,
  role: departmentMemberRoleSchema,
  status: departmentMemberStatusSchema,
});

export type ProfileDepartment = z.infer<typeof profileDepartmentSchema>;

export const profileVolunteerRoleSchema = z.object({
  roleId: uuidSchema,
  name: z.string(),
  commitment: volunteerCommitmentSchema,
  status: volunteerAssignmentStatusSchema,
});

export type ProfileVolunteerRole = z.infer<typeof profileVolunteerRoleSchema>;

export const profileAttendanceSessionSchema = z.object({
  sessionId: uuidSchema,
  title: z.string(),
  kind: attendanceSessionKindSchema,
  occurredAt: z.string().datetime(),
  status: z.string(),
});

export type ProfileAttendanceSession = z.infer<typeof profileAttendanceSessionSchema>;

export const memberProfileSchema = z.object({
  member: memberResponseSchema,
  attendance: memberAttendanceStatsSchema,
  families: z.array(profileFamilySchema),
  departments: z.array(profileDepartmentSchema),
  volunteerRoles: z.array(profileVolunteerRoleSchema),
  relationships: z.array(relationshipResponseSchema),
  recentAttendance: z.array(profileAttendanceSessionSchema),
  documents: z.array(documentResponseSchema),
  timeline: z.array(timelineEntryResponseSchema),
  summary: memberAiSummaryResponseSchema.nullable(),
});

export type MemberProfile = z.infer<typeof memberProfileSchema>;
