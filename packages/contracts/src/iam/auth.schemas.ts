import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  personNameSchema,
  slugSchema,
  uuidSchema,
} from '../common/primitives';
import { permissionSchema } from '../iam/permissions';
import { roleSchema } from '../iam/roles';
import { mfaRequiredResponseSchema } from './mfa.schemas';
import { assuranceLevelSchema, authenticationMethodSchema, sessionSchema } from './session.schemas';
import { principalSchema, tenantSummarySchema } from '../tenancy/tenant.schemas';

export { passwordLoginSchema as loginSchema } from './identity.schemas';
export type { PasswordLoginRequest as LoginRequest } from './identity.schemas';

export const registerChurchSchema = z.object({
  church: z.object({
    name: z.string().trim().min(2, 'Church name is required').max(120),
    slug: slugSchema,
    timezone: z.string().min(1).max(64).default('UTC'),
    locale: z.string().min(2).max(10).default('en'),
  }),
  owner: z.object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
});

export type RegisterChurchInput = z.input<typeof registerChurchSchema>;
export type RegisterChurchRequest = z.output<typeof registerChurchSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(512),
  tenantSlug: slugSchema.optional(),
});

export type RefreshRequest = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(32).max(512),
});

export type LogoutRequest = z.infer<typeof logoutSchema>;

export const loginResultSchema = z.union([sessionSchema, mfaRequiredResponseSchema]);

export type LoginResult = z.infer<typeof loginResultSchema>;

export const meResponseSchema = z.object({
  principal: principalSchema,
  activeTenant: tenantSummarySchema.nullable(),
  role: roleSchema.nullable(),
  permissions: z.array(permissionSchema),
  assuranceLevel: assuranceLevelSchema,
  mfaEnrolled: z.boolean(),
  memberships: z.array(
    z.object({
      tenantId: uuidSchema,
      tenantName: z.string(),
      tenantSlug: slugSchema,
      role: roleSchema,
      status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']),
    }),
  ),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

export const switchTenantSchema = z.object({
  tenantId: uuidSchema,
  refreshToken: z.string().min(32).max(512),
});

export type SwitchTenantRequest = z.infer<typeof switchTenantSchema>;

export const accessTokenClaimsSchema = z.object({
  sub: uuidSchema,
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
  tenantId: uuidSchema.nullable(),
  role: roleSchema.nullable(),
  sessionId: uuidSchema,
  aal: assuranceLevelSchema,
  amr: z.array(authenticationMethodSchema),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;
