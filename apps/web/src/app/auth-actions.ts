'use server';

import { redirect } from 'next/navigation';
import {
  loginSchema,
  mfaVerifyRecoveryCodeSchema,
  mfaVerifyTotpSchema,
  registerChurchSchema,
  type RegisterChurchRequest,
} from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import {
  clearMfaChallengeCookie,
  clearSessionCookies,
  getAccessToken,
  getMfaChallengeToken,
  getRefreshToken,
  setMfaChallengeCookie,
  setSessionCookies,
} from '@/lib/session';

export interface AuthActionState {
  status: 'idle' | 'error';
  message?: string;
  issues?: Array<{ path: string; message: string }>;
}

export const initialAuthState: AuthActionState = { status: 'idle' };

function toState(error: unknown): AuthActionState {
  if (error instanceof ApiRequestError) {
    return { status: 'error', message: error.message, issues: error.details };
  }
  return { status: 'error', message: 'Something went wrong. Please try again.' };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
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

export async function signInAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: text(formData, 'email'),
    password: text(formData, 'password'),
    tenantSlug: text(formData, 'tenantSlug') || undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    const result = await api.login(parsed.data);
    if ('mfaRequired' in result) {
      await setMfaChallengeCookie(result.mfaToken);
      redirect('/mfa');
    }
    await setSessionCookies(result);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return toState(error);
  }

  redirect('/workspace');
}

export async function verifyMfaAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const mfaToken = await getMfaChallengeToken();
  if (!mfaToken) {
    return { status: 'error', message: 'Your verification session expired. Please sign in again.' };
  }

  const recoveryCode = text(formData, 'recoveryCode').trim();
  const parsed = recoveryCode
    ? mfaVerifyRecoveryCodeSchema.safeParse({ mfaToken, recoveryCode })
    : mfaVerifyTotpSchema.safeParse({ mfaToken, code: text(formData, 'code').trim() });

  if (!parsed.success) {
    return {
      status: 'error',
      message: recoveryCode ? 'Enter a valid recovery code.' : 'Enter the 6-digit code.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    const session = recoveryCode
      ? await api.verifyRecoveryCode(parsed.data as { mfaToken: string; recoveryCode: string })
      : await api.verifyMfa(parsed.data as { mfaToken: string; code: string });
    await clearMfaChallengeCookie();
    await setSessionCookies(session);
  } catch (error) {
    return toState(error);
  }

  redirect('/workspace');
}

export async function signUpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerChurchSchema.safeParse({
    church: {
      name: text(formData, 'churchName'),
      slug: text(formData, 'slug'),
      timezone: text(formData, 'timezone') || 'UTC',
      locale: 'en',
    },
    owner: {
      firstName: text(formData, 'firstName'),
      lastName: text(formData, 'lastName'),
      email: text(formData, 'email'),
      password: text(formData, 'password'),
    },
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    const payload: RegisterChurchRequest = parsed.data;
    const session = await api.registerChurch(payload);
    await setSessionCookies(session);
  } catch (error) {
    return toState(error);
  }

  redirect('/onboarding');
}

export async function signOutAction(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await api.logout({ refreshToken });
    } catch {
      // The local session is cleared even if the API is unreachable.
    }
  }
  await clearSessionCookies();
  redirect('/sign-in');
}

export async function requestMagicLinkAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = text(formData, 'email').trim().toLowerCase();
  const tenantSlug = text(formData, 'tenantSlug').trim() || undefined;

  try {
    await api.requestMagicLink({ email, tenantSlug });
  } catch (error) {
    return toState(error);
  }

  return { status: 'idle', message: 'If that email is registered, a sign-in link is on its way.' };
}

export async function consumeMagicLinkAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = text(formData, 'token');
  let result;
  try {
    result = await api.consumeMagicLink({ token });
  } catch (error) {
    return toState(error);
  }

  if ('mfaRequired' in result) {
    await setMfaChallengeCookie(result.mfaToken);
    redirect('/mfa');
  }

  await setSessionCookies(result);
  redirect('/workspace');
}

export async function requestPasswordResetAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = text(formData, 'email').trim().toLowerCase();

  try {
    await api.requestPasswordReset({ email });
  } catch (error) {
    return toState(error);
  }

  return {
    status: 'idle',
    message: 'If that email is registered, a password reset link is on its way.',
  };
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = text(formData, 'token');
  const newPassword = text(formData, 'newPassword');
  const confirmPassword = text(formData, 'confirmPassword');

  if (newPassword !== confirmPassword) {
    return { status: 'error', message: 'The two passwords do not match.' };
  }

  try {
    await api.resetPassword({ token, newPassword });
  } catch (error) {
    return toState(error);
  }

  redirect('/sign-in?reset=1');
}

export async function verifyEmailAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await api.verifyEmail(text(formData, 'token'));
  } catch (error) {
    return toState(error);
  }

  redirect('/sign-in?verified=1');
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const token = await getAccessToken();
  if (!token) redirect('/sign-in');

  const sessionId = text(formData, 'sessionId');
  try {
    await api.revokeSession(token, sessionId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) {
      await clearSessionCookies();
      redirect('/sign-in');
    }
    throw error;
  }

  redirect('/workspace');
}
