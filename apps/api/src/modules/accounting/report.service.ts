import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountType,
  ReportKind,
  type Report,
  type ReportLine,
  type ReportQuery,
  type ReportSection,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { parseDateOnly, requiredDate, signedBalance, toDateOnly, toMinor } from './accounting.utils';
import { LedgerService } from './ledger.service';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async generate(tenantId: string, query: ReportQuery): Promise<Report> {
    await this.ledger.ensureChart(tenantId);
    switch (query.kind) {
      case ReportKind.TRIAL_BALANCE:
        return this.trialBalance(tenantId, query);
      case ReportKind.INCOME_STATEMENT:
        return this.incomeStatement(tenantId, query);
      case ReportKind.BALANCE_SHEET:
        return this.balanceSheet(tenantId, query);
      case ReportKind.BUDGET_VS_ACTUAL:
        return this.budgetVsActual(tenantId, query);
      case ReportKind.GIVING_STATEMENT:
        return this.givingStatement(tenantId, query);
      case ReportKind.PROJECT_COST:
        return this.projectCost(tenantId, query);
      case ReportKind.CASH_ACTIVITY:
        return this.cashActivity(tenantId, query);
      default:
        throw DomainError.validation([{ path: 'kind', message: 'Unknown report kind' }]);
    }
  }

  private async trialBalance(tenantId: string, query: ReportQuery): Promise<Report> {
    const asOf = query.asOf ? requiredDate(query.asOf) : query.to ? requiredDate(query.to) : new Date();
    const lines = await this.accountLines(tenantId, undefined, asOf);
    const debit = lines.reduce((sum, line) => sum + line.debitMinor, 0);
    const credit = lines.reduce((sum, line) => sum + line.creditMinor, 0);
    return this.wrap(query, 'Trial Balance', [this.section('Accounts', lines)], debit - credit, null, toDateOnly(asOf));
  }

  private async incomeStatement(tenantId: string, query: ReportQuery): Promise<Report> {
    const from = query.from ? requiredDate(query.from) : requiredDate('1970-01-01');
    const to = query.to ? requiredDate(query.to) : new Date();
    const lines = await this.accountLines(tenantId, from, to);
    const revenue = lines.filter((line) => line.accountType === AccountType.REVENUE);
    const expense = lines.filter((line) => line.accountType === AccountType.EXPENSE);
    const revenueTotal = revenue.reduce((sum, line) => sum + line.balanceMinor, 0);
    const expenseTotal = expense.reduce((sum, line) => sum + line.balanceMinor, 0);
    return this.wrap(
      query,
      'Income Statement',
      [this.section('Revenue', revenue), this.section('Expenses', expense)],
      revenueTotal - expenseTotal,
      toDateOnly(from),
      toDateOnly(to),
    );
  }

  private async balanceSheet(tenantId: string, query: ReportQuery): Promise<Report> {
    const asOf = query.asOf ? requiredDate(query.asOf) : query.to ? requiredDate(query.to) : new Date();
    const lines = await this.accountLines(tenantId, undefined, asOf);
    const assets = lines.filter((line) => line.accountType === AccountType.ASSET);
    const liabilities = lines.filter((line) => line.accountType === AccountType.LIABILITY);
    const equity = lines.filter((line) => line.accountType === AccountType.EQUITY);
    const assetTotal = assets.reduce((sum, line) => sum + line.balanceMinor, 0);
    const liabilityTotal = liabilities.reduce((sum, line) => sum + line.balanceMinor, 0);
    const equityTotal = equity.reduce((sum, line) => sum + line.balanceMinor, 0);
    return this.wrap(
      query,
      'Balance Sheet',
      [
        this.section('Assets', assets),
        this.section('Liabilities', liabilities),
        this.section('Equity', equity),
      ],
      assetTotal - (liabilityTotal + equityTotal),
      null,
      toDateOnly(asOf),
    );
  }

  private async budgetVsActual(tenantId: string, query: ReportQuery): Promise<Report> {
    if (!query.budgetId) {
      throw DomainError.validation([{ path: 'budgetId', message: 'A budget id is required' }]);
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      const budget = await tx.budget.findFirst({
        where: { id: query.budgetId },
        include: { lines: { include: { account: true } } },
      });
      if (!budget) throw new DomainError('BUDGET_NOT_FOUND', 'That budget could not be found');
      const grouped = await tx.journalLine.groupBy({
        by: ['accountId'],
        where: {
          journal: { status: 'POSTED', occurredOn: { gte: budget.startsOn, lte: budget.endsOn } },
        },
        _sum: { debitMinor: true, creditMinor: true },
      });
      const actuals = new Map(
        grouped.map((row) => [
          row.accountId,
          toMinor(row._sum.debitMinor ?? 0n) - toMinor(row._sum.creditMinor ?? 0n),
        ]),
      );
      const lines: ReportLine[] = budget.lines.map((line) => {
        const budgetMinor = toMinor(line.amountMinor);
        const actualMinor = actuals.get(line.accountId) ?? 0;
        return {
          accountId: line.accountId,
          accountCode: line.account.code,
          accountName: line.account.name,
          accountType: line.account.type,
          debitMinor: 0,
          creditMinor: 0,
          balanceMinor: actualMinor,
          budgetMinor,
          actualMinor,
          varianceMinor: budgetMinor - actualMinor,
        };
      });
      return this.wrap(
        query,
        `Budget vs Actual · ${budget.name}`,
        [this.section('Lines', lines)],
        lines.reduce((sum, line) => sum + (line.varianceMinor ?? 0), 0),
        toDateOnly(budget.startsOn),
        toDateOnly(budget.endsOn),
      );
    });
  }

  private async givingStatement(tenantId: string, query: ReportQuery): Promise<Report> {
    const from = query.from ? requiredDate(query.from) : requiredDate('1970-01-01');
    const to = query.to ? requiredDate(query.to) : new Date();
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.ContributionWhereInput = {
        status: { in: ['POSTED', 'REFUNDED'] },
        receivedOn: { gte: from, lte: to },
      };
      if (query.memberId) where.memberId = query.memberId;
      const rows = await tx.contribution.findMany({
        where,
        include: { fund: true },
        orderBy: { receivedOn: 'asc' },
      });
      const byFund = new Map<string, { name: string; posted: number; refunded: number }>();
      for (const row of rows) {
        const current = byFund.get(row.fundId) ?? { name: row.fund.name, posted: 0, refunded: 0 };
        const amount = toMinor(row.amountMinor);
        if (row.status === 'REFUNDED' && row.refundOfId) current.refunded += amount;
        else if (row.status === 'POSTED') current.posted += amount;
        byFund.set(row.fundId, current);
      }
      const lines: ReportLine[] = [...byFund.entries()].map(([fundId, value]) => ({
        accountId: fundId,
        accountCode: null,
        accountName: value.name,
        accountType: AccountType.REVENUE,
        debitMinor: value.refunded,
        creditMinor: value.posted,
        balanceMinor: value.posted - value.refunded,
        budgetMinor: null,
        actualMinor: value.posted - value.refunded,
        varianceMinor: null,
      }));
      return this.wrap(
        query,
        'Giving Statement',
        [this.section('Funds', lines)],
        lines.reduce((sum, line) => sum + line.balanceMinor, 0),
        toDateOnly(from),
        toDateOnly(to),
      );
    });
  }

  private async projectCost(tenantId: string, query: ReportQuery): Promise<Report> {
    if (!query.projectId) {
      throw DomainError.validation([{ path: 'projectId', message: 'A project id is required' }]);
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      const project = await tx.financeProject.findFirst({ where: { id: query.projectId } });
      if (!project) throw new DomainError('PROJECT_NOT_FOUND', 'That project could not be found');
      const grouped = await tx.journalLine.groupBy({
        by: ['accountId'],
        where: { projectId: project.id, journal: { status: 'POSTED' } },
        _sum: { debitMinor: true, creditMinor: true },
      });
      const accounts = await tx.glAccount.findMany({
        where: { id: { in: grouped.map((row) => row.accountId) } },
      });
      const byId = new Map(accounts.map((account) => [account.id, account]));
      const lines: ReportLine[] = grouped.map((row) => {
        const account = byId.get(row.accountId);
        const debit = toMinor(row._sum.debitMinor ?? 0n);
        const credit = toMinor(row._sum.creditMinor ?? 0n);
        return {
          accountId: row.accountId,
          accountCode: account?.code ?? null,
          accountName: account?.name ?? 'Unknown',
          accountType: account?.type ?? null,
          debitMinor: debit,
          creditMinor: credit,
          balanceMinor: debit - credit,
          budgetMinor: toMinor(project.budgetMinor),
          actualMinor: debit - credit,
          varianceMinor: toMinor(project.budgetMinor) - (debit - credit),
        };
      });
      const spent = lines.reduce((sum, line) => sum + line.balanceMinor, 0);
      return this.wrap(
        query,
        `Project Cost · ${project.name}`,
        [this.section('Spend', lines)],
        toMinor(project.budgetMinor) - spent,
        toDateOnly(project.startsOn),
        toDateOnly(project.endsOn),
      );
    });
  }

  private async cashActivity(tenantId: string, query: ReportQuery): Promise<Report> {
    const from = query.from ? requiredDate(query.from) : requiredDate('1970-01-01');
    const to = query.to ? requiredDate(query.to) : new Date();
    return this.prisma.withTenant(tenantId, async (tx) => {
      const cash = await tx.glAccount.findMany({ where: { type: AccountType.ASSET, code: { startsWith: '1' } } });
      const ids = cash.map((account) => account.id);
      const grouped = await tx.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: ids },
          journal: { status: 'POSTED', occurredOn: { gte: from, lte: to } },
        },
        _sum: { debitMinor: true, creditMinor: true },
      });
      const byId = new Map(cash.map((account) => [account.id, account]));
      const lines: ReportLine[] = grouped.map((row) => {
        const account = byId.get(row.accountId);
        const debit = toMinor(row._sum.debitMinor ?? 0n);
        const credit = toMinor(row._sum.creditMinor ?? 0n);
        return {
          accountId: row.accountId,
          accountCode: account?.code ?? null,
          accountName: account?.name ?? 'Cash',
          accountType: AccountType.ASSET,
          debitMinor: debit,
          creditMinor: credit,
          balanceMinor: debit - credit,
          budgetMinor: null,
          actualMinor: debit - credit,
          varianceMinor: null,
        };
      });
      return this.wrap(
        query,
        'Cash Activity',
        [this.section('Cash accounts', lines)],
        lines.reduce((sum, line) => sum + line.balanceMinor, 0),
        toDateOnly(from),
        toDateOnly(to),
      );
    });
  }

  private async accountLines(tenantId: string, from: Date | undefined, to: Date): Promise<ReportLine[]> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const accounts = await tx.glAccount.findMany({
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { code: 'asc' },
      });
      const where: Prisma.JournalLineWhereInput = {
        journal: {
          status: 'POSTED',
          occurredOn: from ? { gte: from, lte: to } : { lte: to },
        },
      };
      const grouped = await tx.journalLine.groupBy({
        by: ['accountId'],
        where,
        _sum: { debitMinor: true, creditMinor: true },
      });
      const totals = new Map(
        grouped.map((row) => [
          row.accountId,
          { debit: toMinor(row._sum.debitMinor ?? 0n), credit: toMinor(row._sum.creditMinor ?? 0n) },
        ]),
      );
      return accounts.map((account) => {
        const total = totals.get(account.id) ?? { debit: 0, credit: 0 };
        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          debitMinor: total.debit,
          creditMinor: total.credit,
          balanceMinor: signedBalance(account.type, total.debit, total.credit),
          budgetMinor: null,
          actualMinor: null,
          varianceMinor: null,
        };
      });
    });
  }

  private section(name: string, lines: ReportLine[]): ReportSection {
    return {
      name,
      totalMinor: lines.reduce((sum, line) => sum + line.balanceMinor, 0),
      lines,
    };
  }

  private wrap(
    query: ReportQuery,
    title: string,
    sections: ReportSection[],
    netMinor: number,
    from: string | null,
    to: string | null,
  ): Report {
    return {
      kind: query.kind,
      title,
      generatedAt: new Date().toISOString(),
      from: query.from ?? from,
      to: query.to ?? to,
      asOf: query.asOf ?? to,
      currency: 'USD',
      sections,
      netMinor,
    };
  }
}
