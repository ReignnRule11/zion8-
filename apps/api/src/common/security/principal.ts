import type { AssuranceLevel, AuthenticationMethod, Role } from '@zion8/contracts';
import { DomainError } from '../errors/domain-error';

export interface AuthenticatedPrincipal {
  userId: string;
  email: string | null;
  phone: string | null;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  role: Role | null;
  sessionId: string;
  assuranceLevel: AssuranceLevel;
  methods: AuthenticationMethod[];
}

/**
 * The tenant is never read from the request. It is taken from the authenticated
 * principal so that every read and write runs under the row-level security
 * policy of the caller's church, on both the REST and GraphQL surfaces.
 */
export function tenantOf(principal: AuthenticatedPrincipal): string {
  if (!principal.tenantId) throw DomainError.tenantRequired();
  return principal.tenantId;
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}
