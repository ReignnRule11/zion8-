import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../../common/config/app-config.module';
import { LocalObjectStorage, OBJECT_STORAGE } from './object-storage.port';

/**
 * Shared binary storage. Global because storage is a cross-cutting
 * infrastructure concern: membership documents, memory artifacts, and future
 * exports all resolve the same port without threading a module import through
 * every feature module.
 */
@Global()
@Module({
  imports: [AppConfigModule],
  providers: [LocalObjectStorage, { provide: OBJECT_STORAGE, useExisting: LocalObjectStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
