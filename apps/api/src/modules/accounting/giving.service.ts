import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountType,
  type Contribution,
  type ContributionCreateRequest,
  type ContributionListQuery,
  type ContributionPage,
  type ContributionRefundRequest,
  type Fund,
  type FundCreateRequest,
  type FundListQuery,
  type FundPage,
  type FundUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { pageArgs, requiredDate, toDateOnly, toMinor } from './accounting.utils';
import { LedgerService } from './ledger.service';

@Injectable()
export class GivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async createFund(tenantId: string, actorUserId: string, input: FundCreateRequest): Promise<Fund> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      if (input.revenueAccountId) await this.ledger.requireAccount(tx, input.revenueAccountId, AccountType.REVENUE);
      if (input.assetAccountId) await this.ledger.requireAccount(tx, input.assetAccountId, AccountType.ASSET);
      const created = await tx.givingFund.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description ?? null,
          restricted: input.restricted,
          revenueAccountId: input.revenueAccountId ?? (await this.ledger.accountByCode(tx, '4000'))?.id ?? null,
          assetAccountId: input.assetAccountId ?? (await this.ledger.accountByCode(tx, '1000'))?.id ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.fund.created',
          resourceType: 'giving_fund',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toFund(row);
  }

  async listFunds(tenantId: string, query: FundListQuery): Promise<FundPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.GivingFundWhereInput = {};
      if (!query.includeArchived) where.status = { not: 'ARCHIVED' };
      if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
      const [items, total] = await Promise.all([
        tx.givingFund.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
        tx.givingFund.count({ where }),
      ]);
      return { items: items.map((row) => this.toFund(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getFund(tenantId: string, id: string): Promise<Fund> {
    const row = await this.prisma.withTenant(tenantId, (tx) => tx.givingFund.findFirst({ where: { id } }));
    if (!row) throw new DomainError('FUND_NOT_FOUND', 'That fund could not be found');
    return this.toFund(row);
  }

  async updateFund(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: FundUpdateRequest,
  ): Promise<Fund> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.givingFund.findFirst({ where: { id } });
      if (!existing) throw new DomainError('FUND_NOT_FOUND', 'That fund could not be found');
      if (input.revenueAccountId) await this.ledger.requireAccount(tx, input.revenueAccountId, AccountType.REVENUE);
      if (input.assetAccountId) await this.ledger.requireAccount(tx, input.assetAccountId, AccountType.ASSET);
      const updated = await tx.givingFund.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          description: input.description === undefined ? undefined : input.description,
          restricted: input.restricted ?? undefined,
          revenueAccountId: input.revenueAccountId === undefined ? undefined : input.revenueAccountId,
          assetAccountId: input.assetAccountId === undefined ? undefined : input.assetAccountId,
          status: input.status ?? undefined,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.fund.updated',
          resourceType: 'giving_fund',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toFund(row);
  }

  async recordContribution(
    tenantId: string,
    actorUserId: string,
    input: ContributionCreateRequest,
  ): Promise<Contribution> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const receivedOn = requiredDate(input.receivedOn);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const fund = await tx.givingFund.findFirst({ where: { id: input.fundId } });
      if (!fund) throw new DomainError('FUND_NOT_FOUND', 'That fund could not be found');
      const cashId =
        fund.assetAccountId ??
        (await this.ledger.accountByCode(tx, '1000'))?.id;
      const revenueId =
        fund.revenueAccountId ??
        (await this.ledger.accountByCode(tx, fund.restricted ? '4100' : '4000'))?.id;
      if (!cashId || !revenueId) {
        throw new DomainError('ACCOUNT_NOT_FOUND', 'The chart of accounts is missing cash or revenue accounts');
      }
      const journal = await this.ledger.writeJournal(
        tx,
        tenantId,
        actorUserId,
        {
          memo: `Giving: ${fund.name}`,
          occurredOn: input.receivedOn,
          source: 'GIVING',
          reference: input.externalRef,
          lines: [
            { accountId: cashId, debitMinor: input.amountMinor, creditMinor: 0, fundId: fund.id },
            { accountId: revenueId, debitMinor: 0, creditMinor: input.amountMinor, fundId: fund.id },
          ],
        },
        receivedOn,
        true,
      );
      const created = await tx.contribution.create({
        data: {
          tenantId,
          memberId: input.memberId ?? null,
          donorName: input.donorName ?? null,
          fundId: fund.id,
          amountMinor: BigInt(input.amountMinor),
          currency: input.currency,
          method: input.method,
          status: 'POSTED',
          receivedOn,
          externalRef: input.externalRef ?? null,
          note: input.note ?? null,
          taxDeductible: input.taxDeductible,
          journalId: journal.id,
        },
        include: { fund: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.contribution.recorded',
          resourceType: 'contribution',
          resourceId: created.id,
          metadata: { amountMinor: input.amountMinor, fundId: fund.id },
        },
        tx,
      );
      return created;
    });
    return this.toContribution(row);
  }

  async listContributions(tenantId: string, query: ContributionListQuery): Promise<ContributionPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.ContributionWhereInput = {};
      if (query.memberId) where.memberId = query.memberId;
      if (query.fundId) where.fundId = query.fundId;
      if (query.status) where.status = query.status;
      if (query.from || query.to) {
        where.receivedOn = {};
        if (query.from) where.receivedOn.gte = requiredDate(query.from);
        if (query.to) where.receivedOn.lte = requiredDate(query.to);
      }
      if (query.search) {
        where.OR = [
          { donorName: { contains: query.search, mode: 'insensitive' } },
          { note: { contains: query.search, mode: 'insensitive' } },
          { externalRef: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      const [items, total] = await Promise.all([
        tx.contribution.findMany({
          where,
          include: { fund: true },
          orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
          ...pageArgs(query),
        }),
        tx.contribution.count({ where }),
      ]);
      return {
        items: items.map((row) => this.toContribution(row)),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async getContribution(tenantId: string, id: string): Promise<Contribution> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.contribution.findFirst({ where: { id }, include: { fund: true } }),
    );
    if (!row) throw new DomainError('CONTRIBUTION_NOT_FOUND', 'That contribution could not be found');
    return this.toContribution(row);
  }

  async refundContribution(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: ContributionRefundRequest,
  ): Promise<Contribution> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.contribution.findFirst({ where: { id }, include: { fund: true } });
      if (!existing) throw new DomainError('CONTRIBUTION_NOT_FOUND', 'That contribution could not be found');
      if (existing.status !== 'POSTED') {
        throw new DomainError('CONTRIBUTION_NOT_REFUNDABLE', 'Only a posted contribution can be refunded');
      }
      const cashId =
        existing.fund.assetAccountId ?? (await this.ledger.accountByCode(tx, '1000'))?.id;
      const revenueId =
        existing.fund.revenueAccountId ?? (await this.ledger.accountByCode(tx, '4000'))?.id;
      if (!cashId || !revenueId) {
        throw new DomainError('ACCOUNT_NOT_FOUND', 'The chart of accounts is missing cash or revenue accounts');
      }
      const amount = toMinor(existing.amountMinor);
      const journal = await this.ledger.writeJournal(
        tx,
        tenantId,
        actorUserId,
        {
          memo: `Refund: ${existing.fund.name}`,
          occurredOn: toDateOnly(existing.receivedOn)!,
          source: 'GIVING',
          reference: input.reason,
          lines: [
            { accountId: revenueId, debitMinor: amount, creditMinor: 0, fundId: existing.fundId },
            { accountId: cashId, debitMinor: 0, creditMinor: amount, fundId: existing.fundId },
          ],
        },
        existing.receivedOn,
        true,
      );
      await tx.contribution.update({
        where: { id },
        data: { status: 'REFUNDED' },
      });
      const refund = await tx.contribution.create({
        data: {
          tenantId,
          memberId: existing.memberId,
          donorName: existing.donorName,
          fundId: existing.fundId,
          amountMinor: existing.amountMinor,
          currency: existing.currency,
          method: existing.method,
          status: 'REFUNDED',
          receivedOn: existing.receivedOn,
          note: input.reason,
          taxDeductible: existing.taxDeductible,
          journalId: journal.id,
          refundOfId: existing.id,
        },
        include: { fund: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.contribution.refunded',
          resourceType: 'contribution',
          resourceId: existing.id,
          metadata: { reason: input.reason, refundId: refund.id },
        },
        tx,
      );
      return refund;
    });
    return this.toContribution(row);
  }

  private toFund(row: {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    restricted: boolean;
    status: Fund['status'];
    revenueAccountId: string | null;
    assetAccountId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Fund {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      restricted: row.restricted,
      status: row.status,
      revenueAccountId: row.revenueAccountId,
      assetAccountId: row.assetAccountId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toContribution(row: {
    id: string;
    tenantId: string;
    memberId: string | null;
    donorName: string | null;
    fundId: string;
    fund: { name: string };
    amountMinor: bigint;
    currency: string;
    method: Contribution['method'];
    status: Contribution['status'];
    receivedOn: Date;
    externalRef: string | null;
    note: string | null;
    taxDeductible: boolean;
    journalId: string | null;
    refundOfId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Contribution {
    return {
      id: row.id,
      tenantId: row.tenantId,
      memberId: row.memberId,
      donorName: row.donorName,
      fundId: row.fundId,
      fundName: row.fund.name,
      amountMinor: toMinor(row.amountMinor),
      currency: row.currency,
      method: row.method,
      status: row.status,
      receivedOn: toDateOnly(row.receivedOn)!,
      externalRef: row.externalRef,
      note: row.note,
      taxDeductible: row.taxDeductible,
      journalId: row.journalId,
      refundOfId: row.refundOfId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
