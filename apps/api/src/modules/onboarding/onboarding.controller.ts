import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  Permission,
  acceptInvitationSchema,
  brandThemeSchema,
  churchProfileSchema,
  completeOnboardingSchema,
  declineInvitationSchema,
  inviteAdministratorsSchema,
  memberImportCommitSchema,
  memberImportPreviewSchema,
  onboardingStepSchema,
  selectSubscriptionSchema,
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
  type MemberImportJob,
  type MemberImportListResponse,
  type MemberImportPreviewRequest,
  type MemberImportPreviewResponse,
  type OnboardingState,
  type OnboardingSummary,
  type PlanCatalogResponse,
  type SelectSubscriptionRequest,
  type Session,
  type SubscriptionSummary,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, Public, RequirePermissions } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import type { RequestMetadata } from '../auth/session.service';
import { BrandingService } from './branding.service';
import { InvitationService } from './invitation.service';
import { MemberImportService } from './member-import.service';
import { Metadata } from './metadata.decorator';
import { OnboardingService } from './onboarding.service';
import { SubscriptionService } from './subscription.service';
import { WorkspaceService } from './workspace.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly workspace: WorkspaceService,
    private readonly branding: BrandingService,
    private readonly subscriptions: SubscriptionService,
    private readonly invitations: InvitationService,
    private readonly memberImports: MemberImportService,
  ) {}

  @Get()
  @RequirePermissions(Permission.TENANT_READ)
  getState(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<OnboardingState> {
    return this.onboarding.getState(tenantOf(principal));
  }

  @Get('summary')
  @RequirePermissions(Permission.TENANT_READ)
  getSummary(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<OnboardingSummary> {
    return this.onboarding.summary(tenantOf(principal));
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TENANT_UPDATE)
  complete(
    @Body(new ZodValidationPipe(completeOnboardingSchema)) _body: CompleteOnboardingRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OnboardingState> {
    return this.onboarding.complete(tenantOf(principal));
  }

  @Post('steps/:step/skip')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TENANT_UPDATE)
  skipStep(
    @Param('step') step: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OnboardingState> {
    return this.onboarding.skipStep(tenantOf(principal), parseStep(step));
  }

  @Post('steps/:step/retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TENANT_UPDATE)
  retryStep(
    @Param('step') step: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<OnboardingState> {
    return this.onboarding.retryStep(tenantOf(principal), parseStep(step));
  }

  @Get('workspace')
  @RequirePermissions(Permission.TENANT_READ)
  getWorkspace(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChurchProfileResponse | null> {
    return this.workspace.get(tenantOf(principal));
  }

  @Put('workspace')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TENANT_UPDATE)
  async saveWorkspace(
    @Body(new ZodValidationPipe(churchProfileSchema)) body: ChurchProfileRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ChurchProfileResponse> {
    const tenantId = tenantOf(principal);
    await this.onboarding.assertReachable(tenantId, 'WORKSPACE_CREATION');
    const saved = await this.workspace.save(tenantId, body);
    await this.onboarding.reconcile(tenantId);
    return saved;
  }

  @Get('branding')
  @RequirePermissions(Permission.WEBSITE_READ)
  getBranding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BrandThemeResponse | null> {
    return this.branding.get(tenantOf(principal));
  }

  @Put('branding')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.WEBSITE_MANAGE)
  async saveBranding(
    @Body(new ZodValidationPipe(brandThemeSchema)) body: BrandThemeRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BrandThemeResponse> {
    const tenantId = tenantOf(principal);
    await this.onboarding.assertReachable(tenantId, 'BRAND_CUSTOMIZATION');
    const saved = await this.branding.save(tenantId, body);
    await this.onboarding.reconcile(tenantId);
    return saved;
  }

  @Get('subscription/catalog')
  @RequirePermissions(Permission.TENANT_READ)
  getPlanCatalog(): PlanCatalogResponse {
    return this.subscriptions.catalog();
  }

  @Get('subscription')
  @RequirePermissions(Permission.TENANT_READ)
  getSubscription(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SubscriptionSummary | null> {
    return this.subscriptions.get(tenantOf(principal));
  }

  @Put('subscription')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TENANT_UPDATE)
  async selectSubscription(
    @Body(new ZodValidationPipe(selectSubscriptionSchema)) body: SelectSubscriptionRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SubscriptionSummary> {
    const tenantId = tenantOf(principal);
    await this.onboarding.assertReachable(tenantId, 'SUBSCRIPTION_SELECTION');
    const summary = await this.subscriptions.select(tenantId, principal.userId, body);
    await this.onboarding.reconcile(tenantId);
    return summary;
  }

  @Get('invitations')
  @RequirePermissions(Permission.USER_READ)
  listInvitations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<InvitationListResponse> {
    return this.invitations.list(tenantOf(principal));
  }

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.USER_INVITE)
  async invite(
    @Body(new ZodValidationPipe(inviteAdministratorsSchema)) body: InviteAdministratorsRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Metadata() meta: RequestMetadata,
  ): Promise<InvitationListResponse> {
    const tenantId = tenantOf(principal);
    await this.onboarding.assertReachable(tenantId, 'ADMINISTRATOR_INVITATION');
    const result = await this.invitations.invite(
      tenantId,
      { userId: principal.userId, role: roleOf(principal) },
      body,
      meta,
    );
    await this.onboarding.reconcile(tenantId);
    return result;
  }

  @Post('invitations/:invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.USER_INVITE)
  resendInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Metadata() meta: RequestMetadata,
  ): Promise<InvitationSummary> {
    return this.invitations.resend(tenantOf(principal), principal.userId, invitationId, meta);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.USER_INVITE)
  revokeInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Metadata() meta: RequestMetadata,
  ): Promise<InvitationSummary> {
    return this.invitations.revoke(tenantOf(principal), principal.userId, invitationId, meta);
  }

  @Public()
  @Get('invitations/preview')
  previewInvitation(@Query('token') token: string): Promise<InvitationPreview> {
    return this.invitations.preview(requireToken(token));
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationRequest,
    @Metadata() meta: RequestMetadata,
  ): Promise<Session> {
    return this.invitations.accept(body, meta);
  }

  @Public()
  @Post('invitations/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineInvitation(
    @Body(new ZodValidationPipe(declineInvitationSchema)) body: DeclineInvitationRequest,
    @Metadata() meta: RequestMetadata,
  ): Promise<void> {
    await this.invitations.decline(body, meta);
  }

  @Get('member-imports')
  @RequirePermissions(Permission.MEMBER_READ)
  listMemberImports(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberImportListResponse> {
    return this.memberImports.list(tenantOf(principal));
  }

  @Get('member-imports/:jobId')
  @RequirePermissions(Permission.MEMBER_READ)
  getMemberImport(
    @Param('jobId') jobId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberImportJob> {
    return this.memberImports.get(tenantOf(principal), jobId);
  }

  @Post('member-imports/preview')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MEMBER_CREATE)
  async previewMemberImport(
    @Body(new ZodValidationPipe(memberImportPreviewSchema)) body: MemberImportPreviewRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberImportPreviewResponse> {
    const tenantId = tenantOf(principal);
    await this.onboarding.assertReachable(tenantId, 'FIRST_MEMBER_IMPORT');
    return this.memberImports.preview(tenantId, principal.userId, body);
  }

  @Post('member-imports/commit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MEMBER_CREATE)
  async commitMemberImport(
    @Body(new ZodValidationPipe(memberImportCommitSchema)) body: { jobId: string },
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Metadata() meta: RequestMetadata,
  ): Promise<MemberImportJob> {
    const tenantId = tenantOf(principal);
    await this.onboarding.assertReachable(tenantId, 'FIRST_MEMBER_IMPORT');
    const job = await this.memberImports.commit(tenantId, principal.userId, body.jobId, meta);
    await this.onboarding.reconcile(tenantId);
    return job;
  }
}

function tenantOf(principal: AuthenticatedPrincipal): string {
  if (!principal.tenantId) throw DomainError.tenantRequired();
  return principal.tenantId;
}

function roleOf(principal: AuthenticatedPrincipal): NonNullable<AuthenticatedPrincipal['role']> {
  if (!principal.role) throw DomainError.forbidden('An active church workspace role is required');
  return principal.role;
}

function parseStep(value: string): ReturnType<typeof onboardingStepSchema.parse> {
  const parsed = onboardingStepSchema.safeParse(value.toUpperCase());
  if (!parsed.success) {
    throw DomainError.validation([{ path: 'step', message: `Unknown onboarding step: ${value}` }]);
  }
  return parsed.data;
}

function requireToken(token: string | undefined): string {
  if (!token || token.length < 16) {
    throw DomainError.invitationNotFound();
  }
  return token;
}
