import { Module } from '@nestjs/common';
import { ArtifactService } from './artifact.service';
import { MemoryController } from './memory.controller';
import { MemoryJobRunner } from './memory-job.runner';

/**
 * The Digital Memory Engine bounded context.
 *
 * Phase A owns the archive: ingesting artifacts, storing immutable versions,
 * linking them to the rest of the platform, and running durable processing jobs.
 * Extraction, embeddings, the entity graph, timeline projection and grounded
 * answers arrive in later phases as additional services inside this module, so
 * the context boundary is already correct.
 */
@Module({
  controllers: [MemoryController],
  providers: [ArtifactService, MemoryJobRunner],
  exports: [ArtifactService, MemoryJobRunner],
})
export class MemoryModule {}
