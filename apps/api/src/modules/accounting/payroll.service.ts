import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountType,
  type PayrollEmployee,
  type PayrollEmployeeCreateRequest,
  type PayrollEmployeeListQuery,
  type PayrollEmployeePage,
  type PayrollEmployeeUpdateRequest,
  type PayrollRun,
  type PayrollRunCreateRequest,
  type PayrollRunListQuery,
  type PayrollRunPage,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { pageArgs, requiredDate, toDateOnly, toMinor } from './accounting.utils';
import { LedgerService } from './ledger.service';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async createEmployee(
    tenantId: string,
    actorUserId: string,
    input: PayrollEmployeeCreateRequest,
  ): Promise<PayrollEmployee> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      if (input.expenseAccountId) await this.ledger.requireAccount(tx, input.expenseAccountId, AccountType.EXPENSE);
      if (input.liabilityAccountId) {
        await this.ledger.requireAccount(tx, input.liabilityAccountId, AccountType.LIABILITY);
      }
      const created = await tx.payrollEmployee.create({
        data: {
          tenantId,
          memberId: input.memberId ?? null,
          displayName: input.displayName,
          title: input.title ?? null,
          payFrequency: input.payFrequency,
          grossMinor: BigInt(input.grossMinor),
          expenseAccountId: input.expenseAccountId ?? (await this.ledger.accountByCode(tx, '5100'))?.id ?? null,
          liabilityAccountId: input.liabilityAccountId ?? (await this.ledger.accountByCode(tx, '2100'))?.id ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.payroll.employee.created',
          resourceType: 'payroll_employee',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toEmployee(row);
  }

  async listEmployees(tenantId: string, query: PayrollEmployeeListQuery): Promise<PayrollEmployeePage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.PayrollEmployeeWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.search) where.displayName = { contains: query.search, mode: 'insensitive' };
      const [items, total] = await Promise.all([
        tx.payrollEmployee.findMany({ where, orderBy: { displayName: 'asc' }, ...pageArgs(query) }),
        tx.payrollEmployee.count({ where }),
      ]);
      return { items: items.map((row) => this.toEmployee(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getEmployee(tenantId: string, id: string): Promise<PayrollEmployee> {
    const row = await this.prisma.withTenant(tenantId, (tx) => tx.payrollEmployee.findFirst({ where: { id } }));
    if (!row) throw new DomainError('PAYROLL_EMPLOYEE_NOT_FOUND', 'That employee could not be found');
    return this.toEmployee(row);
  }

  async updateEmployee(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: PayrollEmployeeUpdateRequest,
  ): Promise<PayrollEmployee> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.payrollEmployee.findFirst({ where: { id } });
      if (!existing) throw new DomainError('PAYROLL_EMPLOYEE_NOT_FOUND', 'That employee could not be found');
      const updated = await tx.payrollEmployee.update({
        where: { id },
        data: {
          displayName: input.displayName ?? undefined,
          title: input.title === undefined ? undefined : input.title,
          payFrequency: input.payFrequency ?? undefined,
          grossMinor: input.grossMinor === undefined ? undefined : BigInt(input.grossMinor),
          expenseAccountId: input.expenseAccountId === undefined ? undefined : input.expenseAccountId,
          liabilityAccountId: input.liabilityAccountId === undefined ? undefined : input.liabilityAccountId,
          status: input.status ?? undefined,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.payroll.employee.updated',
          resourceType: 'payroll_employee',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toEmployee(row);
  }

  async createRun(
    tenantId: string,
    actorUserId: string,
    input: PayrollRunCreateRequest,
  ): Promise<PayrollRun> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const employees = await tx.payrollEmployee.findMany({ where: { status: 'ACTIVE' } });
      if (employees.length === 0) {
        throw new DomainError('PAYROLL_RUN_EMPTY', 'There are no active employees to pay');
      }
      const created = await tx.payrollRun.create({
        data: {
          tenantId,
          periodStart: requiredDate(input.periodStart),
          periodEnd: requiredDate(input.periodEnd),
          payOn: requiredDate(input.payOn),
          memo: input.memo ?? null,
          items: {
            create: employees.map((employee) => {
              const gross = toMinor(employee.grossMinor);
              const tax = Math.floor(gross * 0.1);
              return {
                tenantId,
                employeeId: employee.id,
                grossMinor: BigInt(gross),
                taxMinor: BigInt(tax),
                netMinor: BigInt(gross - tax),
              };
            }),
          },
        },
        include: { items: { include: { employee: true } } },
      });
      const grossMinor = created.items.reduce((sum, item) => sum + toMinor(item.grossMinor), 0);
      const taxMinor = created.items.reduce((sum, item) => sum + toMinor(item.taxMinor), 0);
      const netMinor = created.items.reduce((sum, item) => sum + toMinor(item.netMinor), 0);
      const updated = await tx.payrollRun.update({
        where: { id: created.id },
        data: { grossMinor: BigInt(grossMinor), taxMinor: BigInt(taxMinor), netMinor: BigInt(netMinor) },
        include: { items: { include: { employee: true } } },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.payroll.run.created',
          resourceType: 'payroll_run',
          resourceId: created.id,
        },
        tx,
      );
      return updated;
    });
    return this.toRun(row);
  }

  async listRuns(tenantId: string, query: PayrollRunListQuery): Promise<PayrollRunPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.PayrollRunWhereInput = {};
      if (query.status) where.status = query.status;
      const [items, total] = await Promise.all([
        tx.payrollRun.findMany({
          where,
          orderBy: { payOn: 'desc' },
          ...pageArgs(query),
        }),
        tx.payrollRun.count({ where }),
      ]);
      return {
        items: items.map((row) => this.toRunSummary(row)),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async getRun(tenantId: string, id: string): Promise<PayrollRun> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.payrollRun.findFirst({ where: { id }, include: { items: { include: { employee: true } } } }),
    );
    if (!row) throw new DomainError('PAYROLL_RUN_NOT_FOUND', 'That payroll run could not be found');
    return this.toRun(row);
  }

  async approveRun(tenantId: string, actorUserId: string, id: string): Promise<PayrollRun> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.payrollRun.findFirst({
        where: { id },
        include: { items: { include: { employee: true } } },
      });
      if (!existing) throw new DomainError('PAYROLL_RUN_NOT_FOUND', 'That payroll run could not be found');
      if (existing.status !== 'DRAFT') {
        throw new DomainError('PAYROLL_RUN_NOT_POSTABLE', 'Only a draft run can be approved');
      }
      const updated = await tx.payrollRun.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { items: { include: { employee: true } } },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.payroll.run.approved',
          resourceType: 'payroll_run',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toRun(row);
  }

  async postRun(tenantId: string, actorUserId: string, id: string): Promise<PayrollRun> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.payrollRun.findFirst({
        where: { id },
        include: { items: { include: { employee: true } } },
      });
      if (!existing) throw new DomainError('PAYROLL_RUN_NOT_FOUND', 'That payroll run could not be found');
      if (existing.status !== 'APPROVED') {
        throw new DomainError('PAYROLL_RUN_NOT_POSTABLE', 'A payroll run must be approved before it is posted');
      }
      const expense =
        existing.items[0]?.employee.expenseAccountId ??
        (await this.ledger.accountByCode(tx, '5100'))?.id;
      const liability =
        existing.items[0]?.employee.liabilityAccountId ??
        (await this.ledger.accountByCode(tx, '2100'))?.id;
      const cash = (await this.ledger.accountByCode(tx, '1000'))?.id;
      if (!expense || !liability || !cash) {
        throw new DomainError('ACCOUNT_NOT_FOUND', 'Payroll posting accounts are not configured');
      }
      const gross = toMinor(existing.grossMinor);
      const tax = toMinor(existing.taxMinor);
      const net = toMinor(existing.netMinor);
      const journal = await this.ledger.writeJournal(
        tx,
        tenantId,
        actorUserId,
        {
          memo: existing.memo ?? 'Payroll',
          occurredOn: toDateOnly(existing.payOn)!,
          source: 'PAYROLL',
          lines: [
            { accountId: expense, debitMinor: gross, creditMinor: 0 },
            { accountId: cash, debitMinor: 0, creditMinor: net },
            { accountId: liability, debitMinor: 0, creditMinor: tax },
          ],
        },
        existing.payOn,
        true,
      );
      const updated = await tx.payrollRun.update({
        where: { id },
        data: { status: 'POSTED', journalId: journal.id },
        include: { items: { include: { employee: true } } },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.payroll.run.posted',
          resourceType: 'payroll_run',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toRun(row);
  }

  private toEmployee(row: {
    id: string;
    tenantId: string;
    memberId: string | null;
    displayName: string;
    title: string | null;
    payFrequency: PayrollEmployee['payFrequency'];
    grossMinor: bigint;
    status: PayrollEmployee['status'];
    expenseAccountId: string | null;
    liabilityAccountId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PayrollEmployee {
    return {
      id: row.id,
      tenantId: row.tenantId,
      memberId: row.memberId,
      displayName: row.displayName,
      title: row.title,
      payFrequency: row.payFrequency,
      grossMinor: toMinor(row.grossMinor),
      status: row.status,
      expenseAccountId: row.expenseAccountId,
      liabilityAccountId: row.liabilityAccountId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toRunSummary(row: {
    id: string;
    tenantId: string;
    periodStart: Date;
    periodEnd: Date;
    payOn: Date;
    memo: string | null;
    status: PayrollRun['status'];
    grossMinor: bigint;
    taxMinor: bigint;
    netMinor: bigint;
    journalId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      periodStart: toDateOnly(row.periodStart)!,
      periodEnd: toDateOnly(row.periodEnd)!,
      payOn: toDateOnly(row.payOn)!,
      memo: row.memo,
      status: row.status,
      grossMinor: toMinor(row.grossMinor),
      taxMinor: toMinor(row.taxMinor),
      netMinor: toMinor(row.netMinor),
      journalId: row.journalId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toRun(row: {
    id: string;
    tenantId: string;
    periodStart: Date;
    periodEnd: Date;
    payOn: Date;
    memo: string | null;
    status: PayrollRun['status'];
    grossMinor: bigint;
    taxMinor: bigint;
    netMinor: bigint;
    journalId: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      employeeId: string;
      employee: { displayName: string };
      grossMinor: bigint;
      taxMinor: bigint;
      netMinor: bigint;
    }>;
  }): PayrollRun {
    return {
      ...this.toRunSummary(row),
      items: row.items.map((item) => ({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: item.employee.displayName,
        grossMinor: toMinor(item.grossMinor),
        taxMinor: toMinor(item.taxMinor),
        netMinor: toMinor(item.netMinor),
      })),
    };
  }
}
