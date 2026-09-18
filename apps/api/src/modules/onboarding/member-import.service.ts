import { Injectable } from '@nestjs/common';
import { IdentityProvider, MemberImportStatus, MembershipStatus, Prisma, Role as PrismaRole, UserStatus } from '@prisma/client';
import {
  MAX_IMPORT_ROWS,
  type MemberImportJob as MemberImportJobResponse,
  type MemberImportListResponse,
  type MemberImportPreviewRequest,
  type MemberImportPreviewResponse,
  type MemberImportRow,
  type Role,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestMetadata } from '../auth/session.service';
import { rawRowsFromCsv, rawRowsFromObjects, validateMemberRows } from './member-import.parser';

const CHUNK_SIZE = 250;

interface MemberImportJobRow {
  id: string;
  tenantId: string;
  status: MemberImportStatus;
  fileName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  resumeIndex: number;
  rows: Prisma.JsonValue;
  issues: Prisma.JsonValue;
  createdByUserId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

/**
 * Two-phase first member import.
 *
 * `preview` parses and validates the whole document and persists the valid rows
 * as a READY job, so the owner can review exactly what will happen before
 * anything is written. `commit` then applies the rows in bounded chunks,
 * persisting `resumeIndex` as it goes; a failure part-way through leaves a
 * resumable PARTIAL job rather than a half-imported workspace with no record of
 * where the work stopped.
 */
@Injectable()
export class MemberImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async preview(
    tenantId: string,
    userId: string,
    input: MemberImportPreviewRequest,
  ): Promise<MemberImportPreviewResponse> {
    const parsed = input.csv !== undefined ? rawRowsFromCsv(input.csv) : rawRowsFromObjects(input.rows ?? []);
    if (parsed.raw.length > MAX_IMPORT_ROWS) {
      throw DomainError.memberImportInvalid(
        `This file contains ${parsed.raw.length} rows. The maximum for a single import is ${MAX_IMPORT_ROWS}.`,
      );
    }

    const existingEmails = await this.existingEmails(parsed.raw);
    const validated = validateMemberRows(parsed.raw, { existingEmails });
    const issues = [...parsed.warnings, ...validated.issues];

    const job = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberImportJob.create({
        data: {
          tenantId,
          status: MemberImportStatus.READY,
          fileName: input.fileName ?? null,
          totalRows: validated.counts.total,
          validRows: validated.counts.valid,
          invalidRows: validated.counts.invalid,
          rows: validated.rows as unknown as Prisma.InputJsonValue,
          issues: issues as unknown as Prisma.InputJsonValue,
          createdByUserId: userId,
        },
      }),
    );

