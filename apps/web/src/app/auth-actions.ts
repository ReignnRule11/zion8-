'use server';

import { redirect } from 'next/navigation';
import { loginSchema, registerChurchSchema, type RegisterChurchRequest } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { clearSessionCookies, getRefreshToken, setSessionCookies } from '@/lib/session';

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
    const session = await api.login(parsed.data);
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

  redirect('/workspace');
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
