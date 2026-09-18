import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountType,
  type BankAccount,
  type BankAccountCreateRequest,
  type BankAccountListQuery,
  type BankAccountPage,
  type BankTransaction,
  type BankTransactionCreateRequest,
  type BankTransactionListQuery,
  type BankTransactionPage,
  type Reconciliation,
  type ReconciliationCreateRequest,
  type ReconciliationListQuery,
  type ReconciliationMatchRequest,
  type ReconciliationPage,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { pageArgs, requiredDate, signedBalance, toDateOnly, toMinor } from './accounting.utils';
import { LedgerService } from './ledger.service';

@Injectable()
export class ReconService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async createBankAccount(
    tenantId: string,
    actorUserId: string,
    input: BankAccountCreateRequest,
  ): Promise<BankAccount> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const gl = await this.ledger.requireAccount(tx, input.glAccountId, AccountType.ASSET);
      const created = await tx.bankAccount.create({
        data: {
          tenantId,
          name: input.name,
          institution: input.institution ?? null,
          accountNumberMasked: input.accountNumberMasked ?? null,
          glAccountId: gl.id,
        },
        include: { glAccount: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.bank_account.created',
          resourceType: 'bank_account',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toBankAccount(row);
  }

  async listBankAccounts(tenantId: string, query: BankAccountListQuery): Promise<BankAccountPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.BankAccountWhereInput = {};
      if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
      const [items, total] = await Promise.all([
        tx.bankAccount.findMany({
          where,
          include: { glAccount: true },
          orderBy: { name: 'asc' },
          ...pageArgs(query),
        }),
        tx.bankAccount.count({ where }),
      ]);
      return { items: items.map((row) => this.toBankAccount(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getBankAccount(tenantId: string, id: string): Promise<BankAccount> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.bankAccount.findFirst({ where: { id }, include: { glAccount: true } }),
    );
    if (!row) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
    return this.toBankAccount(row);
  }

  async addTransaction(
    tenantId: string,
    actorUserId: string,
    bankAccountId: string,
    input: BankTransactionCreateRequest,
  ): Promise<BankTransaction> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.bankAccount.findFirst({ where: { id: bankAccountId } });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      const created = await tx.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          occurredOn: requiredDate(input.occurredOn),
          amountMinor: BigInt(input.amountMinor),
          kind: input.kind,
          description: input.description,
          externalRef: input.externalRef ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.bank_transaction.created',
          resourceType: 'bank_transaction',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toBankTransaction(row);
  }

  async listTransactions(
    tenantId: string,
    bankAccountId: string,
    query: BankTransactionListQuery,
  ): Promise<BankTransactionPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.bankAccount.findFirst({ where: { id: bankAccountId } });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      const where: Prisma.BankTransactionWhereInput = { bankAccountId };
      if (query.unmatchedOnly) where.matchedJournalId = null;
      if (query.from || query.to) {
        where.occurredOn = {};
        if (query.from) where.occurredOn.gte = requiredDate(query.from);
        if (query.to) where.occurredOn.lte = requiredDate(query.to);
      }
      const [items, total] = await Promise.all([
        tx.bankTransaction.findMany({
          where,
          orderBy: { occurredOn: 'desc' },
          ...pageArgs(query),
        }),
        tx.bankTransaction.count({ where }),
      ]);
      return {
        items: items.map((row) => this.toBankTransaction(row)),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async createReconciliation(
    tenantId: string,
    actorUserId: string,
    bankAccountId: string,
    input: ReconciliationCreateRequest,
  ): Promise<Reconciliation> {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.bankAccount.findFirst({
        where: { id: bankAccountId },
        include: { glAccount: true },
      });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      const created = await tx.bankReconciliation.create({
        data: {
          tenantId,
          bankAccountId,
          statementOn: requiredDate(input.statementOn),
          statementBalanceMinor: BigInt(input.statementBalanceMinor),
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.reconciliation.created',
          resourceType: 'bank_reconciliation',
          resourceId: created.id,
        },
        tx,
      );
      return { created, account };
    });
    return this.toReconciliation(tenantId, result.created, result.account);
  }

  async listReconciliations(
    tenantId: string,
    bankAccountId: string,
    query: ReconciliationListQuery,
  ): Promise<ReconciliationPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.bankAccount.findFirst({
        where: { id: bankAccountId },
        include: { glAccount: true },
      });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      const where: Prisma.BankReconciliationWhereInput = { bankAccountId };
      if (query.status) where.status = query.status;
      const [items, total] = await Promise.all([
        tx.bankReconciliation.findMany({
          where,
          orderBy: { statementOn: 'desc' },
          ...pageArgs(query),
        }),
        tx.bankReconciliation.count({ where }),
      ]);
      const mapped = [];
      for (const row of items) {
        mapped.push(await this.enrich(tx, row, account));
      }
      return { items: mapped, total, limit: query.limit, offset: query.offset };
    });
  }

  async getReconciliation(tenantId: string, id: string): Promise<Reconciliation> {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const row = await tx.bankReconciliation.findFirst({ where: { id } });
      if (!row) throw new DomainError('RECONCILIATION_NOT_FOUND', 'That reconciliation could not be found');
      const account = await tx.bankAccount.findFirst({
        where: { id: row.bankAccountId },
        include: { glAccount: true },
      });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      return { row, account, enriched: await this.enrich(tx, row, account) };
    });
    return result.enriched;
  }

  async match(
    tenantId: string,
    actorUserId: string,
    reconciliationId: string,
    input: ReconciliationMatchRequest,
  ): Promise<Reconciliation> {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const recon = await tx.bankReconciliation.findFirst({ where: { id: reconciliationId } });
      if (!recon) throw new DomainError('RECONCILIATION_NOT_FOUND', 'That reconciliation could not be found');
      if (recon.status === 'COMPLETED') {
        throw new DomainError('RECONCILIATION_ALREADY_COMPLETED', 'That reconciliation is already completed');
      }
      const txn = await tx.bankTransaction.findFirst({ where: { id: input.bankTransactionId } });
      if (!txn || txn.bankAccountId !== recon.bankAccountId) {
        throw new DomainError('BANK_TRANSACTION_NOT_FOUND', 'That bank transaction could not be found');
      }
      const journal = await tx.journal.findFirst({ where: { id: input.journalId } });
      if (!journal || journal.status !== 'POSTED') {
        throw new DomainError('JOURNAL_NOT_FOUND', 'That posted journal could not be found');
      }
      await tx.bankTransaction.update({
        where: { id: txn.id },
        data: { matchedJournalId: journal.id },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.reconciliation.matched',
          resourceType: 'bank_reconciliation',
          resourceId: recon.id,
          metadata: { bankTransactionId: txn.id, journalId: journal.id },
        },
        tx,
      );
      const account = await tx.bankAccount.findFirst({
        where: { id: recon.bankAccountId },
        include: { glAccount: true },
      });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      return { recon, account, enriched: await this.enrich(tx, recon, account) };
    });
    return result.enriched;
  }

  async complete(tenantId: string, actorUserId: string, id: string): Promise<Reconciliation> {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const recon = await tx.bankReconciliation.findFirst({ where: { id } });
      if (!recon) throw new DomainError('RECONCILIATION_NOT_FOUND', 'That reconciliation could not be found');
      if (recon.status === 'COMPLETED') {
        throw new DomainError('RECONCILIATION_ALREADY_COMPLETED', 'That reconciliation is already completed');
      }
      const account = await tx.bankAccount.findFirst({
        where: { id: recon.bankAccountId },
        include: { glAccount: true },
      });
      if (!account) throw new DomainError('BANK_ACCOUNT_NOT_FOUND', 'That bank account could not be found');
      const snapshot = await this.enrich(tx, recon, account);
      if (snapshot.differenceMinor !== 0) {
        throw new DomainError(
          'RECONCILIATION_UNBALANCED',
          'The statement balance does not match the book balance',
        );
      }
      const updated = await tx.bankReconciliation.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.reconciliation.completed',
          resourceType: 'bank_reconciliation',
          resourceId: id,
        },
        tx,
      );
      return { updated, account, enriched: await this.enrich(tx, updated, account) };
    });
    return result.enriched;
  }

  private async toReconciliation(
    tenantId: string,
    row: {
      id: string;
      tenantId: string;
      bankAccountId: string;
      statementOn: Date;
      statementBalanceMinor: bigint;
      status: Reconciliation['status'];
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    account: { name: string; glAccountId: string; glAccount: { type: AccountType } },
  ): Promise<Reconciliation> {
    return this.prisma.withTenant(tenantId, (tx) => this.enrich(tx, row, account));
  }

  private async enrich(
    tx: Prisma.TransactionClient,
    row: {
      id: string;
      tenantId: string;
      bankAccountId: string;
      statementOn: Date;
      statementBalanceMinor: bigint;
      status: Reconciliation['status'];
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    account: { name: string; glAccountId: string; glAccount: { type: AccountType } },
  ): Promise<Reconciliation> {
    const totals = await tx.journalLine.aggregate({
      where: {
        accountId: account.glAccountId,
        journal: { status: 'POSTED', occurredOn: { lte: row.statementOn } },
      },
      _sum: { debitMinor: true, creditMinor: true },
    });
    const bookBalanceMinor = signedBalance(
      account.glAccount.type,
      toMinor(totals._sum.debitMinor ?? 0n),
      toMinor(totals._sum.creditMinor ?? 0n),
    );
    const statementBalanceMinor = toMinor(row.statementBalanceMinor);
    const [matchedCount, unmatchedCount] = await Promise.all([
      tx.bankTransaction.count({
        where: { bankAccountId: row.bankAccountId, matchedJournalId: { not: null } },
      }),
      tx.bankTransaction.count({
        where: { bankAccountId: row.bankAccountId, matchedJournalId: null },
      }),
    ]);
    return {
      id: row.id,
      tenantId: row.tenantId,
      bankAccountId: row.bankAccountId,
      bankAccountName: account.name,
      statementOn: toDateOnly(row.statementOn)!,
      statementBalanceMinor,
      bookBalanceMinor,
      differenceMinor: statementBalanceMinor - bookBalanceMinor,
      status: row.status,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      matchedCount,
      unmatchedCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBankAccount(row: {
    id: string;
    tenantId: string;
    name: string;
    institution: string | null;
    accountNumberMasked: string | null;
    glAccountId: string;
    glAccount: { code: string; name: string };
    createdAt: Date;
    updatedAt: Date;
  }): BankAccount {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      institution: row.institution,
      accountNumberMasked: row.accountNumberMasked,
      glAccountId: row.glAccountId,
      glAccountCode: row.glAccount.code,
      glAccountName: row.glAccount.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBankTransaction(row: {
    id: string;
    tenantId: string;
    bankAccountId: string;
    occurredOn: Date;
    amountMinor: bigint;
    kind: BankTransaction['kind'];
    description: string;
    externalRef: string | null;
    matchedJournalId: string | null;
    createdAt: Date;
  }): BankTransaction {
    return {
      id: row.id,
      tenantId: row.tenantId,
      bankAccountId: row.bankAccountId,
      occurredOn: toDateOnly(row.occurredOn)!,
      amountMinor: toMinor(row.amountMinor),
      kind: row.kind,
      description: row.description,
      externalRef: row.externalRef,
      matchedJournalId: row.matchedJournalId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
