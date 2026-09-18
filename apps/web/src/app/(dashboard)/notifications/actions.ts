'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  notificationAudienceCreateSchema,
  notificationAudienceUpdateSchema,
  notificationCampaignCreateSchema,
  notificationCampaignScheduleSchema,
  notificationCampaignUpdateSchema,
  notificationTemplateCreateSchema,
  notificationTemplateUpdateSchema,
} from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import {
  isRedirectError,
  optionalDateTime,
  optionalText,
  requireToken,
  submitForm,
  text,
  toFormState,
} from '@/lib/form-utils';
import type { FormState } from '@/lib/form-state';

function revalidateNotifications(campaignId?: string): void {
  revalidatePath('/notifications');
  revalidatePath('/notifications/inbox');
  revalidatePath('/notifications/templates');
  revalidatePath('/notifications/audiences');
  revalidatePath('/notifications/analytics');
  revalidatePath('/home');
  if (campaignId) revalidatePath(`/notifications/${campaignId}`);
}

function audienceFilter(formData: FormData): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const search = optionalText(formData, 'filterSearch');
  if (search !== undefined) filter.search = search;
  const status = optionalText(formData, 'filterStatus');
  if (status !== undefined) filter.status = status;
  const gender = optionalText(formData, 'filterGender');
  if (gender !== undefined) filter.gender = gender;
  const maritalStatus = optionalText(formData, 'filterMaritalStatus');
  if (maritalStatus !== undefined) filter.maritalStatus = maritalStatus;
  const departmentId = optionalText(formData, 'filterDepartmentId');
  if (departmentId !== undefined) filter.departmentId = departmentId;
  const familyId = optionalText(formData, 'filterFamilyId');
  if (familyId !== undefined) filter.familyId = familyId;
  const volunteerRoleId = optionalText(formData, 'filterVolunteerRoleId');
  if (volunteerRoleId !== undefined) filter.volunteerRoleId = volunteerRoleId;
  const tag = optionalText(formData, 'filterTag');
  if (tag !== undefined) filter.tag = tag;
  return filter;
}

export async function createNotificationTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    channel: optionalText(formData, 'channel') ?? 'EMAIL',
    body: text(formData, 'body'),
  };
  const subject = optionalText(formData, 'subject');
  if (subject !== undefined) payload.subject = subject;
  const html = optionalText(formData, 'html');
  if (html !== undefined) payload.html = html;

  return submitForm(notificationTemplateCreateSchema, payload, async (input) => {
    await api.createNotificationTemplate(token, input);
    revalidateNotifications();
    return redirect('/notifications/templates');
  });
}

export async function updateNotificationTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const templateId = text(formData, 'templateId');
  const payload: Record<string, unknown> = {};
  const name = optionalText(formData, 'name');
  if (name !== undefined) payload.name = name;
  const subject = optionalText(formData, 'subject');
  if (subject !== undefined) payload.subject = subject;
  const body = optionalText(formData, 'body');
  if (body !== undefined) payload.body = body;
  const html = optionalText(formData, 'html');
  if (html !== undefined) payload.html = html;
  const status = optionalText(formData, 'status');
  if (status !== undefined) payload.status = status;

  return submitForm(notificationTemplateUpdateSchema, payload, async (input) => {
    await api.updateNotificationTemplate(token, templateId, input);
    revalidateNotifications();
    return { status: 'success', message: 'Template saved.' };
  });
}

export async function createNotificationAudienceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    filter: audienceFilter(formData),
  };
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;

  return submitForm(notificationAudienceCreateSchema, payload, async (input) => {
    const created = await api.createNotificationAudience(token, input);
    revalidateNotifications();
    return redirect(`/notifications/audiences/${created.id}`);
  });
}

