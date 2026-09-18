'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  acceptInvitationSchema,
  brandThemeSchema,
  churchProfileSchema,
  declineInvitationSchema,
  inviteAdministratorsSchema,
  memberImportPreviewSchema,
  selectSubscriptionSchema,
  type OnboardingStep,
} from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { getAccessToken, setSessionCookies } from '@/lib/session';
import type { OnboardingFormState } from './state';

function toState(error: unknown): OnboardingFormState {
  if (error instanceof ApiRequestError) {
    return { status: 'error', message: error.message, issues: error.details };
  }
  return { status: 'error', message: 'Something went wrong. Please try again.' };
}

function validationState(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): OnboardingFormState {
  return {
    status: 'error',
    message: 'Please check the highlighted fields.',
    issues: issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function optionalText(formData: FormData, key: string): string | undefined {
  const value = text(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) redirect('/sign-in');
  return token;
}

const PROFILE_TEXT_FIELDS = [
  'legalName',
  'contactEmail',
  'contactPhone',
  'websiteUrl',
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'postalCode',
  'countryCode',
] as const;

export async function saveWorkspaceAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const token = await requireToken();

  const payload: Record<string, unknown> = {
    currency: optionalText(formData, 'currency') ?? 'USD',
    weekStart: optionalText(formData, 'weekStart') ?? 'SUNDAY',
  };
  for (const key of PROFILE_TEXT_FIELDS) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }
  const estimatedMembers = optionalText(formData, 'estimatedMembers');
  if (estimatedMembers !== undefined) payload.estimatedMembers = Number(estimatedMembers);

  const serviceTimes = optionalText(formData, 'serviceTimes');
  if (serviceTimes !== undefined) {
    try {
      payload.serviceTimes = JSON.parse(serviceTimes);
    } catch {
      return { status: 'error', message: 'Could not read the service schedule. Please try again.' };
    }
  }

  const parsed = churchProfileSchema.safeParse(payload);
  if (!parsed.success) return validationState(parsed.error.issues);

  try {
    await api.saveWorkspace(token, parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toState(error);
  }

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function saveBrandingAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const token = await requireToken();

  const payload: Record<string, unknown> = {
    primaryColor: optionalText(formData, 'primaryColor') ?? '#4f46e5',
    secondaryColor: optionalText(formData, 'secondaryColor') ?? '#0f172a',
    accentColor: optionalText(formData, 'accentColor') ?? '#38bdf8',
  };
  for (const key of [
    'displayName',
    'tagline',
    'logoUrl',
    'faviconUrl',
    'customDomain',
    'welcomeMessage',
  ] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }

  const parsed = brandThemeSchema.safeParse(payload);
  if (!parsed.success) return validationState(parsed.error.issues);

  try {
    await api.saveBranding(token, parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toState(error);
  }

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function selectSubscriptionAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const token = await requireToken();

  const payload: Record<string, unknown> = {
    plan: optionalText(formData, 'plan'),
    billingCycle: optionalText(formData, 'billingCycle') ?? 'MONTHLY',
  };
  const seats = optionalText(formData, 'seats');
  if (seats !== undefined) payload.seats = Number(seats);

  const parsed = selectSubscriptionSchema.safeParse(payload);
  if (!parsed.success) return validationState(parsed.error.issues);

  try {
    await api.selectSubscription(token, parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toState(error);
  }

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function inviteAdministratorsAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const token = await requireToken();

  let invitations: unknown;
  try {
    invitations = JSON.parse(text(formData, 'invitations'));
  } catch {
    return { status: 'error', message: 'Could not read the invitation list. Please try again.' };
  }

  const parsed = inviteAdministratorsSchema.safeParse({ invitations });
  if (!parsed.success) return validationState(parsed.error.issues);

  try {
    await api.inviteAdministrators(token, parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toState(error);
  }

  revalidatePath('/onboarding');
  redirect('/onboarding?step=ADMINISTRATOR_INVITATION');
}

export async function resendInvitationAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  try {
    await api.resendInvitation(token, text(formData, 'invitationId'));
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }
  revalidatePath('/onboarding');
  redirect('/onboarding?step=ADMINISTRATOR_INVITATION');
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  try {
    await api.revokeInvitation(token, text(formData, 'invitationId'));
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }
  revalidatePath('/onboarding');
  redirect('/onboarding?step=ADMINISTRATOR_INVITATION');
}

export async function previewMemberImportAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const token = await requireToken();

  const parsed = memberImportPreviewSchema.safeParse({
    fileName: optionalText(formData, 'fileName'),
    csv: optionalText(formData, 'csv'),
  });
  if (!parsed.success) return validationState(parsed.error.issues);

  try {
    const result = await api.previewMemberImport(token, parsed.data);
    return {
      status: 'success',
      message: `${result.job.validRows} of ${result.job.totalRows} rows are ready to import.`,
      job: result.job,
      preview: result.preview,
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toState(error);
  }
}

export async function commitMemberImportAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const token = await requireToken();
  const jobId = text(formData, 'jobId');

  try {
    await api.commitMemberImport(token, { jobId });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    return toState(error);
  }

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function skipStepAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const step = text(formData, 'step') as OnboardingStep;
  try {
    await api.skipOnboardingStep(token, step);
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }
  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function retryStepAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const step = text(formData, 'step') as OnboardingStep;
  try {
    await api.retryOnboardingStep(token, step);
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }
  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function completeOnboardingAction(): Promise<void> {
  const token = await requireToken();
  try {
    await api.completeOnboarding(token, { acknowledgeOptionalSteps: true });
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }
  revalidatePath('/workspace');
  redirect('/workspace');
}

export async function acceptInvitationAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = acceptInvitationSchema.safeParse({
    token: text(formData, 'token'),
    firstName: optionalText(formData, 'firstName'),
    lastName: optionalText(formData, 'lastName'),
    password: optionalText(formData, 'password'),
  });
  if (!parsed.success) return validationState(parsed.error.issues);

  let session;
  try {
    session = await api.acceptInvitation(parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return toState(error);
  }

  await setSessionCookies(session);
  redirect('/workspace');
}

export async function declineInvitationAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = declineInvitationSchema.safeParse({ token: text(formData, 'token') });
  if (!parsed.success) return validationState(parsed.error.issues);

  try {
    await api.declineInvitation(parsed.data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return toState(error);
  }

  return { status: 'success', message: 'You have declined this invitation.' };
}
