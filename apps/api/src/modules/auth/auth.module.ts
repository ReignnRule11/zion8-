import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthorizationGuard } from './guards/authorization.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [AuditModule, TenancyModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtAuthGuard, AuthorizationGuard],
  exports: [AuthService, PasswordService, TokenService, JwtAuthGuard, AuthorizationGuard],
})
export class AuthModule {}
