'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  sermonCreateSchema,
  sermonGenerateSchema,
  sermonNoteCreateSchema,
  sermonPublishSchema,
  sermonReprocessSchema,
  sermonSeriesCreateSchema,
  sermonShareCreateSchema,
  sermonTranscriptUpsertSchema,
  sermonUpdateSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import {
  commaList,
  optionalDateTime,
  optionalText,
  requireToken,
  submitForm,
  text,
} from '@/lib/form-utils';
import type { FormState } from '@/lib/form-state';

function revalidateSermons(sermonId?: string): void {
  revalidatePath('/sermons');
  revalidatePath('/sermons/series');
  revalidatePath('/sermons/search');
  if (sermonId) revalidatePath(`/sermons/${sermonId}`);
}

export async function createSermonAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    title: text(formData, 'title').trim(),
    tags: commaList(formData, 'tags'),
    language: optionalText(formData, 'language') ?? 'en',
    visibility: optionalText(formData, 'visibility') ?? 'MEMBERS',
  };
  const subtitle = optionalText(formData, 'subtitle');
  if (subtitle !== undefined) payload.subtitle = subtitle;
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;
  const slug = optionalText(formData, 'slug');
  if (slug !== undefined) payload.slug = slug;
  const seriesId = optionalText(formData, 'seriesId');
  if (seriesId !== undefined) payload.seriesId = seriesId;
  const speakerName = optionalText(formData, 'speakerName');
  if (speakerName !== undefined) payload.speakerName = speakerName;
  const preachedAt = optionalDateTime(formData, 'preachedAt');
  if (preachedAt !== undefined) payload.preachedAt = preachedAt;
  const location = optionalText(formData, 'location');
  if (location !== undefined) payload.location = location;
  const transcriptText = optionalText(formData, 'transcriptText');
  if (transcriptText !== undefined) payload.transcriptText = transcriptText;
  const fileName = optionalText(formData, 'fileName');
  const contentType = optionalText(formData, 'contentType');
  const contentBase64 = optionalText(formData, 'contentBase64');
  if (fileName !== undefined) payload.fileName = fileName;
  if (contentType !== undefined) payload.contentType = contentType;
  if (contentBase64 !== undefined) payload.contentBase64 = contentBase64;

  return submitForm(sermonCreateSchema, payload, async (input) => {
    const created = await api.createSermon(token, input);
    revalidateSermons();
    return redirect(`/sermons/${created.id}`);
  });
}

export async function updateSermonAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const payload: Record<string, unknown> = {
    title: text(formData, 'title').trim(),
    subtitle: optionalText(formData, 'subtitle') ?? null,
    description: optionalText(formData, 'description') ?? null,
    speakerName: optionalText(formData, 'speakerName') ?? null,
    location: optionalText(formData, 'location') ?? null,
    preachedAt: optionalDateTime(formData, 'preachedAt') ?? null,
    visibility: optionalText(formData, 'visibility'),
    language: optionalText(formData, 'language'),
    tags: commaList(formData, 'tags'),
  };
  const seriesId = optionalText(formData, 'seriesId');
  payload.seriesId = seriesId ?? null;

  return submitForm(sermonUpdateSchema, payload, async (input) => {
    await api.updateSermon(token, sermonId, input);
    revalidateSermons(sermonId);
    return { status: 'success', message: 'Sermon details updated.' };
  });
}

export async function publishSermonAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const visibility = optionalText(formData, 'visibility');
  await api.publishSermon(token, sermonId, sermonPublishSchema.parse(visibility ? { visibility } : {}));
  revalidateSermons(sermonId);
  redirect(`/sermons/${sermonId}`);
}

export async function archiveSermonAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  await api.archiveSermon(token, sermonId);
  revalidateSermons();
  redirect('/sermons');
}

export async function reprocessSermonAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const stages = formData
    .getAll('stages')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const payload = stages.length > 0 ? { stages } : {};
  return submitForm(sermonReprocessSchema, payload, async (input) => {
    const result = await api.reprocessSermon(token, sermonId, input);
    revalidateSermons(sermonId);
    return {
      status: 'success',
      message: `${result.jobs.length} processing job${result.jobs.length === 1 ? '' : 's'} queued.`,
    };
  });
}

export async function generateSermonAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const payload = { kind: text(formData, 'kind') };
  return submitForm(sermonGenerateSchema, payload, async (input) => {
    await api.generateSermon(token, sermonId, input);
    revalidateSermons(sermonId);
    return { status: 'success', message: `${input.kind.toLowerCase()} generated from the transcript.` };
  });
}

export async function upsertTranscriptAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const payload = {
    language: optionalText(formData, 'language') ?? 'en',
    text: text(formData, 'text'),
  };
  return submitForm(sermonTranscriptUpsertSchema, payload, async (input) => {
    await api.upsertSermonTranscript(token, sermonId, input);
    revalidateSermons(sermonId);
    return { status: 'success', message: 'Transcript saved. Derived fields will refresh.' };
  });
}

export async function createSermonNoteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const timestampRaw = optionalText(formData, 'timestampMs');
  const payload: Record<string, unknown> = { body: text(formData, 'body') };
  if (timestampRaw !== undefined) payload.timestampMs = Number(timestampRaw);
  return submitForm(sermonNoteCreateSchema, payload, async (input) => {
    await api.createSermonNote(token, sermonId, input);
    revalidateSermons(sermonId);
    return { status: 'success', message: 'Note saved.' };
  });
}

export async function deleteSermonNoteAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  await api.deleteSermonNote(token, sermonId, text(formData, 'noteId'));
  revalidateSermons(sermonId);
  redirect(`/sermons/${sermonId}`);
}

export async function createSermonShareAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  const days = optionalText(formData, 'expiresInDays');
  const payload = days ? { expiresInDays: Number(days) } : {};
  return submitForm(sermonShareCreateSchema, payload, async (input) => {
    const share = await api.createSermonShare(token, sermonId, input);
    revalidateSermons(sermonId);
    return { status: 'success', message: `Share link created: ${share.url}` };
  });
}

export async function revokeSermonShareAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const sermonId = text(formData, 'sermonId');
  await api.revokeSermonShare(token, sermonId, text(formData, 'shareId'));
  revalidateSermons(sermonId);
  redirect(`/sermons/${sermonId}`);
}

export async function createSermonSeriesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    title: text(formData, 'title').trim(),
    visibility: optionalText(formData, 'visibility') ?? 'MEMBERS',
  };
  const subtitle = optionalText(formData, 'subtitle');
  if (subtitle !== undefined) payload.subtitle = subtitle;
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;
  const startsOn = optionalText(formData, 'startsOn');
  if (startsOn !== undefined) payload.startsOn = startsOn;
  const endsOn = optionalText(formData, 'endsOn');
  if (endsOn !== undefined) payload.endsOn = endsOn;
  return submitForm(sermonSeriesCreateSchema, payload, async (input) => {
    await api.createSermonSeries(token, input);
    revalidatePath('/sermons/series');
    revalidatePath('/sermons');
    return { status: 'success', message: 'Series created.' };
  });
}

export async function archiveSermonSeriesAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  await api.archiveSermonSeries(token, text(formData, 'seriesId'));
  revalidatePath('/sermons/series');
  redirect('/sermons/series');
}