export async function updateNotificationAudienceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const audienceId = text(formData, 'audienceId');
  const payload: Record<string, unknown> = {
    filter: audienceFilter(formData),
  };
  const name = optionalText(formData, 'name');
  if (name !== undefined) payload.name = name;
  const description = optionalText(formData, 'description');
  payload.description = description ?? null;

  return submitForm(notificationAudienceUpdateSchema, payload, async (input) => {
    await api.updateNotificationAudience(token, audienceId, input);
    revalidatePath(`/notifications/audiences/${audienceId}`);
    revalidateNotifications();
    return { status: 'success', message: 'Audience saved.' };
  });
}

export async function createNotificationCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    channel: optionalText(formData, 'channel') ?? 'EMAIL',
  };
  const templateId = optionalText(formData, 'templateId');
  if (templateId !== undefined) payload.templateId = templateId;
  const subject = optionalText(formData, 'subject');
  if (subject !== undefined) payload.subject = subject;
  const body = optionalText(formData, 'body');
  if (body !== undefined) payload.body = body;
  const html = optionalText(formData, 'html');
  if (html !== undefined) payload.html = html;
  const audienceId = optionalText(formData, 'audienceId');
  if (audienceId !== undefined) payload.audienceId = audienceId;
  const filter = audienceFilter(formData);
  if (Object.keys(filter).length > 0) payload.filter = filter;
  const scheduledAt = optionalDateTime(formData, 'scheduledAt');
  if (scheduledAt !== undefined) payload.scheduledAt = scheduledAt;

  return submitForm(notificationCampaignCreateSchema, payload, async (input) => {
    const created = await api.createNotificationCampaign(token, input);
    revalidateNotifications(created.id);
    return redirect(`/notifications/${created.id}`);
  });
}

export async function updateNotificationCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const campaignId = text(formData, 'campaignId');
  const payload: Record<string, unknown> = {};
  const name = optionalText(formData, 'name');
  if (name !== undefined) payload.name = name;
  const subject = optionalText(formData, 'subject');
  if (subject !== undefined) payload.subject = subject;
  const body = optionalText(formData, 'body');
  if (body !== undefined) payload.body = body;
  const html = optionalText(formData, 'html');
  if (html !== undefined) payload.html = html;
  const audienceId = optionalText(formData, 'audienceId');
  payload.audienceId = audienceId ?? null;
  const scheduledAt = optionalDateTime(formData, 'scheduledAt');
  payload.scheduledAt = scheduledAt ?? null;

  return submitForm(notificationCampaignUpdateSchema, payload, async (input) => {
    await api.updateNotificationCampaign(token, campaignId, input);
    revalidateNotifications(campaignId);
    return { status: 'success', message: 'Campaign saved.' };
  });
}

export async function sendNotificationCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const campaignId = text(formData, 'campaignId');
  try {
    await api.sendNotificationCampaign(token, campaignId);
    revalidateNotifications(campaignId);
    return { status: 'success', message: 'Campaign queued for send.' };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toFormState(error);
  }
}

export async function scheduleNotificationCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const campaignId = text(formData, 'campaignId');
  const payload = { scheduledAt: optionalDateTime(formData, 'scheduledAt') };

  return submitForm(notificationCampaignScheduleSchema, payload, async (input) => {
    await api.scheduleNotificationCampaign(token, campaignId, input);
    revalidateNotifications(campaignId);
    return { status: 'success', message: 'Campaign scheduled.' };
  });
}

export async function cancelNotificationCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const campaignId = text(formData, 'campaignId');
  try {
    await api.cancelNotificationCampaign(token, campaignId);
    revalidateNotifications(campaignId);
    return { status: 'success', message: 'Campaign cancelled.' };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toFormState(error);
  }
}

export async function markNotificationReadAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const messageId = text(formData, 'messageId');
  try {
    await api.markNotificationRead(token, messageId);
    revalidatePath('/notifications/inbox');
    revalidatePath('/home');
    return { status: 'success', message: 'Marked as read.' };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toFormState(error);
  }
}
