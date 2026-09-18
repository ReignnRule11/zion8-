import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountType,
  type Budget,
  type BudgetCreateRequest,
  type BudgetListQuery,
  type BudgetPage,
  type Project,
  type ProjectCreateRequest,
  type ProjectListQuery,
  type ProjectPage,
  type ProjectUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { pageArgs, parseDateOnly, requiredDate, signedBalance, toDateOnly, toMinor } from './accounting.utils';
import { LedgerService } from './ledger.service';

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async createBudget(tenantId: string, actorUserId: string, input: BudgetCreateRequest): Promise<Budget> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      for (const line of input.lines) {
        await this.ledger.requireAccount(tx, line.accountId);
      }
      const created = await tx.budget.create({
        data: {
          tenantId,
          name: input.name,
          startsOn: requiredDate(input.startsOn),
          endsOn: requiredDate(input.endsOn),
          notes: input.notes ?? null,
          lines: {
            create: input.lines.map((line) => ({
              tenantId,
              accountId: line.accountId,
              amountMinor: BigInt(line.amountMinor),
              notes: line.notes ?? null,
            })),
          },
        },
        include: { lines: { include: { account: true } } },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.budget.created',
          resourceType: 'budget',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toBudget(row, await this.actualsForBudget(tenantId, row));
  }

  async listBudgets(tenantId: string, query: BudgetListQuery): Promise<BudgetPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.BudgetWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
      const [items, total] = await Promise.all([
        tx.budget.findMany({
          where,
          include: { lines: { include: { account: true } } },
          orderBy: { startsOn: 'desc' },
          ...pageArgs(query),
        }),
        tx.budget.count({ where }),
      ]);
      const mapped = [];
      for (const row of items) {
        const actuals = await this.actualsMap(tx, row.startsOn, row.endsOn);
        mapped.push(this.toBudgetSummary(row, actuals));
      }
      return { items: mapped, total, limit: query.limit, offset: query.offset };
    });
  }

  async getBudget(tenantId: string, id: string): Promise<Budget> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.budget.findFirst({ where: { id }, include: { lines: { include: { account: true } } } }),
    );
    if (!row) throw new DomainError('BUDGET_NOT_FOUND', 'That budget could not be found');
    return this.toBudget(row, await this.actualsForBudget(tenantId, row));
  }

  async activateBudget(tenantId: string, actorUserId: string, id: string): Promise<Budget> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.budget.findFirst({
        where: { id },
        include: { lines: { include: { account: true } } },
      });
      if (!existing) throw new DomainError('BUDGET_NOT_FOUND', 'That budget could not be found');
      const updated = await tx.budget.update({
        where: { id },
        data: { status: 'ACTIVE' },
        include: { lines: { include: { account: true } } },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.budget.activated',
          resourceType: 'budget',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toBudget(row, await this.actualsForBudget(tenantId, row));
  }

  async createProject(
    tenantId: string,
    actorUserId: string,
    input: ProjectCreateRequest,
  ): Promise<Project> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      if (input.expenseAccountId) await this.ledger.requireAccount(tx, input.expenseAccountId, AccountType.EXPENSE);
      const created = await tx.financeProject.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description ?? null,
          startsOn: parseDateOnly(input.startsOn),
          endsOn: parseDateOnly(input.endsOn),
          budgetMinor: BigInt(input.budgetMinor),
          expenseAccountId: input.expenseAccountId ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.project.created',
          resourceType: 'finance_project',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toProject(row, 0);
  }

  async listProjects(tenantId: string, query: ProjectListQuery): Promise<ProjectPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.FinanceProjectWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
      const [items, total] = await Promise.all([
        tx.financeProject.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
        tx.financeProject.count({ where }),
      ]);
      const mapped = [];
      for (const row of items) {
        const spent = await this.projectSpent(tx, row.id);
        mapped.push(this.toProject(row, spent));
      }
      return { items: mapped, total, limit: query.limit, offset: query.offset };
    });
  }

  async getProject(tenantId: string, id: string): Promise<Project> {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const row = await tx.financeProject.findFirst({ where: { id } });
      if (!row) throw new DomainError('PROJECT_NOT_FOUND', 'That project could not be found');
      const spent = await this.projectSpent(tx, id);
      return { row, spent };
    });
    return this.toProject(result.row, result.spent);
  }

  async updateProject(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: ProjectUpdateRequest,
  ): Promise<Project> {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.financeProject.findFirst({ where: { id } });
      if (!existing) throw new DomainError('PROJECT_NOT_FOUND', 'That project could not be found');
      const updated = await tx.financeProject.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          description: input.description === undefined ? undefined : input.description,
          startsOn: input.startsOn === undefined ? undefined : parseDateOnly(input.startsOn),
          endsOn: input.endsOn === undefined ? undefined : parseDateOnly(input.endsOn),
          budgetMinor: input.budgetMinor === undefined ? undefined : BigInt(input.budgetMinor),
          expenseAccountId: input.expenseAccountId === undefined ? undefined : input.expenseAccountId,
          status: input.status ?? undefined,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.project.updated',
          resourceType: 'finance_project',
          resourceId: id,
        },
        tx,
      );
      const spent = await this.projectSpent(tx, id);
      return { row: updated, spent };
    });
    return this.toProject(result.row, result.spent);
  }

  private async projectSpent(tx: Prisma.TransactionClient, projectId: string): Promise<number> {
    const totals = await tx.journalLine.aggregate({
      where: { projectId, journal: { status: 'POSTED' } },
      _sum: { debitMinor: true, creditMinor: true },
    });
    return toMinor(totals._sum.debitMinor ?? 0n) - toMinor(totals._sum.creditMinor ?? 0n);
  }

  private async actualsMap(
    tx: Prisma.TransactionClient,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const lines = await tx.journalLine.groupBy({
      by: ['accountId'],
      where: { journal: { status: 'POSTED', occurredOn: { gte: from, lte: to } } },
      _sum: { debitMinor: true, creditMinor: true },
    });
    const accounts = await tx.glAccount.findMany({
      where: { id: { in: lines.map((line) => line.accountId) } },
    });
    const typeById = new Map(accounts.map((account) => [account.id, account.type]));
    const map = new Map<string, number>();
    for (const line of lines) {
      const type = typeById.get(line.accountId) ?? AccountType.EXPENSE;
      map.set(
        line.accountId,
        signedBalance(type, toMinor(line._sum.debitMinor ?? 0n), toMinor(line._sum.creditMinor ?? 0n)),
      );
    }
    return map;
  }

  private async actualsForBudget(
    tenantId: string,
    row: { startsOn: Date; endsOn: Date },
  ): Promise<Map<string, number>> {
    return this.prisma.withTenant(tenantId, (tx) => this.actualsMap(tx, row.startsOn, row.endsOn));
  }

  private toBudget(
    row: {
      id: string;
      tenantId: string;
      name: string;
      startsOn: Date;
      endsOn: Date;
      status: Budget['status'];
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      lines: Array<{
        id: string;
        accountId: string;
        amountMinor: bigint;
        notes: string | null;
        account: { code: string; name: string };
      }>;
    },
    actuals: Map<string, number>,
  ): Budget {
    const lines = row.lines.map((line) => {
      const amountMinor = toMinor(line.amountMinor);
      const actualMinor = actuals.get(line.accountId) ?? 0;
      return {
        id: line.id,
        accountId: line.accountId,
        accountCode: line.account.code,
        accountName: line.account.name,
        amountMinor,
        actualMinor,
        varianceMinor: amountMinor - actualMinor,
        notes: line.notes,
      };
    });
    const totalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
    const actualMinor = lines.reduce((sum, line) => sum + line.actualMinor, 0);
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      startsOn: toDateOnly(row.startsOn)!,
      endsOn: toDateOnly(row.endsOn)!,
      status: row.status,
      notes: row.notes,
      totalMinor,
      actualMinor,
      lines,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBudgetSummary(
    row: {
      id: string;
      tenantId: string;
      name: string;
      startsOn: Date;
      endsOn: Date;
      status: Budget['status'];
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      lines: Array<{ accountId: string; amountMinor: bigint }>;
    },
    actuals: Map<string, number>,
  ) {
    const totalMinor = row.lines.reduce((sum, line) => sum + toMinor(line.amountMinor), 0);
    const actualMinor = row.lines.reduce((sum, line) => sum + (actuals.get(line.accountId) ?? 0), 0);
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      startsOn: toDateOnly(row.startsOn)!,
      endsOn: toDateOnly(row.endsOn)!,
      status: row.status,
      notes: row.notes,
      totalMinor,
      actualMinor,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toProject(
    row: {
      id: string;
      tenantId: string;
      name: string;
      description: string | null;
      status: Project['status'];
      startsOn: Date | null;
      endsOn: Date | null;
      budgetMinor: bigint;
      expenseAccountId: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    spentMinor: number,
  ): Project {
    const budgetMinor = toMinor(row.budgetMinor);
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      status: row.status,
      startsOn: toDateOnly(row.startsOn),
      endsOn: toDateOnly(row.endsOn),
      budgetMinor,
      spentMinor,
      remainingMinor: budgetMinor - spentMinor,
      expenseAccountId: row.expenseAccountId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
