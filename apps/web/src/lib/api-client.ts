import {
  apiErrorSchema,
  brandThemeResponseSchema,
  churchProfileResponseSchema,
  invitationListResponseSchema,
  invitationPreviewSchema,
  invitationSummarySchema,
  loginResultSchema,
  meResponseSchema,
  memberImportJobSchema,
  memberImportListResponseSchema,
  memberImportPreviewResponseSchema,
  onboardingStateSchema,
  onboardingSummarySchema,
  planCatalogResponseSchema,
  sessionSchema,
  sessionListResponseSchema,
  subscriptionSummarySchema,
  type AcceptInvitationRequest,
  type BrandThemeRequest,
  type BrandThemeResponse,
  type ChurchProfileRequest,
  type ChurchProfileResponse,
  type CompleteOnboardingRequest,
  type DeclineInvitationRequest,
  type InvitationListResponse,
  type InvitationPreview,
  type InvitationSummary,
  type InviteAdministratorsRequest,
  type LoginRequest,
  type LoginResult,
  type LogoutRequest,
  type MeResponse,
  type MemberImportCommitRequest,
  type MemberImportJob,
  type MemberImportListResponse,
  type MemberImportPreviewRequest,
  type MemberImportPreviewResponse,
  type OnboardingState,
  type OnboardingSummary,
  type PlanCatalogResponse,
  type RefreshRequest,
  type RegisterChurchRequest,
  type SelectSubscriptionRequest,
  type Session,
  type SessionListResponse,
  type SubscriptionSummary,
} from '@zion8/contracts';
import { z } from 'zod';
import { apiBaseUrl } from './env';

