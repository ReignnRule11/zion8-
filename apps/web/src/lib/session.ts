import { cookies } from 'next/headers';
import type { Session } from '@zion8/contracts';

const ACCESS_COOKIE = 'zion8_access';
const REFRESH_COOKIE = 'zion8_refresh';
const MFA_COOKIE = 'zion8_mfa';
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MFA_MAX_AGE_SECONDS = 60 * 10;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function setSessionCookies(session: Session): Promise<void> {
  const store = await cookies();
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
    path: '/',
  };

  store.set(ACCESS_COOKIE, session.accessToken, {
    ...base,
    maxAge: session.expiresIn,
  });
  store.set(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, '', { path: '/', maxAge: 0 });
  store.set(REFRESH_COOKIE, '', { path: '/', maxAge: 0 });
  store.set(MFA_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function setMfaChallengeCookie(mfaToken: string): Promise<void> {
  const store = await cookies();
  store.set(MFA_COOKIE, mfaToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: MFA_MAX_AGE_SECONDS,
  });
}

export async function getMfaChallengeToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(MFA_COOKIE)?.value || undefined;
}

export async function clearMfaChallengeCookie(): Promise<void> {
  const store = await cookies();
  store.set(MFA_COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value || undefined;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value || undefined;
}
