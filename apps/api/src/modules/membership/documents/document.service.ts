import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentDownload,
  type DocumentListQuery,
  type DocumentPage,
  type DocumentResponse,
  type DocumentUpdateRequest,
  type DocumentUploadRequest,
} from '@zion8/contracts';
import { DomainError } from '../../../common/errors/domain-error';
import { AppConfigService } from '../../../common/config/app-config.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MemberService } from '../member.service';
import { TimelineService } from '../timeline.service';
import { pageArgs, toIso } from '../membership.utils';
import { DOCUMENT_STORAGE, type DocumentStorage } from './storage.port';

const DOWNLOAD_TTL_SECONDS = 300;

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly timeline: TimelineService,
    private readonly config: AppConfigService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  async upload(
    tenantId: string,
    actorUserId: string,
    memberId: string,
    input: DocumentUploadRequest,
  ): Promise<DocumentResponse> {
    await this.members.assertExists(tenantId, memberId);

    if (!ALLOWED_DOCUMENT_TYPES.includes(input.contentType)) {
      throw new DomainError(
        'DOCUMENT_TYPE_UNSUPPORTED',
        `Files of type ${input.contentType} cannot be stored`,
      );
    }

    const bytes = Buffer.from(input.contentBase64, 'base64');
    if (bytes.byteLength === 0) {
      throw new DomainError('DOCUMENT_TYPE_UNSUPPORTED', 'The uploaded file was empty');
    }
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new DomainError(
        'DOCUMENT_TOO_LARGE',
        `Documents must be ${Math.floor(MAX_DOCUMENT_BYTES / 1024)} KiB or smaller`,
      );
    }

    const key = `${tenantId}/${memberId}/${randomUUID()}`;
    const stored = await this.storage.put(key, bytes);

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const created = await tx.memberDocument.create({
        data: {
          tenantId,
          memberId,
          title: input.title,
          category: input.category,
          status: 'AVAILABLE',
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          storageKey: stored.key,
          notes: input.notes ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          uploadedByUserId: actorUserId,
        },
      });

      await this.timeline.record(tx, {
        tenantId,
        memberId,
        type: 'DOCUMENT',
        title: `Document filed: ${input.title}`,
        metadata: { category: input.category, documentId: created.id },
        sourceResourceType: 'member_document',
        sourceResourceId: created.id,
        dedupeKey: `document:${created.id}`,
        createdByUserId: actorUserId,
      });

      return created;
    });

    return toResponse(row);
  }

  async list(
    tenantId: string,
    memberId: string,
    query: DocumentListQuery,
  ): Promise<DocumentPage> {
    await this.members.assertExists(tenantId, memberId);

    const where = {
      tenantId,
      memberId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.memberDocument.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        tx.memberDocument.count({ where }),
      ]),
    );

    return {
      items: rows.map(toResponse),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async update(
    tenantId: string,
    documentId: string,
    input: DocumentUpdateRequest,
  ): Promise<DocumentResponse> {
    await this.findRow(tenantId, documentId);

    const data = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
    };

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberDocument.update({ where: { id: documentId }, data }),
    );
    return toResponse(row);
  }

  async archive(tenantId: string, documentId: string): Promise<DocumentResponse> {
    await this.findRow(tenantId, documentId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberDocument.update({ where: { id: documentId }, data: { status: 'ARCHIVED' } }),
    );
    return toResponse(row);
  }

  /**
   * The download handle is a short-lived, authenticated URL rather than a raw
   * storage path. In production the same call returns an object-storage
   * presigned URL; here it points at the streaming endpoint.
   */
  async download(tenantId: string, documentId: string): Promise<DocumentDownload> {
    await this.findRow(tenantId, documentId);
    return {
      documentId,
      url: `${this.config.appBaseUrl}/api/v1/membership/documents/${documentId}/content`,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    };
  }

  async content(
    tenantId: string,
    documentId: string,
  ): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
    const row = await this.findRow(tenantId, documentId);
    if (row.status !== 'AVAILABLE' || !row.storageKey) {
      throw new DomainError('DOCUMENT_UNAVAILABLE', 'That document is not available to download');
    }
    const bytes = await this.storage.get(row.storageKey);
    return { bytes, contentType: row.contentType, fileName: row.fileName };
  }

  private async findRow(tenantId: string, documentId: string) {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberDocument.findFirst({ where: { id: documentId, tenantId } }),
    );
    if (!row) throw new DomainError('DOCUMENT_NOT_FOUND', 'That document could not be found');
    return row;
  }
}

function toResponse(row: {
  id: string;
  memberId: string;
  title: string;
  category: DocumentResponse['category'];
  status: DocumentResponse['status'];
  fileName: string;
  contentType: string;
  sizeBytes: number;
  checksum: string | null;
  notes: string | null;
  expiresAt: Date | null;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DocumentResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    title: row.title,
    category: row.category,
    status: row.status,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    notes: row.notes,
    expiresAt: toIso(row.expiresAt),
    uploadedByUserId: row.uploadedByUserId,
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}
