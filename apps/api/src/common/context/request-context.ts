import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestStore {
  requestId: string;
  tenantId?: string;
  userId?: string;
  startedAt: number;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function createRequestStore(overrides: Partial<RequestStore> = {}): RequestStore {
  return {
    requestId: overrides.requestId ?? randomUUID(),
    startedAt: overrides.startedAt ?? Date.now(),
    tenantId: overrides.tenantId,
    userId: overrides.userId,
  };
}

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function currentTenantId(): string | undefined {
  return requestContext.getStore()?.tenantId;
}

export function currentUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

export function bindTenantToContext(tenantId: string | undefined): void {
  const store = requestContext.getStore();
  if (store) store.tenantId = tenantId ?? undefined;
}

export function bindUserToContext(userId: string | undefined): void {
  const store = requestContext.getStore();
  if (store) store.userId = userId ?? undefined;
}
