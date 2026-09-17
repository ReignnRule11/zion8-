import {
  apiErrorSchema,
  attendanceRecordSchema,
  attendanceSessionPageSchema,
  attendanceSessionResponseSchema,
  brandThemeResponseSchema,
  churchProfileResponseSchema,
  departmentMemberSchema,
  departmentPageSchema,
  departmentResponseSchema,
  documentDownloadSchema,
  documentPageSchema,
  documentResponseSchema,
  familyPageSchema,
  familyResponseSchema,
  invitationListResponseSchema,
  invitationPreviewSchema,
  invitationSummarySchema,
  loginResultSchema,
  meResponseSchema,
  memberAiSummaryResponseSchema,
  memberAttendanceStatsSchema,
  memberImportJobSchema,
  memberImportListResponseSchema,
  memberImportPreviewResponseSchema,
  memberPageSchema,
  memberProfileSchema,
  memberResponseSchema,
  memoryArtifactDownloadSchema,
  memoryArtifactPageSchema,
  memoryArtifactResponseSchema,
  memoryJobSummarySchema,
  memoryReprocessResponseSchema,
  onboardingStateSchema,
  sermonGenerateResponseSchema,
  sermonJobSummarySchema,
  sermonNotePageSchema,
  sermonNoteSchema,
  sermonPageSchema,
  sermonRecommendationPageSchema,
  sermonReprocessResponseSchema,
  sermonResponseSchema,
  sermonSeriesPageSchema,
  sermonSeriesResponseSchema,
  sermonShareSchema,
  sermonTranscriptSchema,
  onboardingSummarySchema,
  planCatalogResponseSchema,
  relationshipGraphSchema,
  relationshipPageSchema,
  relationshipResponseSchema,
  sessionListResponseSchema,
  sessionSchema,
  subscriptionSummarySchema,
  timelineEntryResponseSchema,
  timelinePageSchema,
  visitorPageSchema,
  visitorResponseSchema,
  visitorVisitResponseSchema,
  volunteerAssignmentResponseSchema,
  volunteerRolePageSchema,
  volunteerRoleResponseSchema,
  type AcceptInvitationRequest,
  type AttendanceBulkMarkRequest,
  type AttendanceMarkRequest,
  type AttendanceRecord,
  type AttendanceSessionListQuery,
  type AttendanceSessionPage,
  type AttendanceSessionRequest,
  type AttendanceSessionResponse,
  type AttendanceSessionUpdateRequest,
  type BrandThemeRequest,
  type BrandThemeResponse,
  type ChurchProfileRequest,
  type ChurchProfileResponse,
  type CompleteOnboardingRequest,
  type DeclineInvitationRequest,
  type DepartmentListQuery,
  type DepartmentMember,
  type DepartmentMemberAddRequest,
  type DepartmentMemberUpdateRequest,
  type DepartmentPage,
  type DepartmentRequest,
  type DepartmentResponse,
  type DepartmentUpdateRequest,
  type DocumentDownload,
  type DocumentListQuery,
  type DocumentPage,
  type DocumentResponse,
  type DocumentUpdateRequest,
  type DocumentUploadRequest,
  type FamilyListQuery,
  type FamilyMemberAddRequest,
  type FamilyPage,
  type FamilyRequest,
  type FamilyResponse,
  type FamilyUpdateRequest,
  type GenerateSummaryRequest,
  type InvitationListResponse,
  type InvitationPreview,
  type InvitationSummary,
  type InviteAdministratorsRequest,
  type LoginRequest,
  type LoginResult,
  type LogoutRequest,
  type MeResponse,
  type MemberAiSummaryResponse,
  type MemberAttendanceStats,
  type MemberImportCommitRequest,
  type MemberImportJob,
  type MemberImportListResponse,
  type MemberImportPreviewRequest,
  type MemberImportPreviewResponse,
  type MemberListQuery,
  type MemberPage,
  type MemberProfile,
  type MemberRequest,
  type MemberResponse,
  type MemberUpdateRequest,
  type MemoryArtifactCreateRequest,
  type MemoryArtifactDownload,
  type MemoryArtifactLinkRequest,
  type MemoryArtifactListQuery,
  type MemoryArtifactPage,
  type MemoryArtifactResponse,
  type MemoryArtifactUpdateRequest,
  type MemoryJobSummary,
  type MemoryReprocessRequest,
  type MemoryReprocessResponse,
  type MemoryVersionQuery,
  type OnboardingState,
  type OnboardingSummary,
  type PlanCatalogResponse,
  type RefreshRequest,
  type RegisterChurchRequest,
  type RelationshipGraph,
  type RelationshipGraphQuery,
  type RelationshipListQuery,
  type RelationshipPage,
  type RelationshipRequest,
  type RelationshipResponse,
  type SermonCreateRequest,
  type SermonGenerateRequest,
  type SermonGenerateResponse,
  type SermonJobSummary,
  type SermonListQuery,
  type SermonNote,
  type SermonNoteCreateRequest,
  type SermonNoteListQuery,
  type SermonNotePage,
  type SermonNoteUpdateRequest,
  type SermonPage,
  type SermonPublishRequest,
  type SermonRecommendationPage,
  type SermonReprocessRequest,
  type SermonReprocessResponse,
  type SermonResponse,
  type SermonSearchQuery,
  type SermonSeriesCreateRequest,
  type SermonSeriesListQuery,
  type SermonSeriesPage,
  type SermonSeriesResponse,
  type SermonSeriesUpdateRequest,
  type SermonShare,
  type SermonShareCreateRequest,
  type SermonTranscript,
  type SermonTranscriptUpsertRequest,
  type SermonUpdateRequest,
  type SelectSubscriptionRequest,
  type Session,
  type SessionListResponse,
  type SubscriptionSummary,
  type TimelineEntryResponse,
  type TimelineNoteRequest,
  type TimelinePage,
  type TimelineQuery,
  type VisitorConvertRequest,
  type VisitorListQuery,
  type VisitorPage,
  type VisitorRequest,
  type VisitorResponse,
  type VisitorUpdateRequest,
  type VisitorVisitRequest,
  type VisitorVisitResponse,
  type VolunteerAssignmentRequest,
  type VolunteerAssignmentResponse,
  type VolunteerAssignmentUpdateRequest,
  type VolunteerRoleListQuery,
  type VolunteerRolePage,
  type VolunteerRoleRequest,
  type VolunteerRoleResponse,
  type VolunteerRoleUpdateRequest,
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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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

/**
 * Serialises a query object into a query string. Repeated values (for example a
 * multi-select filter) become repeated keys, which is what the API's zod union
 * accepts, and empty values are dropped so defaults apply on the server.
 */
function toQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

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

  // Members -----------------------------------------------------------------

  createMember(token: string, input: MemberRequest): Promise<MemberResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/members',
      schema: memberResponseSchema,
      body: input,
      token,
    });
  },

  listMembers(token: string, query?: MemberListQuery): Promise<MemberPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/members${toQuery(query)}`,
      schema: memberPageSchema,
      token,
    });
  },

  getMember(token: string, memberId: string): Promise<MemberResponse> {
    return apiRequest({
      method: 'GET',
      path: `/membership/members/${memberId}`,
      schema: memberResponseSchema,
      token,
    });
  },

  getMemberProfile(token: string, memberId: string): Promise<MemberProfile> {
    return apiRequest({
      method: 'GET',
      path: `/membership/members/${memberId}/profile`,
      schema: memberProfileSchema,
      token,
    });
  },

  updateMember(token: string, memberId: string, input: MemberUpdateRequest): Promise<MemberResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/members/${memberId}`,
      schema: memberResponseSchema,
      body: input,
      token,
    });
  },

  archiveMember(token: string, memberId: string): Promise<MemberResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/members/${memberId}`,
      schema: memberResponseSchema,
      token,
    });
  },

  // Families ----------------------------------------------------------------

  createFamily(token: string, input: FamilyRequest): Promise<FamilyResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/families',
      schema: familyResponseSchema,
      body: input,
      token,
    });
  },

  listFamilies(token: string, query?: FamilyListQuery): Promise<FamilyPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/families${toQuery(query)}`,
      schema: familyPageSchema,
      token,
    });
  },

  getFamily(token: string, familyId: string): Promise<FamilyResponse> {
    return apiRequest({
      method: 'GET',
      path: `/membership/families/${familyId}`,
      schema: familyResponseSchema,
      token,
    });
  },

  updateFamily(token: string, familyId: string, input: FamilyUpdateRequest): Promise<FamilyResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/families/${familyId}`,
      schema: familyResponseSchema,
      body: input,
      token,
    });
  },

  addFamilyMember(
    token: string,
    familyId: string,
    input: FamilyMemberAddRequest,
  ): Promise<FamilyResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/families/${familyId}/members`,
      schema: familyResponseSchema,
      body: input,
      token,
    });
  },

  removeFamilyMember(token: string, familyId: string, memberId: string): Promise<FamilyResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/families/${familyId}/members/${memberId}`,
      schema: familyResponseSchema,
      token,
    });
  },

  // Relationships -----------------------------------------------------------

  createRelationship(token: string, input: RelationshipRequest): Promise<RelationshipResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/relationships',
      schema: relationshipResponseSchema,
      body: input,
      token,
    });
  },

  listRelationships(token: string, query?: RelationshipListQuery): Promise<RelationshipPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/relationships${toQuery(query)}`,
      schema: relationshipPageSchema,
      token,
    });
  },

  relationshipGraph(token: string, query: RelationshipGraphQuery): Promise<RelationshipGraph> {
    return apiRequest({
      method: 'GET',
      path: `/membership/relationships/graph${toQuery(query)}`,
      schema: relationshipGraphSchema,
      token,
    });
  },

  removeRelationship(token: string, relationshipId: string): Promise<void> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/relationships/${relationshipId}`,
      schema: voidSchema,
      token,
    });
  },

  // Visitors ----------------------------------------------------------------

  createVisitor(token: string, input: VisitorRequest): Promise<VisitorResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/visitors',
      schema: visitorResponseSchema,
      body: input,
      token,
    });
  },

  listVisitors(token: string, query?: VisitorListQuery): Promise<VisitorPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/visitors${toQuery(query)}`,
      schema: visitorPageSchema,
      token,
    });
  },

  getVisitor(token: string, visitorId: string): Promise<VisitorResponse> {
    return apiRequest({
      method: 'GET',
      path: `/membership/visitors/${visitorId}`,
      schema: visitorResponseSchema,
      token,
    });
  },

  updateVisitor(
    token: string,
    visitorId: string,
    input: VisitorUpdateRequest,
  ): Promise<VisitorResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/visitors/${visitorId}`,
      schema: visitorResponseSchema,
      body: input,
      token,
    });
  },

  addVisitorVisit(
    token: string,
    visitorId: string,
    input: VisitorVisitRequest,
  ): Promise<VisitorVisitResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/visitors/${visitorId}/visits`,
      schema: visitorVisitResponseSchema,
      body: input,
      token,
    });
  },

  convertVisitor(
    token: string,
    visitorId: string,
    input: VisitorConvertRequest,
  ): Promise<VisitorResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/visitors/${visitorId}/convert`,
      schema: visitorResponseSchema,
      body: input,
      token,
    });
  },

  // Attendance --------------------------------------------------------------

  createAttendanceSession(
    token: string,
    input: AttendanceSessionRequest,
  ): Promise<AttendanceSessionResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/attendance/sessions',
      schema: attendanceSessionResponseSchema,
      body: input,
      token,
    });
  },

  listAttendanceSessions(
    token: string,
    query?: AttendanceSessionListQuery,
  ): Promise<AttendanceSessionPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/attendance/sessions${toQuery(query)}`,
      schema: attendanceSessionPageSchema,
      token,
    });
  },

  getAttendanceSession(token: string, sessionId: string): Promise<AttendanceSessionResponse> {
    return apiRequest({
      method: 'GET',
      path: `/membership/attendance/sessions/${sessionId}`,
      schema: attendanceSessionResponseSchema,
      token,
    });
  },

  updateAttendanceSession(
    token: string,
    sessionId: string,
    input: AttendanceSessionUpdateRequest,
  ): Promise<AttendanceSessionResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/attendance/sessions/${sessionId}`,
      schema: attendanceSessionResponseSchema,
      body: input,
      token,
    });
  },

  closeAttendanceSession(token: string, sessionId: string): Promise<AttendanceSessionResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/attendance/sessions/${sessionId}/close`,
      schema: attendanceSessionResponseSchema,
      token,
    });
  },

  markAttendance(
    token: string,
    sessionId: string,
    input: AttendanceMarkRequest,
  ): Promise<AttendanceRecord> {
    return apiRequest({
      method: 'POST',
      path: `/membership/attendance/sessions/${sessionId}/mark`,
      schema: attendanceRecordSchema,
      body: input,
      token,
    });
  },

  bulkMarkAttendance(
    token: string,
    sessionId: string,
    input: AttendanceBulkMarkRequest,
  ): Promise<AttendanceRecord[]> {
    return apiRequest({
      method: 'POST',
      path: `/membership/attendance/sessions/${sessionId}/bulk-mark`,
      schema: z.array(attendanceRecordSchema),
      body: input,
      token,
    });
  },

  memberAttendanceStats(token: string, memberId: string): Promise<MemberAttendanceStats> {
    return apiRequest({
      method: 'GET',
      path: `/membership/attendance/members/${memberId}/stats`,
      schema: memberAttendanceStatsSchema,
      token,
    });
  },

  // Departments -------------------------------------------------------------

  createDepartment(token: string, input: DepartmentRequest): Promise<DepartmentResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/departments',
      schema: departmentResponseSchema,
      body: input,
      token,
    });
  },

  listDepartments(token: string, query?: DepartmentListQuery): Promise<DepartmentPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/departments${toQuery(query)}`,
      schema: departmentPageSchema,
      token,
    });
  },

  getDepartment(token: string, departmentId: string): Promise<DepartmentResponse> {
    return apiRequest({
      method: 'GET',
      path: `/membership/departments/${departmentId}`,
      schema: departmentResponseSchema,
      token,
    });
  },

  updateDepartment(
    token: string,
    departmentId: string,
    input: DepartmentUpdateRequest,
  ): Promise<DepartmentResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/departments/${departmentId}`,
      schema: departmentResponseSchema,
      body: input,
      token,
    });
  },

  addDepartmentMember(
    token: string,
    departmentId: string,
    input: DepartmentMemberAddRequest,
  ): Promise<DepartmentMember> {
    return apiRequest({
      method: 'POST',
      path: `/membership/departments/${departmentId}/members`,
      schema: departmentMemberSchema,
      body: input,
      token,
    });
  },

  updateDepartmentMember(
    token: string,
    departmentId: string,
    memberId: string,
    input: DepartmentMemberUpdateRequest,
  ): Promise<DepartmentMember> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/departments/${departmentId}/members/${memberId}`,
      schema: departmentMemberSchema,
      body: input,
      token,
    });
  },

  removeDepartmentMember(
    token: string,
    departmentId: string,
    memberId: string,
  ): Promise<void> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/departments/${departmentId}/members/${memberId}`,
      schema: voidSchema,
      token,
    });
  },

  // Volunteer roles ---------------------------------------------------------

  createVolunteerRole(token: string, input: VolunteerRoleRequest): Promise<VolunteerRoleResponse> {
    return apiRequest({
      method: 'POST',
      path: '/membership/volunteer-roles',
      schema: volunteerRoleResponseSchema,
      body: input,
      token,
    });
  },

  listVolunteerRoles(
    token: string,
    query?: VolunteerRoleListQuery,
  ): Promise<VolunteerRolePage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/volunteer-roles${toQuery(query)}`,
      schema: volunteerRolePageSchema,
      token,
    });
  },

  getVolunteerRole(token: string, roleId: string): Promise<VolunteerRoleResponse> {
    return apiRequest({
      method: 'GET',
      path: `/membership/volunteer-roles/${roleId}`,
      schema: volunteerRoleResponseSchema,
      token,
    });
  },

  updateVolunteerRole(
    token: string,
    roleId: string,
    input: VolunteerRoleUpdateRequest,
  ): Promise<VolunteerRoleResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/volunteer-roles/${roleId}`,
      schema: volunteerRoleResponseSchema,
      body: input,
      token,
    });
  },

  assignVolunteer(
    token: string,
    roleId: string,
    input: VolunteerAssignmentRequest,
  ): Promise<VolunteerAssignmentResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/volunteer-roles/${roleId}/assignments`,
      schema: volunteerAssignmentResponseSchema,
      body: input,
      token,
    });
  },

  updateVolunteerAssignment(
    token: string,
    roleId: string,
    assignmentId: string,
    input: VolunteerAssignmentUpdateRequest,
  ): Promise<VolunteerAssignmentResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/volunteer-roles/${roleId}/assignments/${assignmentId}`,
      schema: volunteerAssignmentResponseSchema,
      body: input,
      token,
    });
  },

  endVolunteerAssignment(token: string, roleId: string, assignmentId: string): Promise<void> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/volunteer-roles/${roleId}/assignments/${assignmentId}`,
      schema: voidSchema,
      token,
    });
  },

  // Timeline ----------------------------------------------------------------

  listTimeline(token: string, memberId: string, query?: TimelineQuery): Promise<TimelinePage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/members/${memberId}/timeline${toQuery(query)}`,
      schema: timelinePageSchema,
      token,
    });
  },

  addTimelineNote(
    token: string,
    memberId: string,
    input: TimelineNoteRequest,
  ): Promise<TimelineEntryResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/members/${memberId}/timeline/notes`,
      schema: timelineEntryResponseSchema,
      body: input,
      token,
    });
  },

  deleteTimelineNote(token: string, noteId: string): Promise<void> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/timeline/notes/${noteId}`,
      schema: voidSchema,
      token,
    });
  },

  // Documents ---------------------------------------------------------------

  uploadDocument(
    token: string,
    memberId: string,
    input: DocumentUploadRequest,
  ): Promise<DocumentResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/members/${memberId}/documents`,
      schema: documentResponseSchema,
      body: input,
      token,
    });
  },

  listDocuments(token: string, memberId: string, query?: DocumentListQuery): Promise<DocumentPage> {
    return apiRequest({
      method: 'GET',
      path: `/membership/members/${memberId}/documents${toQuery(query)}`,
      schema: documentPageSchema,
      token,
    });
  },

  updateDocument(
    token: string,
    documentId: string,
    input: DocumentUpdateRequest,
  ): Promise<DocumentResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/membership/documents/${documentId}`,
      schema: documentResponseSchema,
      body: input,
      token,
    });
  },

  archiveDocument(token: string, documentId: string): Promise<DocumentResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/membership/documents/${documentId}`,
      schema: documentResponseSchema,
      token,
    });
  },

  downloadDocument(token: string, documentId: string): Promise<DocumentDownload> {
    return apiRequest({
      method: 'GET',
      path: `/membership/documents/${documentId}/download`,
      schema: documentDownloadSchema,
      token,
    });
  },

  // AI summary --------------------------------------------------------------

  getMemberSummary(token: string, memberId: string): Promise<MemberAiSummaryResponse | null> {
    return apiRequest({
      method: 'GET',
      path: `/membership/members/${memberId}/summary`,
      schema: memberAiSummaryResponseSchema.nullable(),
      token,
    });
  },

  generateMemberSummary(
    token: string,
    memberId: string,
    input: GenerateSummaryRequest,
  ): Promise<MemberAiSummaryResponse> {
    return apiRequest({
      method: 'POST',
      path: `/membership/members/${memberId}/summary`,
      schema: memberAiSummaryResponseSchema,
      body: input,
      token,
    });
  },

  // Digital Memory Engine ---------------------------------------------------

  createMemoryArtifact(
    token: string,
    input: MemoryArtifactCreateRequest,
  ): Promise<MemoryArtifactResponse> {
    return apiRequest({
      method: 'POST',
      path: '/memory/artifacts',
      schema: memoryArtifactResponseSchema,
      body: input,
      token,
    });
  },

  listMemoryArtifacts(token: string, query?: MemoryArtifactListQuery): Promise<MemoryArtifactPage> {
    return apiRequest({
      method: 'GET',
      path: `/memory/artifacts${toQuery(query)}`,
      schema: memoryArtifactPageSchema,
      token,
    });
  },

  getMemoryArtifact(token: string, artifactId: string): Promise<MemoryArtifactResponse> {
    return apiRequest({
      method: 'GET',
      path: `/memory/artifacts/${artifactId}`,
      schema: memoryArtifactResponseSchema,
      token,
    });
  },

  updateMemoryArtifact(
    token: string,
    artifactId: string,
    input: MemoryArtifactUpdateRequest,
  ): Promise<MemoryArtifactResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/memory/artifacts/${artifactId}`,
      schema: memoryArtifactResponseSchema,
      body: input,
      token,
    });
  },

  archiveMemoryArtifact(token: string, artifactId: string): Promise<MemoryArtifactResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/memory/artifacts/${artifactId}`,
      schema: memoryArtifactResponseSchema,
      token,
    });
  },

  addMemoryArtifactLink(
    token: string,
    artifactId: string,
    input: MemoryArtifactLinkRequest,
  ): Promise<MemoryArtifactResponse> {
    return apiRequest({
      method: 'POST',
      path: `/memory/artifacts/${artifactId}/links`,
      schema: memoryArtifactResponseSchema,
      body: input,
      token,
    });
  },

  removeMemoryArtifactLink(
    token: string,
    artifactId: string,
    linkId: string,
  ): Promise<MemoryArtifactResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/memory/artifacts/${artifactId}/links/${linkId}`,
      schema: memoryArtifactResponseSchema,
      token,
    });
  },

  reprocessMemoryArtifact(
    token: string,
    artifactId: string,
    input: MemoryReprocessRequest,
  ): Promise<MemoryReprocessResponse> {
    return apiRequest({
      method: 'POST',
      path: `/memory/artifacts/${artifactId}/reprocess`,
      schema: memoryReprocessResponseSchema,
      body: input,
      token,
    });
  },

  listMemoryJobs(token: string, artifactId: string): Promise<MemoryJobSummary[]> {
    return apiRequest({
      method: 'GET',
      path: `/memory/artifacts/${artifactId}/jobs`,
      schema: z.array(memoryJobSummarySchema),
      token,
    });
  },

  downloadMemoryArtifact(
    token: string,
    artifactId: string,
    query?: MemoryVersionQuery,
  ): Promise<MemoryArtifactDownload> {
    return apiRequest({
      method: 'GET',
      path: `/memory/artifacts/${artifactId}/download${toQuery(query)}`,
      schema: memoryArtifactDownloadSchema,
      token,
    });
  },

  // Sermons -----------------------------------------------------------------

  createSermonSeries(
    token: string,
    input: SermonSeriesCreateRequest,
  ): Promise<SermonSeriesResponse> {
    return apiRequest({
      method: 'POST',
      path: '/sermons/series',
      schema: sermonSeriesResponseSchema,
      body: input,
      token,
    });
  },

  listSermonSeries(token: string, query?: SermonSeriesListQuery): Promise<SermonSeriesPage> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/series${toQuery(query)}`,
      schema: sermonSeriesPageSchema,
      token,
    });
  },

  getSermonSeries(token: string, seriesId: string): Promise<SermonSeriesResponse> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/series/${seriesId}`,
      schema: sermonSeriesResponseSchema,
      token,
    });
  },

  updateSermonSeries(
    token: string,
    seriesId: string,
    input: SermonSeriesUpdateRequest,
  ): Promise<SermonSeriesResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/sermons/series/${seriesId}`,
      schema: sermonSeriesResponseSchema,
      body: input,
      token,
    });
  },

  archiveSermonSeries(token: string, seriesId: string): Promise<SermonSeriesResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/sermons/series/${seriesId}`,
      schema: sermonSeriesResponseSchema,
      token,
    });
  },

  createSermon(token: string, input: SermonCreateRequest): Promise<SermonResponse> {
    return apiRequest({
      method: 'POST',
      path: '/sermons',
      schema: sermonResponseSchema,
      body: input,
      token,
    });
  },

  listSermons(token: string, query?: SermonListQuery): Promise<SermonPage> {
    return apiRequest({
      method: 'GET',
      path: `/sermons${toQuery(query)}`,
      schema: sermonPageSchema,
      token,
    });
  },

  searchSermons(token: string, query: SermonSearchQuery): Promise<SermonPage> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/search${toQuery(query)}`,
      schema: sermonPageSchema,
      token,
    });
  },

  getSermon(token: string, sermonId: string): Promise<SermonResponse> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/${sermonId}`,
      schema: sermonResponseSchema,
      token,
    });
  },

  updateSermon(
    token: string,
    sermonId: string,
    input: SermonUpdateRequest,
  ): Promise<SermonResponse> {
    return apiRequest({
      method: 'PATCH',
      path: `/sermons/${sermonId}`,
      schema: sermonResponseSchema,
      body: input,
      token,
    });
  },

  publishSermon(
    token: string,
    sermonId: string,
    input?: SermonPublishRequest,
  ): Promise<SermonResponse> {
    return apiRequest({
      method: 'POST',
      path: `/sermons/${sermonId}/publish`,
      schema: sermonResponseSchema,
      body: input ?? {},
      token,
    });
  },

  archiveSermon(token: string, sermonId: string): Promise<SermonResponse> {
    return apiRequest({
      method: 'DELETE',
      path: `/sermons/${sermonId}`,
      schema: sermonResponseSchema,
      token,
    });
  },

  reprocessSermon(
    token: string,
    sermonId: string,
    input?: SermonReprocessRequest,
  ): Promise<SermonReprocessResponse> {
    return apiRequest({
      method: 'POST',
      path: `/sermons/${sermonId}/reprocess`,
      schema: sermonReprocessResponseSchema,
      body: input ?? {},
      token,
    });
  },

  generateSermon(
    token: string,
    sermonId: string,
    input: SermonGenerateRequest,
  ): Promise<SermonGenerateResponse> {
    return apiRequest({
      method: 'POST',
      path: `/sermons/${sermonId}/generate`,
      schema: sermonGenerateResponseSchema,
      body: input,
      token,
    });
  },

  upsertSermonTranscript(
    token: string,
    sermonId: string,
    input: SermonTranscriptUpsertRequest,
  ): Promise<SermonTranscript> {
    return apiRequest({
      method: 'POST',
      path: `/sermons/${sermonId}/transcript`,
      schema: sermonTranscriptSchema,
      body: input,
      token,
    });
  },

  listSermonJobs(token: string, sermonId: string): Promise<SermonJobSummary[]> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/${sermonId}/jobs`,
      schema: z.array(sermonJobSummarySchema),
      token,
    });
  },

  listSermonRecommendations(
    token: string,
    sermonId: string,
  ): Promise<SermonRecommendationPage> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/${sermonId}/recommendations`,
      schema: sermonRecommendationPageSchema,
      token,
    });
  },

  listSermonNotes(
    token: string,
    sermonId: string,
    query?: SermonNoteListQuery,
  ): Promise<SermonNotePage> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/${sermonId}/notes${toQuery(query)}`,
      schema: sermonNotePageSchema,
      token,
    });
  },

  createSermonNote(
    token: string,
    sermonId: string,
    input: SermonNoteCreateRequest,
  ): Promise<SermonNote> {
    return apiRequest({
      method: 'POST',
      path: `/sermons/${sermonId}/notes`,
      schema: sermonNoteSchema,
      body: input,
      token,
    });
  },

  updateSermonNote(
    token: string,
    sermonId: string,
    noteId: string,
    input: SermonNoteUpdateRequest,
  ): Promise<SermonNote> {
    return apiRequest({
      method: 'PATCH',
      path: `/sermons/${sermonId}/notes/${noteId}`,
      schema: sermonNoteSchema,
      body: input,
      token,
    });
  },

  deleteSermonNote(token: string, sermonId: string, noteId: string): Promise<void> {
    return apiRequest({
      method: 'DELETE',
      path: `/sermons/${sermonId}/notes/${noteId}`,
      schema: voidSchema,
      token,
    });
  },

  createSermonShare(
    token: string,
    sermonId: string,
    input?: SermonShareCreateRequest,
  ): Promise<SermonShare> {
    return apiRequest({
      method: 'POST',
      path: `/sermons/${sermonId}/shares`,
      schema: sermonShareSchema,
      body: input ?? {},
      token,
    });
  },

  listSermonShares(token: string, sermonId: string): Promise<SermonShare[]> {
    return apiRequest({
      method: 'GET',
      path: `/sermons/${sermonId}/shares`,
      schema: z.array(sermonShareSchema),
      token,
    });
  },

  revokeSermonShare(token: string, sermonId: string, shareId: string): Promise<SermonShare> {
    return apiRequest({
      method: 'DELETE',
      path: `/sermons/${sermonId}/shares/${shareId}`,
      schema: sermonShareSchema,
      token,
    });
  },

  getPublicSermon(tenantSlug: string, sermonSlug: string): Promise<SermonResponse> {
    return apiRequest({
      method: 'GET',
      path: `/public/sermons/${tenantSlug}/${sermonSlug}`,
      schema: sermonResponseSchema,
    });
  },

  getSharedSermon(token: string): Promise<SermonResponse> {
    return apiRequest({
      method: 'GET',
      path: `/public/sermons/shares/${token}`,
      schema: sermonResponseSchema,
    });
  },
};
