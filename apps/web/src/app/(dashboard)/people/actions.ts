'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  documentUploadSchema,
  memberSchema,
  memberUpdateSchema,
  relationshipSchema,
  timelineNoteSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import {
  commaList,
  optionalText,
  requireToken,
  submitForm,
  text,
} from '@/lib/form-utils';
import type { FormState } from '@/lib/form-state';

const MEMBER_OPTIONAL_TEXT_FIELDS = [
  'middleName',
  'preferredName',
  'email',
  'phone',
  'photoUrl',
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'postalCode',
  'notes',
] as const;

const MEMBER_DATE_FIELDS = ['dateOfBirth', 'joinedAt', 'baptizedAt'] as const;

function memberCreatePayload(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    firstName: text(formData, 'firstName').trim(),
    lastName: text(formData, 'lastName').trim(),
    status: optionalText(formData, 'status') ?? 'ACTIVE',
    gender: optionalText(formData, 'gender') ?? 'UNDISCLOSED',
    maritalStatus: optionalText(formData, 'maritalStatus') ?? 'UNDISCLOSED',
    tags: commaList(formData, 'tags'),
  };

  for (const key of [...MEMBER_OPTIONAL_TEXT_FIELDS, ...MEMBER_DATE_FIELDS, 'countryCode']) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }

  return payload;
}

/**
 * An update is a sparse patch: empty optional fields are sent as `null` so the
 * server clears them, which is what an administrator expects when they delete a
 * phone number from the form.
 */
function memberUpdatePayload(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    firstName: text(formData, 'firstName').trim(),
    lastName: text(formData, 'lastName').trim(),
    status: optionalText(formData, 'status'),
    gender: optionalText(formData, 'gender'),
    maritalStatus: optionalText(formData, 'maritalStatus'),
    tags: commaList(formData, 'tags'),
  };

  for (const key of [...MEMBER_OPTIONAL_TEXT_FIELDS, ...MEMBER_DATE_FIELDS, 'countryCode']) {
    payload[key] = optionalText(formData, key) ?? null;
  }

  return payload;
}

export async function createMemberAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  return submitForm(memberSchema, memberCreatePayload(formData), async (input) => {
    const created = await api.createMember(token, input);
    revalidatePath('/people');
    return redirect(`/people/${created.id}`);
  });
}

export async function updateMemberAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  return submitForm(memberUpdateSchema, memberUpdatePayload(formData), async (input) => {
    await api.updateMember(token, memberId, input);
    revalidatePath('/people');
    revalidatePath(`/people/${memberId}`);
    return redirect(`/people/${memberId}`);
  });
}

export async function archiveMemberAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  await api.archiveMember(token, memberId);
  revalidatePath('/people');
  redirect('/people');
}

export async function addTimelineNoteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  const payload = {
    title: text(formData, 'title').trim(),
    summary: optionalText(formData, 'summary'),
    occurredAt: optionalText(formData, 'occurredAt')
      ? new Date(text(formData, 'occurredAt')).toISOString()
      : undefined,
  };

  return submitForm(timelineNoteSchema, payload, async (input) => {
    await api.addTimelineNote(token, memberId, input);
    revalidatePath(`/people/${memberId}`);
    return { status: 'success', message: 'Note added to the timeline.' };
  });
}

export async function generateSummaryAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  await api.generateMemberSummary(token, memberId, { force: true });
  revalidatePath(`/people/${memberId}`);
  redirect(`/people/${memberId}`);
}

export async function createRelationshipAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  const payload = {
    fromMemberId: memberId,
    toMemberId: text(formData, 'toMemberId'),
    type: text(formData, 'type'),
    notes: optionalText(formData, 'notes'),
  };

  return submitForm(relationshipSchema, payload, async (input) => {
    await api.createRelationship(token, input);
    revalidatePath(`/people/${memberId}`);
    return { status: 'success', message: 'Relationship recorded.' };
  });
}

export async function removeRelationshipAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  await api.removeRelationship(token, text(formData, 'relationshipId'));
  revalidatePath(`/people/${memberId}`);
  redirect(`/people/${memberId}`);
}

export async function uploadDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  const payload = {
    title: text(formData, 'title').trim(),
    category: optionalText(formData, 'category') ?? 'OTHER',
    fileName: text(formData, 'fileName').trim(),
    contentType: text(formData, 'contentType').trim(),
    contentBase64: text(formData, 'contentBase64'),
    notes: optionalText(formData, 'notes'),
  };

  return submitForm(documentUploadSchema, payload, async (input) => {
    await api.uploadDocument(token, memberId, input);
    revalidatePath(`/people/${memberId}`);
    return { status: 'success', message: 'Document stored against this member.' };
  });
}

export async function archiveDocumentAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const memberId = text(formData, 'memberId');
  await api.archiveDocument(token, text(formData, 'documentId'));
  revalidatePath(`/people/${memberId}`);
  redirect(`/people/${memberId}`);
}
