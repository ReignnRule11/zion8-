import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { AppConfigModule } from './common/config/app-config.module';
import { AppConfigService } from './common/config/app-config.service';
import { graphqlModuleOptions } from './common/graphql/graphql.config';
import { CryptoModule } from './common/crypto/crypto.module';
import { LoggerModule } from './common/logger/logger.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { EventsModule } from './infrastructure/events/events.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationGuard } from './modules/auth/guards/authorization.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { MembershipModule } from './modules/membership/membership.module';
import { MemoryModule } from './modules/memory/memory.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => graphqlModuleOptions(config),
    }),
    AppConfigModule,
    CryptoModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    StorageModule,
    EventsModule,
    AuditModule,
    TenancyModule,
    AuthModule,
    OnboardingModule,
    MembershipModule,
    MemoryModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    RequestContextMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
