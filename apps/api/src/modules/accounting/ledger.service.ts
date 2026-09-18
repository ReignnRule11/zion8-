import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountStatus,
  AccountType,
  DEFAULT_CHART_ACCOUNTS,
  type Account,
  type AccountCreateRequest,
  type AccountListQuery,
  type AccountPage,
  type AccountUpdateRequest,
  type FiscalPeriod,
  type FiscalPeriodCreateRequest,
  type FiscalPeriodListQuery,
  type FiscalPeriodPage,
  type Journal,
  type JournalCreateRequest,
  type JournalListQuery,
  type JournalPage,
  type JournalVoidRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { OutboxService } from '../../infrastructure/events/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  nextNumber,
  normalBalanceOf,
  pageArgs,
  parseDateOnly,
  requiredDate,
  toBigInt,
  toDateOnly,
  toIso,
  toMinor,
} from './accounting.utils';

const ACCOUNT_SELECT = {
  id: true,
  tenantId: true,
  code: true,
  name: true,
  type: true,
  normalBalance: true,
  parentId: true,
  description: true,
  isPostable: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GlAccountSelect;

type AccountRow = Prisma.GlAccountGetPayload<{ select: typeof ACCOUNT_SELECT }>;

const JOURNAL_INCLUDE = {
  lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.JournalInclude;

type JournalRow = Prisma.JournalGetPayload<{ include: typeof JOURNAL_INCLUDE }>;

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async ensureChart(tenantId: string, actorUserId?: string): Promise<void> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.glAccount.count();
      if (existing > 0) return;
      for (const seed of DEFAULT_CHART_ACCOUNTS) {
        await tx.glAccount.create({
          data: {
            tenantId,
            code: seed.code,
            name: seed.name,
            type: seed.type,
            normalBalance: seed.normalBalance,
            isPostable: true,
          },
        });
      }
      if (actorUserId) {
        await this.audit.record(
          {
            tenantId,
            actorUserId,
            action: 'accounting.chart.seeded',
            resourceType: 'gl_account',
            metadata: { count: DEFAULT_CHART_ACCOUNTS.length },
          },
          tx,
        );
      }
    });
  }

  async createAccount(
    tenantId: string,
    actorUserId: string,
    input: AccountCreateRequest,
  ): Promise<Account> {
    await this.ensureChart(tenantId, actorUserId);
    try {
      const row = await this.prisma.withTenant(tenantId, async (tx) => {
        if (input.parentId) {
          const parent = await tx.glAccount.findFirst({ where: { id: input.parentId } });
          if (!parent) throw new DomainError('ACCOUNT_NOT_FOUND', 'That parent account could not be found');
        }
        const created = await tx.glAccount.create({
          data: {
            tenantId,
            code: input.code,
            name: input.name,
            type: input.type,
            normalBalance: input.normalBalance ?? normalBalanceOf(input.type),
            parentId: input.parentId ?? null,
            description: input.description ?? null,
            isPostable: input.isPostable,
          },
          select: ACCOUNT_SELECT,
        });
        await this.audit.record(
          {
            tenantId,
            actorUserId,
            action: 'accounting.account.created',
            resourceType: 'gl_account',
            resourceId: created.id,
            metadata: { code: created.code, type: created.type },
          },
          tx,
        );
        return created;
      });
      return this.toAccount(row);
    } catch (error) {
      throw this.mapAccountError(error);
    }
  }

  async listAccounts(tenantId: string, query: AccountListQuery): Promise<AccountPage> {
    await this.ensureChart(tenantId);
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.GlAccountWhereInput = {};
      if (query.type) where.type = query.type;
      if (query.status) where.status = query.status;
      else if (!query.includeArchived) where.status = { not: AccountStatus.ARCHIVED };
      if (query.search) {
        where.OR = [
          { code: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      const [items, total] = await Promise.all([
        tx.glAccount.findMany({
          where,
          select: ACCOUNT_SELECT,
          orderBy: [{ code: 'asc' }],
          ...pageArgs(query),
        }),
        tx.glAccount.count({ where }),
      ]);
      return { items: items.map((row) => this.toAccount(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getAccount(tenantId: string, id: string): Promise<Account> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.glAccount.findFirst({ where: { id }, select: ACCOUNT_SELECT }),
    );
    if (!row) throw new DomainError('ACCOUNT_NOT_FOUND', 'That account could not be found');
    return this.toAccount(row);
  }

  async updateAccount(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: AccountUpdateRequest,
  ): Promise<Account> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.glAccount.findFirst({ where: { id } });
      if (!existing) throw new DomainError('ACCOUNT_NOT_FOUND', 'That account could not be found');
      if (existing.status === AccountStatus.ARCHIVED && input.status !== AccountStatus.ACTIVE) {
        throw new DomainError('ACCOUNT_ARCHIVED', 'An archived account cannot be changed');
      }
      if (input.parentId) {
        if (input.parentId === id) {
          throw DomainError.validation([{ path: 'parentId', message: 'An account cannot be its own parent' }]);
        }
        const parent = await tx.glAccount.findFirst({ where: { id: input.parentId } });
        if (!parent) throw new DomainError('ACCOUNT_NOT_FOUND', 'That parent account could not be found');
      }
      const updated = await tx.glAccount.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          description: input.description === undefined ? undefined : input.description,
          parentId: input.parentId === undefined ? undefined : input.parentId,
          isPostable: input.isPostable ?? undefined,
          status: input.status ?? undefined,
        },
        select: ACCOUNT_SELECT,
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.account.updated',
          resourceType: 'gl_account',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toAccount(row);
  }

  async createPeriod(
    tenantId: string,
    actorUserId: string,
    input: FiscalPeriodCreateRequest,
  ): Promise<FiscalPeriod> {
    const startsOn = requiredDate(input.startsOn);
    const endsOn = requiredDate(input.endsOn);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const overlap = await tx.fiscalPeriod.findFirst({
        where: { startsOn: { lte: endsOn }, endsOn: { gte: startsOn } },
      });
      if (overlap) {
        throw new DomainError('PERIOD_OVERLAP', 'That range overlaps an existing fiscal period');
      }
      const created = await tx.fiscalPeriod.create({
        data: { tenantId, name: input.name, startsOn, endsOn },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.period.created',
          resourceType: 'fiscal_period',
          resourceId: created.id,
          metadata: { name: created.name },
        },
        tx,
      );
      return created;
    });
    return this.toPeriod(row);
  }

  async listPeriods(tenantId: string, query: FiscalPeriodListQuery): Promise<FiscalPeriodPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.FiscalPeriodWhereInput = {};
      if (query.status) where.status = query.status;
      const [items, total] = await Promise.all([
        tx.fiscalPeriod.findMany({
          where,
          orderBy: [{ startsOn: 'desc' }],
          ...pageArgs(query),
        }),
        tx.fiscalPeriod.count({ where }),
      ]);
      return { items: items.map((row) => this.toPeriod(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async closePeriod(tenantId: string, actorUserId: string, periodId: string): Promise<FiscalPeriod> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { id: periodId } });
      if (!period) throw new DomainError('PERIOD_NOT_FOUND', 'That fiscal period could not be found');
      if (period.status !== 'OPEN') {
        throw new DomainError('PERIOD_CLOSED', 'That fiscal period is already closed');
      }
      const updated = await tx.fiscalPeriod.update({
        where: { id: periodId },
        data: { status: 'CLOSED', closedAt: new Date(), closedByUserId: actorUserId },
      });
      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'accounting.period.closed',
        aggregateType: 'fiscal_period',
        aggregateId: periodId,
        payload: { periodId, name: period.name },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.period.closed',
          resourceType: 'fiscal_period',
          resourceId: periodId,
        },
        tx,
      );
      return updated;
    });
    return this.toPeriod(row);
  }

  async createJournal(
    tenantId: string,
    actorUserId: string,
    input: JournalCreateRequest,
    options?: { autoPost?: boolean },
  ): Promise<Journal> {
    await this.ensureChart(tenantId, actorUserId);
    const occurredOn = requiredDate(input.occurredOn);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      return this.writeJournal(tx, tenantId, actorUserId, input, occurredOn, options?.autoPost ?? false);
    });
    return this.toJournal(row);
  }

  async writeJournal(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorUserId: string,
    input: JournalCreateRequest,
    occurredOn: Date,
    autoPost: boolean,
  ): Promise<JournalRow> {
    const period = await tx.fiscalPeriod.findFirst({
      where: { startsOn: { lte: occurredOn }, endsOn: { gte: occurredOn } },
    });
    if (period && period.status !== 'OPEN') {
      throw new DomainError('PERIOD_CLOSED', 'That date falls in a closed fiscal period');
    }
    const accountIds = [...new Set(input.lines.map((line) => line.accountId))];
    const accounts = await tx.glAccount.findMany({ where: { id: { in: accountIds } } });
    if (accounts.length !== accountIds.length) {
      throw new DomainError('ACCOUNT_NOT_FOUND', 'A journal line referenced an unknown account');
    }
    for (const account of accounts) {
      if (account.status === AccountStatus.ARCHIVED) {
        throw new DomainError('ACCOUNT_ARCHIVED', `Account ${account.code} is archived`);
      }
      if (!account.isPostable) {
        throw new DomainError('ACCOUNT_NOT_POSTABLE', `Account ${account.code} is not postable`);
      }
    }
    const max = await tx.journal.aggregate({ _max: { number: true } });
    const number = nextNumber(max._max.number);
    const created = await tx.journal.create({
      data: {
        tenantId,
        number,
        memo: input.memo,
        occurredOn,
        source: input.source,
        reference: input.reference ?? null,
        periodId: period?.id ?? null,
        createdByUserId: actorUserId,
        status: autoPost ? 'POSTED' : 'DRAFT',
        postedAt: autoPost ? new Date() : null,
        postedByUserId: autoPost ? actorUserId : null,
        lines: {
          create: input.lines.map((line) => ({
            tenantId,
            accountId: line.accountId,
            description: line.description ?? null,
            debitMinor: toBigInt(line.debitMinor),
            creditMinor: toBigInt(line.creditMinor),
            fundId: line.fundId ?? null,
            projectId: line.projectId ?? null,
            departmentId: line.departmentId ?? null,
          })),
        },
      },
      include: JOURNAL_INCLUDE,
    });
    await this.outbox.enqueue(tx, {
      id: randomUUID(),
      tenantId,
      type: autoPost ? 'accounting.journal.posted' : 'accounting.journal.created',
      aggregateType: 'journal',
      aggregateId: created.id,
      payload: { journalId: created.id, number, source: input.source, autoPost },
      headers: { 'x-zion8-event-version': 1 },
      occurredAt: new Date().toISOString(),
    });
    await this.audit.record(
      {
        tenantId,
        actorUserId,
        action: autoPost ? 'accounting.journal.posted' : 'accounting.journal.created',
        resourceType: 'journal',
        resourceId: created.id,
        metadata: { number, source: input.source },
      },
      tx,
    );
    return created;
  }

  async listJournals(tenantId: string, query: JournalListQuery): Promise<JournalPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.JournalWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.source) where.source = query.source;
      if (query.from || query.to) {
        where.occurredOn = {};
        if (query.from) where.occurredOn.gte = requiredDate(query.from);
        if (query.to) where.occurredOn.lte = requiredDate(query.to);
      }
      if (query.search) {
        where.OR = [
          { memo: { contains: query.search, mode: 'insensitive' } },
          { reference: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      const [items, total] = await Promise.all([
        tx.journal.findMany({
          where,
          include: { lines: true },
          orderBy: [{ occurredOn: 'desc' }, { number: 'desc' }],
          ...pageArgs(query),
        }),
        tx.journal.count({ where }),
      ]);
      return {
        items: items.map((row) => this.toJournalSummary(row)),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async getJournal(tenantId: string, id: string): Promise<Journal> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.journal.findFirst({ where: { id }, include: JOURNAL_INCLUDE }),
    );
    if (!row) throw new DomainError('JOURNAL_NOT_FOUND', 'That journal could not be found');
    return this.toJournal(row);
  }

  async postJournal(tenantId: string, actorUserId: string, id: string): Promise<Journal> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.journal.findFirst({ where: { id }, include: JOURNAL_INCLUDE });
      if (!existing) throw new DomainError('JOURNAL_NOT_FOUND', 'That journal could not be found');
      if (existing.status === 'POSTED') {
        throw new DomainError('JOURNAL_ALREADY_POSTED', 'That journal is already posted');
      }
      if (existing.status === 'VOID') {
        throw new DomainError('JOURNAL_ALREADY_VOID', 'A void journal cannot be posted');
      }
      if (existing.periodId) {
        const period = await tx.fiscalPeriod.findFirst({ where: { id: existing.periodId } });
        if (period && period.status !== 'OPEN') {
          throw new DomainError('PERIOD_CLOSED', 'That journal falls in a closed fiscal period');
        }
      }
      const updated = await tx.journal.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedByUserId: actorUserId },
        include: JOURNAL_INCLUDE,
      });
      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'accounting.journal.posted',
        aggregateType: 'journal',
        aggregateId: id,
        payload: { journalId: id, number: existing.number },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.journal.posted',
          resourceType: 'journal',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toJournal(row);
  }

  async voidJournal(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: JournalVoidRequest,
  ): Promise<Journal> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.journal.findFirst({ where: { id }, include: JOURNAL_INCLUDE });
      if (!existing) throw new DomainError('JOURNAL_NOT_FOUND', 'That journal could not be found');
      if (existing.status === 'VOID') {
        throw new DomainError('JOURNAL_ALREADY_VOID', 'That journal is already void');
      }
      if (existing.periodId) {
        const period = await tx.fiscalPeriod.findFirst({ where: { id: existing.periodId } });
        if (period && period.status !== 'OPEN') {
          throw new DomainError('PERIOD_CLOSED', 'A closed period cannot accept a void');
        }
      }
      const updated = await tx.journal.update({
        where: { id },
        data: { status: 'VOID', voidedAt: new Date(), voidReason: input.reason },
        include: JOURNAL_INCLUDE,
      });
      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'accounting.journal.voided',
        aggregateType: 'journal',
        aggregateId: id,
        payload: { journalId: id, reason: input.reason },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.journal.voided',
          resourceType: 'journal',
          resourceId: id,
          metadata: { reason: input.reason },
        },
        tx,
      );
      return updated;
    });
    return this.toJournal(row);
  }

  async requireAccount(
    tx: Prisma.TransactionClient,
    id: string,
    type?: AccountType,
  ): Promise<{ id: string; code: string; name: string; type: AccountType }> {
    const account = await tx.glAccount.findFirst({ where: { id } });
    if (!account) throw new DomainError('ACCOUNT_NOT_FOUND', 'That account could not be found');
    if (account.status === AccountStatus.ARCHIVED) {
      throw new DomainError('ACCOUNT_ARCHIVED', `Account ${account.code} is archived`);
    }
    if (!account.isPostable) {
      throw new DomainError('ACCOUNT_NOT_POSTABLE', `Account ${account.code} is not postable`);
    }
    if (type && account.type !== type) {
      throw new DomainError('ACCOUNT_NOT_POSTABLE', `Account ${account.code} is not a ${type} account`);
    }
    return account;
  }

  async accountByCode(
    tx: Prisma.TransactionClient,
    code: string,
  ): Promise<{ id: string; code: string; name: string; type: AccountType } | null> {
    return tx.glAccount.findFirst({ where: { code } });
  }

  async postedTotals(
    tx: Prisma.TransactionClient,
    options: {
      accountId?: string;
      projectId?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<{ debitMinor: number; creditMinor: number }> {
    const where: Prisma.JournalLineWhereInput = {
      journal: { status: 'POSTED' },
    };
    if (options.accountId) where.accountId = options.accountId;
    if (options.projectId) where.projectId = options.projectId;
    if (options.from || options.to) {
      where.journal = {
        status: 'POSTED',
        occurredOn: {
          gte: options.from,
          lte: options.to,
        },
      };
    }
    const grouped = await tx.journalLine.aggregate({
      where,
      _sum: { debitMinor: true, creditMinor: true },
    });
    return {
      debitMinor: toMinor(grouped._sum.debitMinor ?? 0n),
      creditMinor: toMinor(grouped._sum.creditMinor ?? 0n),
    };
  }

  toAccount(row: AccountRow): Account {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      type: row.type,
      normalBalance: row.normalBalance,
      parentId: row.parentId,
      description: row.description,
      isPostable: row.isPostable,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toPeriod(row: {
    id: string;
    tenantId: string;
    name: string;
    startsOn: Date;
    endsOn: Date;
    status: FiscalPeriod['status'];
    closedAt: Date | null;
    closedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FiscalPeriod {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      startsOn: toDateOnly(row.startsOn)!,
      endsOn: toDateOnly(row.endsOn)!,
      status: row.status,
      closedAt: toIso(row.closedAt),
      closedByUserId: row.closedByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toJournal(row: JournalRow): Journal {
    const lines = row.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      description: line.description,
      debitMinor: toMinor(line.debitMinor),
      creditMinor: toMinor(line.creditMinor),
      fundId: line.fundId,
      projectId: line.projectId,
      departmentId: line.departmentId,
    }));
    const debitMinor = lines.reduce((sum, line) => sum + line.debitMinor, 0);
    const creditMinor = lines.reduce((sum, line) => sum + line.creditMinor, 0);
    return {
      id: row.id,
      tenantId: row.tenantId,
      number: row.number,
      memo: row.memo,
      occurredOn: toDateOnly(row.occurredOn)!,
      status: row.status,
      source: row.source,
      reference: row.reference,
      periodId: row.periodId,
      debitMinor,
      creditMinor,
      createdByUserId: row.createdByUserId,
      postedByUserId: row.postedByUserId,
      postedAt: toIso(row.postedAt),
      voidedAt: toIso(row.voidedAt),
      voidReason: row.voidReason,
      lines,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toJournalSummary(row: {
    id: string;
    number: number;
    memo: string;
    occurredOn: Date;
    status: Journal['status'];
    source: Journal['source'];
    reference: string | null;
    postedAt: Date | null;
    createdAt: Date;
    lines: Array<{ debitMinor: bigint; creditMinor: bigint }>;
  }) {
    return {
      id: row.id,
      number: row.number,
      memo: row.memo,
      occurredOn: toDateOnly(row.occurredOn)!,
      status: row.status,
      source: row.source,
      reference: row.reference,
      debitMinor: row.lines.reduce((sum, line) => sum + toMinor(line.debitMinor), 0),
      creditMinor: row.lines.reduce((sum, line) => sum + toMinor(line.creditMinor), 0),
      postedAt: toIso(row.postedAt),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapAccountError(error: unknown): never {
    if (error instanceof DomainError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new DomainError('ACCOUNT_CODE_TAKEN', 'That account code is already in use');
    }
    throw error;
  }
}
