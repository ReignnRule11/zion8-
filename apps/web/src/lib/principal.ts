import { redirect } from 'next/navigation';
import type { MeResponse, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from './api-client';
import { requireToken } from './form-utils';

export interface LoadedPrincipal {
  token: string;
  me: MeResponse;
}

/**
 * Loads the signed-in principal for a dashboard page. Every membership page needs
 * both the access token (to call the API) and the granted permissions (to decide
 * which actions to render), so this resolves them together and sends the user to
 * sign in when the session is no longer valid.
 */
export async function loadPrincipal(): Promise<LoadedPrincipal> {
  const token = await requireToken();
  try {
    const me = await api.me(token);
    return { token, me };
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }
}

/** True when the principal holds the permission in the current workspace. */
export function can(me: MeResponse, permission: Permission): boolean {
  return me.permissions.includes(permission);
}

/** True when the principal holds every listed permission. */
export function canAll(me: MeResponse, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => me.permissions.includes(permission));
}
