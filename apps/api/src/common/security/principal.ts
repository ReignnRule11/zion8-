import type { Role } from '@zion8/contracts';

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  role: Role | null;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}
