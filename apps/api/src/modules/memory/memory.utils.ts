import { createHash } from 'node:crypto';
import type {
  MemoryArtifactLinkResponse,
  MemoryArtifactResponse,
  MemoryArtifactSummary,
  MemoryArtifactVersion,
  MemoryJobSummary,
} from '@zion8/contracts';

/**
 * Magic-byte sniffing.
 *
 * The declared content type comes from the browser and is a hint, not evidence.
 * This function reads the first bytes of the object and returns what the file
 * actually is. When the signature is unknown (for example a ZIP container, which
 * several office formats share) it returns null and the caller keeps the
 * declared type rather than guessing wrong.
 */
export function detectContentType(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif';
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF') {
    const form = bytes.subarray(8, 12).toString('ascii');
    if (form === 'WEBP') return 'image/webp';
    if (form === 'WAVE') return 'audio/wav';
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]))) return 'image/tiff';
  if (bytes.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return 'image/tiff';
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
  if (bytes[0] === 0xff && ((bytes[1] as number) & 0xe0) === 0xe0) return 'audio/mpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (bytes.subarray(0, 4).toString('ascii') === 'fLaC') return 'audio/flac';
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'M4A ') return 'audio/mp4';
    return 'video/mp4';
  }
  if (bytes.subarray(0, 5).toString('ascii') === '{\\rtf') return 'application/rtf';

  return null;
}

/** `sha256` of the exact bytes, used as the content address and dedupe key. */
export function checksumOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Content-addressed storage key. Identical bytes anywhere in the same church
 * resolve to one key, so uploading the same photograph twice costs one object.
 */
export function memoryStorageKey(tenantId: string, sha256: string): string {
  return `tenants/${tenantId}/memory/${sha256.slice(0, 2)}/${sha256}`;
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

type VersionRow = {
  id: string;
  artifactId: string;
  version: number;
  sha256: string;
  sizeBytes: bigint | number;
  fileName: string;
  declaredContentType: string;
  detectedContentType: string | null;
  isCurrent: boolean;
  createdAt: Date;
};

type ArtifactRow = {
  id: string;
  tenantId: string;
  kind: MemoryArtifactResponse['kind'];
  status: MemoryArtifactResponse['status'];
  title: string;
  description: string | null;
  capturedAt: Date | null;
  datePrecision: MemoryArtifactResponse['datePrecision'];
  origin: MemoryArtifactResponse['origin'];
  sourceResourceType: string | null;
  sourceResourceId: string | null;
  duplicateOfArtifactId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LinkRow = {
  id: string;
  linkType: MemoryArtifactLinkResponse['linkType'];
  linkId: string;
  createdAt: Date;
};

type TagRow = { tag: string };

export function toVersion(row: VersionRow): MemoryArtifactVersion {
  return {
    id: row.id,
    artifactId: row.artifactId,
    version: row.version,
    sha256: row.sha256,
    sizeBytes: Number(row.sizeBytes),
    fileName: row.fileName,
    declaredContentType: row.declaredContentType,
    detectedContentType: row.detectedContentType,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt.toISOString(),
  };
}

function baseSummary(
  row: ArtifactRow,
  version: VersionRow | null,
  tags: string[],
): MemoryArtifactSummary {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    description: row.description,
    capturedAt: toIso(row.capturedAt),
    datePrecision: row.datePrecision,
    origin: row.origin,
    sourceResourceType: row.sourceResourceType,
    sourceResourceId: row.sourceResourceId,
    tags,
    duplicateOfArtifactId: row.duplicateOfArtifactId,
    currentVersion: version ? toVersion(version) : null,
    archivedAt: toIso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSummary(
  row: ArtifactRow & { tags: TagRow[]; versions: VersionRow[] },
): MemoryArtifactSummary {
  const current = row.versions.find((version) => version.isCurrent) ?? null;
  return baseSummary(row, current, row.tags.map((tag) => tag.tag));
}

export function toResponse(
  row: ArtifactRow & { tags: TagRow[]; versions: VersionRow[]; links: LinkRow[] },
): MemoryArtifactResponse {
  const current = row.versions.find((version) => version.isCurrent) ?? null;
  return {
    ...baseSummary(row, current, row.tags.map((tag) => tag.tag)),
    tenantId: row.tenantId,
    links: row.links.map((link) => ({
      id: link.id,
      linkType: link.linkType,
      linkId: link.linkId,
      createdAt: link.createdAt.toISOString(),
    })),
    versions: [...row.versions]
      .sort((a, b) => b.version - a.version)
      .map((version) => toVersion(version)),
  };
}

export function pageArgs(query: { offset: number; limit: number }): { skip: number; take: number } {
  return { skip: query.offset, take: query.limit };
}

export function toJobSummary(row: {
  id: string;
  artifactId: string;
  type: MemoryJobSummary['type'];
  status: MemoryJobSummary['status'];
  attempts: number;
  maxAttempts: number;
  provider: string | null;
  blockedReason: string | null;
  lastError: string | null;
  availableAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MemoryJobSummary {
  return {
    id: row.id,
    artifactId: row.artifactId,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    provider: row.provider,
    blockedReason: row.blockedReason,
    lastError: row.lastError,
    availableAt: row.availableAt.toISOString(),
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
