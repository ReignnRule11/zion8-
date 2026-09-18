import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './common/config/app-config.service';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = app.get(AppLogger);

  app.useLogger(logger);
  app.use(helmet());
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '6mb' }));

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
    exposedHeaders: ['x-request-id', 'x-request-duration-ms'],
  });

  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.apiVersion,
  });
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(
    `Zion8 API listening on ${config.appBaseUrl} (prefix=/${config.globalPrefix}/${config.apiVersion})`,
    'Bootstrap',
  );
}

void bootstrap();
