'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  attendanceBulkMarkSchema,
  attendanceSessionSchema,
  departmentMemberAddSchema,
  departmentSchema,
  familyMemberAddSchema,
  familySchema,
  relationshipSchema,
  visitorConvertSchema,
  visitorSchema,
  visitorVisitSchema,
  volunteerAssignmentSchema,
  volunteerRoleSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import {
  checkbox,
  commaList,
  optionalDateTime,
  optionalText,
  requireToken,
  submitForm,
  text,
} from '@/lib/form-utils';
import type { FormState } from '@/lib/form-state';

function revalidateCommunity(section: string): void {
  revalidatePath(`/community/${section}`);
}

function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = optionalText(formData, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Families ------------------------------------------------------------------

export async function createFamilyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    status: optionalText(formData, 'status') ?? 'ACTIVE',
  };
  for (const key of ['addressLine1', 'city', 'countryCode', 'homePhone', 'notes'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }

  return submitForm(familySchema, payload, async (input) => {
    const created = await api.createFamily(token, input);
    revalidateCommunity('families');
    return redirect(`/community/families/${created.id}`);
  });
}

export async function addFamilyMemberAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const familyId = text(formData, 'familyId');
  const payload = {
    memberId: text(formData, 'memberId'),
    role: optionalText(formData, 'role') ?? 'OTHER',
  };

  return submitForm(familyMemberAddSchema, payload, async (input) => {
    await api.addFamilyMember(token, familyId, input);
    revalidateCommunity('families');
    revalidatePath(`/community/families/${familyId}`);
    return { status: 'success', message: 'Member added to the family.' };
  });
}

export async function removeFamilyMemberAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const familyId = text(formData, 'familyId');
  await api.removeFamilyMember(token, familyId, text(formData, 'memberId'));
  revalidatePath(`/community/families/${familyId}`);
  redirect(`/community/families/${familyId}`);
}

// Visitors ------------------------------------------------------------------

export async function createVisitorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    firstName: text(formData, 'firstName').trim(),
    lastName: text(formData, 'lastName').trim(),
    status: optionalText(formData, 'status') ?? 'NEW',
    source: optionalText(formData, 'source') ?? 'OTHER',
    interests: commaList(formData, 'interests'),
  };
  for (const key of ['email', 'phone', 'addressLine1', 'city', 'countryCode', 'notes'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }
  const firstVisitAt = optionalDateTime(formData, 'firstVisitAt');
  if (firstVisitAt !== undefined) payload.firstVisitAt = firstVisitAt;
  const followUpAt = optionalDateTime(formData, 'followUpAt');
  if (followUpAt !== undefined) payload.followUpAt = followUpAt;

  return submitForm(visitorSchema, payload, async (input) => {
    await api.createVisitor(token, input);
    revalidateCommunity('visitors');
    return redirect('/community/visitors');
  });
}

export async function addVisitorVisitAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const visitorId = text(formData, 'visitorId');
  const payload = {
    occurredAt: optionalDateTime(formData, 'occurredAt') ?? new Date().toISOString(),
    serviceName: optionalText(formData, 'serviceName'),
    attended: checkbox(formData, 'attended'),
    notes: optionalText(formData, 'notes'),
  };

  return submitForm(visitorVisitSchema, payload, async (input) => {
    await api.addVisitorVisit(token, visitorId, input);
    revalidatePath(`/community/visitors/${visitorId}`);
    revalidateCommunity('visitors');
    return { status: 'success', message: 'Visit recorded.' };
  });
}

export async function convertVisitorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const visitorId = text(formData, 'visitorId');
  const member: Record<string, unknown> = {};
  for (const key of ['firstName', 'lastName', 'email', 'phone', 'addressLine1', 'city'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) member[key] = value;
  }
  const joinedAt = optionalDateTime(formData, 'joinedAt');
  const payload: Record<string, unknown> = {};
  if (Object.keys(member).length > 0) payload.member = member;
  if (joinedAt !== undefined) payload.joinedAt = joinedAt;

  return submitForm(visitorConvertSchema, payload, async (input) => {
    const converted = await api.convertVisitor(token, visitorId, input);
    revalidateCommunity('visitors');
    revalidatePath('/people');
    return redirect(
      converted.convertedMemberId ? `/people/${converted.convertedMemberId}` : '/community/visitors',
    );
  });
}

// Attendance ----------------------------------------------------------------

export async function createAttendanceSessionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    title: text(formData, 'title').trim(),
    kind: optionalText(formData, 'kind') ?? 'SERVICE',
    occurredAt: optionalDateTime(formData, 'occurredAt') ?? new Date().toISOString(),
  };
  for (const key of ['location', 'notes', 'departmentId'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }
  const expectedCount = optionalNumber(formData, 'expectedCount');
  if (expectedCount !== undefined) payload.expectedCount = expectedCount;

  return submitForm(attendanceSessionSchema, payload, async (input) => {
    const created = await api.createAttendanceSession(token, input);
    revalidateCommunity('attendance');
    return redirect(`/community/attendance/${created.id}`);
  });
}

