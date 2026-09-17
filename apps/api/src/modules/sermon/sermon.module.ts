import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MemoryModule } from '../memory/memory.module';
import { SermonController } from './sermon.controller';
import { SermonJobRunner } from './sermon-job.runner';
import { SermonPipelineService } from './sermon-pipeline.service';
import { SermonPublicController } from './sermon-public.controller';
import { SermonService } from './sermon.service';

/**
 * The sermon bounded context.
 *
 * Publishing and the study surface live here. Bytes live in Memory; derived
 * fields are produced through Zion AI ports. The worker is disabled under
 * tests, which call `runOnce` directly.
 */
@Module({
  imports: [MemoryModule, AiModule],
  controllers: [SermonController, SermonPublicController],
  providers: [SermonPipelineService, SermonService, SermonJobRunner],
  exports: [SermonService, SermonJobRunner, SermonPipelineService],
})
export class SermonModule {}
