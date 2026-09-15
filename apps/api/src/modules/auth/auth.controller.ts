import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  changePasswordSchema,
  emailVerificationConsumeSchema,
  loginSchema,
  logoutSchema,
  magicLinkConsumeSchema,
  magicLinkRequestSchema,
  mfaVerifyRecoveryCodeSchema,
  mfaVerifyTotpSchema,
  oauthCallbackSchema,
  oauthStartQuerySchema,
  otpRequestSchema,
  otpVerifySchema,
  passwordResetConsumeSchema,
  passwordResetRequestSchema,
  phoneVerificationConsumeSchema,
  phoneVerificationRequestSchema,
  refreshSchema,
  registerChurchSchema,
  switchTenantSchema,
  type ChangePasswordRequest,
  type EmailVerificationConsumeRequest,
  type LoginRequest,
  type LoginResult,
  type LogoutRequest,
  type MagicLinkConsumeRequest,
  type MagicLinkRequest,
  type MeResponse,
  type MfaVerifyRecoveryCodeRequest,
  type MfaVerifyTotpRequest,
  type OAuthCallbackRequest,
  type OAuthStartResponse,
  type OAuthProvider,
  type OtpRequestBody,
  type OtpVerifyRequest,
  type PasswordResetConsumeRequest,
  type PasswordResetRequest,
  type PhoneVerificationConsumeRequest,
  type PhoneVerificationRequest,
  type RegisterChurchRequest,
  type RefreshRequest,
  type Session,
  type SwitchTenantRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DomainError } from '../../common/errors/domain-error';
import { CurrentPrincipal, Public } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import { AuthService } from './auth.service';
import { requestMetadata } from './request-metadata';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register-church')
  @HttpCode(HttpStatus.CREATED)
  registerChurch(
    @Body(new ZodValidationPipe(registerChurchSchema)) body: RegisterChurchRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.registerChurch(body, requestMetadata(request));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
    @Req() request: Request,
  ): Promise<LoginResult> {
    return this.auth.login(body, requestMetadata(request));
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  verifyMfa(
    @Body(new ZodValidationPipe(mfaVerifyTotpSchema)) body: MfaVerifyTotpRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.verifyMfaTotp(body, requestMetadata(request));
  }

  @Public()
  @Post('mfa/recovery')
  @HttpCode(HttpStatus.OK)
  verifyRecoveryCode(
    @Body(new ZodValidationPipe(mfaVerifyRecoveryCodeSchema)) body: MfaVerifyRecoveryCodeRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.verifyMfaRecoveryCode(body, requestMetadata(request));
  }

  @Public()
  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestMagicLink(
    @Body(new ZodValidationPipe(magicLinkRequestSchema)) body: MagicLinkRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.requestMagicLink(body, requestMetadata(request));
  }

  @Public()
  @Post('magic-link/consume')
  @HttpCode(HttpStatus.OK)
  consumeMagicLink(
    @Body(new ZodValidationPipe(magicLinkConsumeSchema)) body: MagicLinkConsumeRequest,
    @Req() request: Request,
  ): Promise<LoginResult> {
    return this.auth.consumeMagicLink(body, requestMetadata(request));
  }

  @Public()
  @Post('otp')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequestBody,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.requestOtp(body, requestMetadata(request));
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifyRequest,
    @Req() request: Request,
  ): Promise<LoginResult> {
    return this.auth.verifyOtp(body, requestMetadata(request));
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(passwordResetRequestSchema)) body: PasswordResetRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.requestPasswordReset(body, requestMetadata(request));
  }

  @Public()
  @Post('password/reset/consume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(passwordResetConsumeSchema)) body: PasswordResetConsumeRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.resetPassword(body, requestMetadata(request));
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.changePassword(principal.userId, principal.sessionId, body, requestMetadata(request));
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestEmailVerification(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.requestEmailVerification(principal.userId, requestMetadata(request));
  }

  @Public()
  @Post('email/verify/consume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(
    @Body(new ZodValidationPipe(emailVerificationConsumeSchema)) body: EmailVerificationConsumeRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.verifyEmail(body, requestMetadata(request));
  }

  @Post('phone/verify')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPhoneVerification(
    @Body(new ZodValidationPipe(phoneVerificationRequestSchema)) body: PhoneVerificationRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.requestPhoneVerification(principal.userId, body.phone, requestMetadata(request));
  }

  @Public()
  @Post('phone/verify/consume')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyPhone(
    @Body(new ZodValidationPipe(phoneVerificationConsumeSchema)) body: PhoneVerificationConsumeRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.verifyPhone(body, requestMetadata(request));
  }

  @Public()
  @Get('oauth/:provider/start')
  async startOAuth(
    @Req() request: Request,
    @Query(new ZodValidationPipe(oauthStartQuerySchema)) query: { redirectPath?: string; tenantSlug?: string },
  ): Promise<OAuthStartResponse> {
    return this.auth.startOAuth(providerFromParams(request), query);
  }

  @Public()
  @Post('oauth/:provider/callback')
  @HttpCode(HttpStatus.OK)
  async completeOAuth(
    @Body(new ZodValidationPipe(oauthCallbackSchema)) body: OAuthCallbackRequest,
    @Req() request: Request,
  ): Promise<LoginResult> {
    return this.auth.loginWithOAuth(providerFromParams(request), body, requestMetadata(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.refresh(body, requestMetadata(request));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.logout(body, requestMetadata(request));
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  switchTenant(
    @Body(new ZodValidationPipe(switchTenantSchema)) body: SwitchTenantRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.switchTenant(body, requestMetadata(request));
  }

  @Get('me')
  me(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<MeResponse> {
    return this.auth.me(principal.userId, principal.tenantId, principal.assuranceLevel);
  }
}

type OAuthProviderName = OAuthProvider;

function providerFromParams(request: Request): OAuthProviderName {
  const provider = String(request.params.provider ?? '').toUpperCase();
  if (provider !== 'GOOGLE' && provider !== 'APPLE' && provider !== 'MICROSOFT') {
    throw DomainError.oauthProviderUnavailable(`Unsupported provider: ${provider}`);
  }
  return provider;
}