/**
 * Bulk marking is how a roster is submitted: the client component sends every
 * ticked attendee as one payload, so a service is recorded in a single request.
 */
export async function bulkMarkAttendanceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sessionId = text(formData, 'sessionId');

  let records: unknown;
  try {
    records = JSON.parse(text(formData, 'records'));
  } catch {
    return { status: 'error', message: 'Could not read the attendance sheet. Please try again.' };
  }

  return submitForm(attendanceBulkMarkSchema, { records }, async (input) => {
    const marked = await api.bulkMarkAttendance(token, sessionId, input);
    revalidatePath(`/community/attendance/${sessionId}`);
    revalidateCommunity('attendance');
    return { status: 'success', message: `${marked.length} attendance records saved.` };
  });
}

export async function closeAttendanceSessionAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const sessionId = text(formData, 'sessionId');
  await api.closeAttendanceSession(token, sessionId);
  revalidatePath(`/community/attendance/${sessionId}`);
  revalidateCommunity('attendance');
  redirect(`/community/attendance/${sessionId}`);
}

// Departments ---------------------------------------------------------------

export async function createDepartmentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    kind: optionalText(formData, 'kind') ?? 'MINISTRY',
    isActive: checkbox(formData, 'isActive'),
  };
  for (const key of ['description', 'leaderMemberId', 'meetingDay', 'meetingTime', 'location'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }

  return submitForm(departmentSchema, payload, async (input) => {
    const created = await api.createDepartment(token, input);
    revalidateCommunity('departments');
    return redirect(`/community/departments/${created.id}`);
  });
}

export async function addDepartmentMemberAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const departmentId = text(formData, 'departmentId');
  const payload = {
    memberId: text(formData, 'memberId'),
    role: optionalText(formData, 'role') ?? 'MEMBER',
    joinedAt: optionalDateTime(formData, 'joinedAt'),
  };

  return submitForm(departmentMemberAddSchema, payload, async (input) => {
    await api.addDepartmentMember(token, departmentId, input);
    revalidateCommunity('departments');
    revalidatePath(`/community/departments/${departmentId}`);
    return { status: 'success', message: 'Member added to the department.' };
  });
}

export async function removeDepartmentMemberAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const departmentId = text(formData, 'departmentId');
  await api.removeDepartmentMember(token, departmentId, text(formData, 'memberId'));
  revalidatePath(`/community/departments/${departmentId}`);
  redirect(`/community/departments/${departmentId}`);
}

// Volunteer roles -----------------------------------------------------------

export async function createVolunteerRoleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    commitment: optionalText(formData, 'commitment') ?? 'WEEKLY',
    requiredCount: optionalNumber(formData, 'requiredCount') ?? 1,
    requiresBackgroundCheck: checkbox(formData, 'requiresBackgroundCheck'),
    isActive: checkbox(formData, 'isActive'),
  };
  for (const key of ['description', 'departmentId'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }

  return submitForm(volunteerRoleSchema, payload, async (input) => {
    const created = await api.createVolunteerRole(token, input);
    revalidateCommunity('volunteers');
    return redirect(`/community/volunteers/${created.id}`);
  });
}

export async function assignVolunteerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const roleId = text(formData, 'roleId');
  const payload: Record<string, unknown> = {
    memberId: text(formData, 'memberId'),
    status: optionalText(formData, 'status') ?? 'ACTIVE',
  };
  for (const key of ['startsAt', 'endsAt', 'backgroundCheckAt'] as const) {
    const value = optionalDateTime(formData, key);
    if (value !== undefined) payload[key] = value;
  }
  const notes = optionalText(formData, 'notes');
  if (notes !== undefined) payload.notes = notes;

  return submitForm(volunteerAssignmentSchema, payload, async (input) => {
    await api.assignVolunteer(token, roleId, input);
    revalidateCommunity('volunteers');
    revalidatePath(`/community/volunteers/${roleId}`);
    return { status: 'success', message: 'Volunteer assigned.' };
  });
}

export async function endVolunteerAssignmentAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const roleId = text(formData, 'roleId');
  await api.endVolunteerAssignment(token, roleId, text(formData, 'assignmentId'));
  revalidatePath(`/community/volunteers/${roleId}`);
  redirect(`/community/volunteers/${roleId}`);
}

// Relationships -------------------------------------------------------------

export async function createRelationshipFromGraphAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload = {
    fromMemberId: text(formData, 'fromMemberId'),
    toMemberId: text(formData, 'toMemberId'),
    type: text(formData, 'type'),
    notes: optionalText(formData, 'notes'),
  };

  return submitForm(relationshipSchema, payload, async (input) => {
    await api.createRelationship(token, input);
    revalidatePath('/community/relationships');
    return { status: 'success', message: 'Relationship recorded.' };
  });
}

export async function removeRelationshipFromGraphAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  await api.removeRelationship(token, text(formData, 'relationshipId'));
  revalidatePath('/community/relationships');
}
