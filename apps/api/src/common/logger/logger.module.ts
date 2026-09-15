import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from './app-logger.service';

@Global()
@Module({
  providers: [
    {
      provide: AppLogger,
      useFactory: (config: AppConfigService) =>
        new AppLogger({
          level: config.logLevel,
          service: 'zion8-api',
          enabled: config.nodeEnv !== 'test',
        }),
      inject: [AppConfigService],
    },
  ],
  exports: [AppLogger],
})
export class LoggerModule {}
