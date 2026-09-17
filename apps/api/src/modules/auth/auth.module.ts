import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuthController } from './auth.controller';
import { AuthMailerService } from './auth-mailer.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthorizationGuard } from './guards/authorization.guard';
import { IdentityService } from './identity.service';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { OAuthService } from './oauth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { SessionsController } from './sessions.controller';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnService } from './webauthn.service';

@Module({
  imports: [AuditModule, TenancyModule, NotificationsModule, forwardRef(() => OnboardingModule)],
  controllers: [AuthController, MfaController, SessionsController, WebAuthnController],
  providers: [
    AuthService,
    AuthMailerService,
    IdentityService,
    SessionService,
    VerificationService,
    MfaService,
    WebAuthnService,
    OAuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    AuthorizationGuard,
  ],
  exports: [
    AuthService,
    SessionService,
    PasswordService,
    TokenService,
    VerificationService,
    IdentityService,
    JwtAuthGuard,
    AuthorizationGuard,
  ],
})
export class AuthModule {}
