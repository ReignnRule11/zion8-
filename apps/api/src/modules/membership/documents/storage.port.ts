/**
 * Compatibility shim. Document bytes now flow through the shared object storage
 * port in `infrastructure/storage`; this module re-exports it so existing
 * membership imports keep working while the storage concern stays owned by
 * infrastructure rather than by the membership domain.
 */
export {
  OBJECT_STORAGE,
  type ObjectStorage,
  type StoredObject,
  LocalObjectStorage as LocalDocumentStorage,
} from '../../../infrastructure/storage/object-storage.port';
