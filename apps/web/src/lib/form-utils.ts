import { redirect } from 'next/navigation';
import { ApiRequestError } from './api-client';
import type { FormState } from './form-state';
import { getAccessToken } from './session';

/** Minimal structural view of a zod schema, so input and output types may differ. */
interface Parser<T> {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } };
}

/** Reads a form field as a string, defaulting to empty. */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Reads a form field, trimming it and treating an empty value as absent. */
export function optionalText(formData: FormData, key: string): string | undefined {
  const value = text(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

export function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === 'on' || value === 'true' || value === '1';
}

/**
 * Converts a `datetime-local` value into an ISO instant. The browser gives a
 * local wall-clock string with no zone, so we interpret it in the runtime's
 * timezone before sending it to the API, which stores instants in UTC.
 */
export function optionalDateTime(formData: FormData, key: string): string | undefined {
  const value = optionalText(formData, key);
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Converts a comma-separated tag field into the trimmed, de-duplicated list the
 * contracts expect. Empty input becomes an empty array so a create clears tags.
 */
export function commaList(formData: FormData, key: string): string[] {
  const seen = new Set<string>();
  for (const entry of text(formData, key).split(',')) {
    const tag = entry.trim();
    if (tag.length > 0) seen.add(tag);
  }
  return [...seen];
}

/** Next.js signals `redirect()` by throwing; this detects that throw. */
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

/** Resolves the caller's access token, or sends them to sign in. */
export async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) redirect('/sign-in');
  return token;
}

/** Maps an API failure onto a form state, preserving field issues. */
export function toFormState(error: unknown): FormState {
  if (error instanceof ApiRequestError) {
    return { status: 'error', message: error.message, issues: error.details };
  }
  return { status: 'error', message: 'Something went wrong. Please try again.' };
}

/** Maps local zod validation issues onto a form state. */
export function validationState(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): FormState {
  return {
    status: 'error',
    message: 'Please check the highlighted fields.',
    issues: issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Parses a plain payload with a contract schema; on success runs `handler`, and
 * on validation failure returns the issues to the form. Handlers may redirect,
 * so redirect throws are re-thrown rather than swallowed.
 */
export async function submitForm<T>(
  schema: Parser<T>,
  payload: unknown,
  handler: (value: T) => Promise<FormState>,
): Promise<FormState> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return validationState(parsed.error.issues);
  try {
    return await handler(parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toFormState(error);
  }
}
