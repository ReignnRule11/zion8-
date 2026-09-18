import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { BrandingService } from './branding.service';
import { InvitationService } from './invitation.service';
import { MemberImportService } from './member-import.service';
import { OnboardingMailerService } from './onboarding-mailer.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SubscriptionService } from './subscription.service';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [forwardRef(() => AuthModule), TenancyModule, AuditModule, NotificationsModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    WorkspaceService,
    BrandingService,
    SubscriptionService,
    InvitationService,
    MemberImportService,
    OnboardingMailerService,
  ],
  exports: [
    OnboardingService,
    WorkspaceService,
    BrandingService,
    SubscriptionService,
    InvitationService,
    MemberImportService,
  ],
})
export class OnboardingModule {}
