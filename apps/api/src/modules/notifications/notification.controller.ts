import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  Permission,
  notificationAnalyticsQuerySchema,
  notificationAudienceCreateSchema,
  notificationAudienceListQuerySchema,
  notificationAudienceUpdateSchema,
  notificationCampaignCreateSchema,
  notificationCampaignListQuerySchema,
  notificationCampaignScheduleSchema,
  notificationCampaignUpdateSchema,
  notificationDeviceRegisterSchema,
  notificationInboxListQuerySchema,
  notificationMessageListQuerySchema,
  notificationTemplateCreateSchema,
  notificationTemplateListQuerySchema,
  notificationTemplateUpdateSchema,
  type NotificationAnalytics,
  type NotificationAnalyticsQuery,
  type NotificationAudience,
  type NotificationAudienceCreateRequest,
  type NotificationAudienceListQuery,
  type NotificationAudiencePage,
  type NotificationAudiencePreview,
  type NotificationAudienceUpdateRequest,
  type NotificationCampaign,
  type NotificationCampaignCreateRequest,
  type NotificationCampaignListQuery,
  type NotificationCampaignPage,
  type NotificationCampaignScheduleRequest,
  type NotificationCampaignUpdateRequest,
  type NotificationDevice,
  type NotificationDeviceRegisterRequest,
  type NotificationInboxListQuery,
  type NotificationMessage,
  type NotificationMessageListQuery,
  type NotificationMessagePage,
  type NotificationTemplate,
  type NotificationTemplateCreateRequest,
  type NotificationTemplateListQuery,
  type NotificationTemplatePage,
  type NotificationTemplateUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../common/security/principal';
import { NotificationCampaignService } from './notification-campaign.service';
import { NotificationInboxService } from './notification-inbox.service';
import { NotificationTemplateService } from './notification-template.service';