    return { job: toResponse(job), preview: validated.rows.slice(0, 50) };
  }

  async list(tenantId: string): Promise<MemberImportListResponse> {
    const jobs = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberImportJob.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
    return { jobs: jobs.map(toResponse) };
  }

  async get(tenantId: string, jobId: string): Promise<MemberImportJobResponse> {
    const job = await this.requireJob(tenantId, jobId);
    return toResponse(job);
  }

  async commit(
    tenantId: string,
    userId: string,
    jobId: string,
    meta: RequestMetadata,
  ): Promise<MemberImportJobResponse> {
    const job = await this.requireJob(tenantId, jobId);
    if (job.status === MemberImportStatus.COMPLETED) {
      throw DomainError.memberImportNotReady('This import has already been applied.');
    }
    if (job.status === MemberImportStatus.CANCELLED) {
      throw DomainError.memberImportNotReady('This import was cancelled.');
    }

    const rows = Array.isArray(job.rows) ? (job.rows as unknown as MemberImportRow[]) : [];
    let resumeIndex = job.resumeIndex;
    let imported = job.importedRows;
    let duplicate = job.duplicateRows;
    let skipped = job.skippedRows;

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberImportJob.update({
        where: { id: jobId },
        data: {
          status: MemberImportStatus.IMPORTING,
          startedAt: job.startedAt ?? new Date(),
        },
      }),
    );

    try {
      while (resumeIndex < rows.length) {
        const chunk = rows.slice(resumeIndex, resumeIndex + CHUNK_SIZE);
        const result = await this.applyChunk(tenantId, chunk);

        imported += result.imported;
        duplicate += result.duplicate;
        skipped += result.skipped;
        resumeIndex += chunk.length;

        await this.prisma.withTenant(tenantId, (tx) =>
          tx.memberImportJob.update({
            where: { id: jobId },
            data: {
              resumeIndex,
              importedRows: imported,
              duplicateRows: duplicate,
              skippedRows: skipped,
            },
          }),
        );
      }

      const completed = await this.prisma.withTenant(tenantId, (tx) =>
        tx.memberImportJob.update({
          where: { id: jobId },
          data: {
            status: MemberImportStatus.COMPLETED,
            completedAt: new Date(),
          },
        }),
      );

      await this.audit.record({
        tenantId,
        actorUserId: userId,
        action: 'onboarding.member_import_completed',
        resourceType: 'member_import_job',
        resourceId: jobId,
        metadata: { imported, duplicate, skipped },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      this.logger.log(
        `Member import ${jobId} completed: ${imported} imported, ${duplicate} linked, ${skipped} skipped`,
        'MemberImportService',
      );

      return toResponse(completed);
    } catch (error) {
      const partial = await this.prisma.withTenant(tenantId, (tx) =>
        tx.memberImportJob.update({
          where: { id: jobId },
          data: {
            status: MemberImportStatus.PARTIAL,
            resumeIndex,
            importedRows: imported,
            duplicateRows: duplicate,
            skippedRows: skipped,
          },
        }),
      );

      this.logger.error(
        `Member import ${jobId} stopped at row ${resumeIndex}`,
        error instanceof Error ? error.stack : String(error),
        'MemberImportService',
      );

      const detail = error instanceof Error ? error.message : String(error);
      await this.audit.record({
        tenantId,
        actorUserId: userId,
        action: 'onboarding.member_import_partial',
        resourceType: 'member_import_job',
        resourceId: jobId,
        metadata: { resumeIndex, message: detail },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      throw DomainError.memberImportInvalid(
        `The import stopped after ${resumeIndex} of ${rows.length} rows and can be resumed.`,
        [{ path: 'jobId', code: 'MEMBER_IMPORT_INVALID', message: detail }],
      );
    }
  }

  private async applyChunk(
    tenantId: string,
    chunk: MemberImportRow[],
  ): Promise<{ imported: number; duplicate: number; skipped: number }> {
    let imported = 0;
    let duplicate = 0;
    let skipped = 0;

    await this.prisma.withScope(
      { tenantId, isPlatformAdmin: true },
      async (tx) => {
        for (const row of chunk) {
          if (!row.email) {
            const user = await tx.user.create({
              data: {
                firstName: row.firstName,
                lastName: row.lastName,
                phone: row.phone ?? null,
                status: UserStatus.ACTIVE,
              },
              select: { id: true },
            });
            await this.createMembershipIfMissing(tx, tenantId, user.id, row.role as Role);
            imported += 1;
            continue;
          }

          const identity = await tx.userIdentity.findUnique({
            where: {
              provider_providerAccountId: {
                provider: IdentityProvider.EMAIL,
                providerAccountId: row.email,
              },
            },
            select: { userId: true },
          });

          if (identity) {
            const created = await this.createMembershipIfMissing(
              tx,
              tenantId,
              identity.userId,
              row.role as Role,
            );
            if (created) {
              imported += 1;
              duplicate += 1;
            } else {
              skipped += 1;
            }
            continue;
          }

          const user = await tx.user.create({
            data: {
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              phone: row.phone ?? null,
              status: UserStatus.ACTIVE,
            },
            select: { id: true },
          });

          await tx.userIdentity.create({
            data: {
              userId: user.id,
              provider: IdentityProvider.EMAIL,
              providerAccountId: row.email,
              email: row.email,
              isPrimary: true,
            },
          });

          await this.createMembershipIfMissing(tx, tenantId, user.id, row.role as Role);
          imported += 1;
        }
      },
    );

    return { imported, duplicate, skipped };
  }

  private async createMembershipIfMissing(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    role: Role,
  ): Promise<boolean> {
    const existing = await tx.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { id: true },
    });
    if (existing) return false;

    await tx.membership.create({
      data: {
        tenantId,
        userId,
        role: role as PrismaRole,
        status: MembershipStatus.ACTIVE,
      },
    });
    return true;
  }

  private async existingEmails(
    raw: Array<{ values: Record<string, string> }>,
  ): Promise<Set<string>> {
    const emails = new Set<string>();
    for (const entry of raw) {
      const email = entry.values.email?.trim().toLowerCase();
      if (email) emails.add(email);
    }
    if (emails.size === 0) return emails;

    const found = await this.prisma.withScope({ isPlatformAdmin: true }, (tx) =>
      tx.userIdentity.findMany({
        where: {
          provider: IdentityProvider.EMAIL,
          providerAccountId: { in: [...emails] },
        },
        select: { providerAccountId: true },
      }),
    );
    return new Set(found.map((identity) => identity.providerAccountId.toLowerCase()));
  }

  private async requireJob(tenantId: string, jobId: string): Promise<MemberImportJobRow> {
    const job = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberImportJob.findUnique({ where: { id: jobId } }),
    );
    if (!job) throw DomainError.notFound('Import job not found');
    return job;
  }
}

function toResponse(row: MemberImportJobRow): MemberImportJobResponse {
  return {
    id: row.id,
    status: row.status,
    fileName: row.fileName,
    totalRows: row.totalRows,
    validRows: row.validRows,
    invalidRows: row.invalidRows,
    importedRows: row.importedRows,
    skippedRows: row.skippedRows,
    duplicateRows: row.duplicateRows,
    resumeIndex: row.resumeIndex,
    issues: Array.isArray(row.issues) ? (row.issues as unknown as MemberImportJobResponse['issues']) : [],
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