/** Minimal structural view of a zod schema: parses unknown input into T. */
interface Parser<T> {
  parse(value: unknown): T;
}

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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  schema: Parser<T>;
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

  login(input: LoginRequest): Promise<LoginResult> {
    return apiRequest({
      method: 'POST',
      path: '/auth/login',
      schema: loginResultSchema,
      body: input,
    });
  },

  verifyMfa(input: { mfaToken: string; code: string }): Promise<Session> {
    return apiRequest({
      method: 'POST',
      path: '/auth/mfa/verify',
      schema: sessionSchema,
      body: input,
    });
  },

  verifyRecoveryCode(input: { mfaToken: string; recoveryCode: string }): Promise<Session> {
    return apiRequest({
      method: 'POST',
      path: '/auth/mfa/recovery',
      schema: sessionSchema,
      body: input,
    });
  },

  requestMagicLink(input: { email: string; tenantSlug?: string }): Promise<void> {
    return apiRequest({
      method: 'POST',
      path: '/auth/magic-link',
      schema: voidSchema,
      body: input,
    });
  },

  consumeMagicLink(input: { token: string; tenantSlug?: string }): Promise<LoginResult> {
    return apiRequest({
      method: 'POST',
      path: '/auth/magic-link/consume',
      schema: loginResultSchema,
      body: input,
    });
  },

  requestPasswordReset(input: { email: string }): Promise<void> {
    return apiRequest({
      method: 'POST',
      path: '/auth/password/reset',
      schema: voidSchema,
      body: input,
    });
  },

  resetPassword(input: { token: string; newPassword: string }): Promise<void> {
    return apiRequest({
      method: 'POST',
      path: '/auth/password/reset/consume',
      schema: voidSchema,
      body: input,
    });
  },

  listSessions(token: string): Promise<SessionListResponse> {
    return apiRequest({
      method: 'GET',
      path: '/auth/sessions',
      schema: sessionListResponseSchema,
      token,
    });
  },

  revokeSession(token: string, sessionId: string): Promise<void> {
    return apiRequest({
      method: 'DELETE',
      path: `/auth/sessions/${sessionId}`,
      schema: voidSchema,
      token,
    });
  },

  verifyEmail(token: string): Promise<void> {
    return apiRequest({
      method: 'POST',
      path: '/auth/email/verify/consume',
      schema: voidSchema,
      body: { token },
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

  getOnboarding(token: string): Promise<OnboardingState> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding',
      schema: onboardingStateSchema,
      token,
    });
  },

  getOnboardingSummary(token: string): Promise<OnboardingSummary> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/summary',
      schema: onboardingSummarySchema,
      token,
    });
  },

  completeOnboarding(token: string, input: CompleteOnboardingRequest): Promise<OnboardingState> {
    return apiRequest({
      method: 'POST',
      path: '/onboarding/complete',
      schema: onboardingStateSchema,
      body: input,
      token,
    });
  },

  skipOnboardingStep(token: string, step: string): Promise<OnboardingState> {
    return apiRequest({
      method: 'POST',
      path: `/onboarding/steps/${step}/skip`,
      schema: onboardingStateSchema,
      token,
    });
  },

  retryOnboardingStep(token: string, step: string): Promise<OnboardingState> {
    return apiRequest({
      method: 'POST',
      path: `/onboarding/steps/${step}/retry`,
      schema: onboardingStateSchema,
      token,
    });
  },

  getWorkspace(token: string): Promise<ChurchProfileResponse | null> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/workspace',
      schema: churchProfileResponseSchema.nullable(),
      token,
    });
  },

  saveWorkspace(token: string, input: ChurchProfileRequest): Promise<ChurchProfileResponse> {
    return apiRequest({
      method: 'PUT',
      path: '/onboarding/workspace',
      schema: churchProfileResponseSchema,
      body: input,
      token,
    });
  },

  getBranding(token: string): Promise<BrandThemeResponse | null> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/branding',
      schema: brandThemeResponseSchema.nullable(),
      token,
    });
  },

  saveBranding(token: string, input: BrandThemeRequest): Promise<BrandThemeResponse> {
    return apiRequest({
      method: 'PUT',
      path: '/onboarding/branding',
      schema: brandThemeResponseSchema,
      body: input,
      token,
    });
  },

  getPlanCatalog(token: string): Promise<PlanCatalogResponse> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/subscription/catalog',
      schema: planCatalogResponseSchema,
      token,
    });
  },

  getSubscription(token: string): Promise<SubscriptionSummary | null> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/subscription',
      schema: subscriptionSummarySchema.nullable(),
      token,
    });
  },

  selectSubscription(
    token: string,
    input: SelectSubscriptionRequest,
  ): Promise<SubscriptionSummary> {
    return apiRequest({
      method: 'PUT',
      path: '/onboarding/subscription',
      schema: subscriptionSummarySchema,
      body: input,
      token,
    });
  },

  listInvitations(token: string): Promise<InvitationListResponse> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/invitations',
      schema: invitationListResponseSchema,
      token,
    });
  },

  inviteAdministrators(
    token: string,
    input: InviteAdministratorsRequest,
  ): Promise<InvitationListResponse> {
    return apiRequest({
      method: 'POST',
      path: '/onboarding/invitations',
      schema: invitationListResponseSchema,
      body: input,
      token,
    });
  },

  resendInvitation(token: string, invitationId: string): Promise<InvitationSummary> {
    return apiRequest({
      method: 'POST',
      path: `/onboarding/invitations/${invitationId}/resend`,
      schema: invitationSummarySchema,
      token,
    });
  },

  revokeInvitation(token: string, invitationId: string): Promise<InvitationSummary> {
    return apiRequest({
      method: 'DELETE',
      path: `/onboarding/invitations/${invitationId}`,
      schema: invitationSummarySchema,
      token,
    });
  },

  previewInvitation(token: string): Promise<InvitationPreview> {
    return apiRequest({
      method: 'GET',
      path: `/onboarding/invitations/preview?token=${encodeURIComponent(token)}`,
      schema: invitationPreviewSchema,
    });
  },

  acceptInvitation(input: AcceptInvitationRequest): Promise<Session> {
    return apiRequest({
      method: 'POST',
      path: '/onboarding/invitations/accept',
      schema: sessionSchema,
      body: input,
    });
  },

  declineInvitation(input: DeclineInvitationRequest): Promise<void> {
    return apiRequest({
      method: 'POST',
      path: '/onboarding/invitations/decline',
      schema: voidSchema,
      body: input,
    });
  },

  listMemberImports(token: string): Promise<MemberImportListResponse> {
    return apiRequest({
      method: 'GET',
      path: '/onboarding/member-imports',
      schema: memberImportListResponseSchema,
      token,
    });
  },

  getMemberImport(token: string, jobId: string): Promise<MemberImportJob> {
    return apiRequest({
      method: 'GET',
      path: `/onboarding/member-imports/${jobId}`,
      schema: memberImportJobSchema,
      token,
    });
  },

  previewMemberImport(
    token: string,
    input: MemberImportPreviewRequest,
  ): Promise<MemberImportPreviewResponse> {
    return apiRequest({
      method: 'POST',
      path: '/onboarding/member-imports/preview',
      schema: memberImportPreviewResponseSchema,
      body: input,
      token,
    });
  },

  commitMemberImport(token: string, input: MemberImportCommitRequest): Promise<MemberImportJob> {
    return apiRequest({
      method: 'POST',
      path: '/onboarding/member-imports/commit',
      schema: memberImportJobSchema,
      body: input,
      token,
    });
  },
};
