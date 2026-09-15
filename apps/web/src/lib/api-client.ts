import {
  apiErrorSchema,
  meResponseSchema,
  sessionSchema,
  type LoginRequest,
  type LogoutRequest,
  type MeResponse,
  type RefreshRequest,
  type RegisterChurchRequest,
  type Session,
} from '@zion8/contracts';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import { apiBaseUrl } from './env';

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  get isUnauthenticated(): boolean {
    return (
      this.status === 401 ||
      this.code === 'UNAUTHENTICATED' ||
      this.code === 'TOKEN_EXPIRED' ||
      this.code === 'TOKEN_REVOKED' ||
      this.code === 'INVALID_CREDENTIALS'
    );
  }
}

interface RequestOptions<T> {
  method: 'GET' | 'POST';
  path: string;
  schema: ZodSchema<T>;
  body?: unknown;
  token?: string;
  cache?: RequestCache;
}

async function apiRequest<T>(options: RequestOptions<T>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${options.path}`, {
    method: options.method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: options.cache ?? 'no-store',
  });

  if (response.status === 204) {
    return options.schema.parse(undefined);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiRequestError(
        parsed.data.error.code,
        parsed.data.error.message,
        response.status,
        parsed.data.error.details,
      );
    }
    throw new ApiRequestError('INTERNAL_ERROR', 'The service is unavailable.', response.status);
  }

  return options.schema.parse(payload);
}

const voidSchema = z.void();

export const api = {
  registerChurch(input: RegisterChurchRequest): Promise<Session> {
    return apiRequest({
      method: 'POST',
      path: '/auth/register-church',
      schema: sessionSchema,
      body: input,
    });
  },

  login(input: LoginRequest): Promise<Session> {
    return apiRequest({
      method: 'POST',
      path: '/auth/login',
      schema: sessionSchema,
      body: input,
    });
  },

  refresh(input: RefreshRequest): Promise<Session> {
    return apiRequest({
      method: 'POST',
      path: '/auth/refresh',
      schema: sessionSchema,
      body: input,
    });
  },

  logout(input: LogoutRequest): Promise<void> {
    return apiRequest({
      method: 'POST',
      path: '/auth/logout',
      schema: voidSchema,
      body: input,
    });
  },

  me(token: string): Promise<MeResponse> {
    return apiRequest({
      method: 'GET',
      path: '/auth/me',
      schema: meResponseSchema,
      token,
    });
  },
};
