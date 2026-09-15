import type { AssuranceLevel, AuthenticationMethod, Role } from '@zion8/contracts';

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

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}
