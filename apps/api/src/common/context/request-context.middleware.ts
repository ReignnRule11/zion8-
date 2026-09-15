import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger.service';
import { createRequestStore, requestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header('x-request-id');
    const store = createRequestStore({
      requestId: incoming && incoming.length <= 128 ? incoming : undefined,
    });

    response.setHeader('x-request-id', store.requestId);

    requestContext.run(store, () => {
      response.once('finish', () => {
        this.logger.log(
          `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - store.startedAt}ms`,
          'HttpRequest',
        );
      });
      next();
    });
  }
}