/**
 * Authenticated notification REST surface.
 *
 * The tenant always comes from the principal. Auth still uses
 * NotificationService as a delivery port; this controller is campaigns,
 * templates, inbox and analytics.
 */
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly templates: NotificationTemplateService,
    private readonly campaigns: NotificationCampaignService,
    private readonly inbox: NotificationInboxService,
  ) {}

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  createTemplate(
    @Body(new ZodValidationPipe(notificationTemplateCreateSchema))
    body: NotificationTemplateCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationTemplate> {
    return this.templates.createTemplate(tenantOf(principal), body);
  }

  @Get('templates')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  listTemplates(
    @Query(new ZodValidationPipe(notificationTemplateListQuerySchema))
    query: NotificationTemplateListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationTemplatePage> {
    return this.templates.listTemplates(tenantOf(principal), query);
  }

  @Get('templates/:templateId')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  getTemplate(
    @Param('templateId') templateId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationTemplate> {
    return this.templates.getTemplate(tenantOf(principal), templateId);
  }

  @Patch('templates/:templateId')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  updateTemplate(
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(notificationTemplateUpdateSchema))
    body: NotificationTemplateUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationTemplate> {
    return this.templates.updateTemplate(tenantOf(principal), templateId, body);
  }

  @Post('audiences')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  createAudience(
    @Body(new ZodValidationPipe(notificationAudienceCreateSchema))
    body: NotificationAudienceCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAudience> {
    return this.templates.createAudience(tenantOf(principal), body);
  }

  @Get('audiences')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  listAudiences(
    @Query(new ZodValidationPipe(notificationAudienceListQuerySchema))
    query: NotificationAudienceListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAudiencePage> {
    return this.templates.listAudiences(tenantOf(principal), query);
  }

  @Patch('audiences/:audienceId')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  updateAudience(
    @Param('audienceId') audienceId: string,
    @Body(new ZodValidationPipe(notificationAudienceUpdateSchema))
    body: NotificationAudienceUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAudience> {
    return this.templates.updateAudience(tenantOf(principal), audienceId, body);
  }

  @Get('audiences/:audienceId')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  getAudience(
    @Param('audienceId') audienceId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAudience> {
    return this.templates.getAudience(tenantOf(principal), audienceId);
  }

  @Get('audiences/:audienceId/preview')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  previewAudience(
    @Param('audienceId') audienceId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAudiencePreview> {
    return this.templates.previewAudience(tenantOf(principal), audienceId);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  createCampaign(
    @Body(new ZodValidationPipe(notificationCampaignCreateSchema))
    body: NotificationCampaignCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaign> {
    return this.campaigns.create(tenantOf(principal), principal.userId, body);
  }

  @Get('campaigns')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  listCampaigns(
    @Query(new ZodValidationPipe(notificationCampaignListQuerySchema))
    query: NotificationCampaignListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaignPage> {
    return this.campaigns.list(tenantOf(principal), query);
  }

  @Get('campaigns/:campaignId')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  getCampaign(
    @Param('campaignId') campaignId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaign> {
    return this.campaigns.get(tenantOf(principal), campaignId);
  }

  @Patch('campaigns/:campaignId')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  updateCampaign(
    @Param('campaignId') campaignId: string,
    @Body(new ZodValidationPipe(notificationCampaignUpdateSchema))
    body: NotificationCampaignUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaign> {
    return this.campaigns.update(tenantOf(principal), campaignId, body);
  }

  @Post('campaigns/:campaignId/send')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  sendCampaign(
    @Param('campaignId') campaignId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaign> {
    return this.campaigns.send(tenantOf(principal), principal.userId, campaignId);
  }

  @Post('campaigns/:campaignId/schedule')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  scheduleCampaign(
    @Param('campaignId') campaignId: string,
    @Body(new ZodValidationPipe(notificationCampaignScheduleSchema))
    body: NotificationCampaignScheduleRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaign> {
    return this.campaigns.schedule(tenantOf(principal), principal.userId, campaignId, body);
  }

  @Post('campaigns/:campaignId/cancel')
  @RequirePermissions(Permission.NOTIFICATION_SEND)
  cancelCampaign(
    @Param('campaignId') campaignId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationCampaign> {
    return this.campaigns.cancel(tenantOf(principal), principal.userId, campaignId);
  }

  @Get('campaigns/:campaignId/messages')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  listMessages(
    @Param('campaignId') campaignId: string,
    @Query(new ZodValidationPipe(notificationMessageListQuerySchema))
    query: NotificationMessageListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationMessagePage> {
    return this.campaigns.listMessages(tenantOf(principal), campaignId, query);
  }

  @Get('campaigns/:campaignId/analytics')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  campaignAnalytics(
    @Param('campaignId') campaignId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAnalytics> {
    return this.campaigns.analytics(tenantOf(principal), campaignId);
  }

  @Get('analytics')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  analytics(
    @Query(new ZodValidationPipe(notificationAnalyticsQuerySchema))
    query: NotificationAnalyticsQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationAnalytics> {
    return this.campaigns.analytics(tenantOf(principal), null, query);
  }

  @Get('inbox')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  listInbox(
    @Query(new ZodValidationPipe(notificationInboxListQuerySchema))
    query: NotificationInboxListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationMessagePage> {
    return this.inbox.listInbox(tenantOf(principal), principal.userId, query);
  }

  @Post('inbox/:messageId/read')
  @RequirePermissions(Permission.NOTIFICATION_READ)
  markRead(
    @Param('messageId') messageId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationMessage> {
    return this.inbox.markRead(tenantOf(principal), principal.userId, messageId);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.NOTIFICATION_READ)
  registerDevice(
    @Body(new ZodValidationPipe(notificationDeviceRegisterSchema))
    body: NotificationDeviceRegisterRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<NotificationDevice> {
    return this.inbox.registerDevice(tenantOf(principal), principal.userId, body);
  }
}
