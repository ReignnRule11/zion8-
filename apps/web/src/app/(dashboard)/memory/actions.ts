'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  memoryArtifactCreateSchema,
  memoryArtifactLinkSchema,
  memoryArtifactUpdateSchema,
  memoryReprocessSchema,
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

function revalidateMemory(artifactId?: string): void {
  revalidatePath('/memory');
  if (artifactId) revalidatePath(`/memory/${artifactId}`);
}

/**
 * Ingests one artifact. The bytes are base64-encoded in the browser and posted
 * through a server action, mirroring the membership document flow: the API only
 * accepts binary over REST, and this keeps the access token out of the client.
 */
export async function createMemoryArtifactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    title: text(formData, 'title').trim(),
    kind: optionalText(formData, 'kind') ?? 'OTHER',
    datePrecision: optionalText(formData, 'datePrecision') ?? 'UNKNOWN',
    tags: commaList(formData, 'tags'),
    fileName: text(formData, 'fileName').trim(),
    contentType: text(formData, 'contentType').trim(),
    contentBase64: text(formData, 'contentBase64'),
  };
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;
  const capturedAt = optionalDateTime(formData, 'capturedAt');
  if (capturedAt !== undefined) payload.capturedAt = capturedAt;

  return submitForm(memoryArtifactCreateSchema, payload, async (input) => {
    const created = await api.createMemoryArtifact(token, input);
    revalidateMemory();
    return redirect(`/memory/${created.id}`);
  });
}

export async function updateMemoryArtifactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const artifactId = text(formData, 'artifactId');
  const payload: Record<string, unknown> = {
    title: text(formData, 'title').trim(),
    description: optionalText(formData, 'description') ?? null,
    capturedAt: optionalDateTime(formData, 'capturedAt') ?? null,
    datePrecision: optionalText(formData, 'datePrecision') ?? 'UNKNOWN',
    tags: commaList(formData, 'tags'),
  };
  const kind = optionalText(formData, 'kind');
  if (kind !== undefined) payload.kind = kind;

  return submitForm(memoryArtifactUpdateSchema, payload, async (input) => {
    await api.updateMemoryArtifact(token, artifactId, input);
    revalidateMemory(artifactId);
    return { status: 'success', message: 'Artifact details updated.' };
  });
}

export async function archiveMemoryArtifactAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  await api.archiveMemoryArtifact(token, text(formData, 'artifactId'));
  revalidateMemory();
  redirect('/memory');
}

export async function addMemoryArtifactLinkAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const artifactId = text(formData, 'artifactId');
  const payload = {
    linkType: text(formData, 'linkType'),
    linkId: text(formData, 'linkId').trim(),
  };

  return submitForm(memoryArtifactLinkSchema, payload, async (input) => {
    await api.addMemoryArtifactLink(token, artifactId, input);
    revalidateMemory(artifactId);
    return { status: 'success', message: 'Link added.' };
  });
}

export async function removeMemoryArtifactLinkAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const artifactId = text(formData, 'artifactId');
  await api.removeMemoryArtifactLink(token, artifactId, text(formData, 'linkId'));
  revalidateMemory(artifactId);
  redirect(`/memory/${artifactId}`);
}

/**
 * Asks the engine to run stages again. When a stage needs a capability the
 * deployment has not configured, the job is recorded as BLOCKED with a reason
 * instead of silently succeeding, so the detail page always tells the truth.
 */
export async function reprocessMemoryArtifactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const artifactId = text(formData, 'artifactId');
  const stages = formData
    .getAll('stages')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const payload = stages.length > 0 ? { stages } : {};

  return submitForm(memoryReprocessSchema, payload, async (input) => {
    const result = await api.reprocessMemoryArtifact(token, artifactId, input);
    revalidateMemory(artifactId);
    return {
      status: 'success',
      message: `${result.jobs.length} processing job${result.jobs.length === 1 ? '' : 's'} queued.`,
    };
  });
}
