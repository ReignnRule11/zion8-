import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AccountType,
  type Bill,
  type BillCreateRequest,
  type BillListQuery,
  type BillPage,
  type Expense,
  type ExpenseCreateRequest,
  type ExpenseDecisionRequest,
  type ExpenseListQuery,
  type ExpensePage,
  type PurchaseOrder,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderListQuery,
  type PurchaseOrderPage,
  type Vendor,
  type VendorCreateRequest,
  type VendorListQuery,
  type VendorPage,
  type VendorUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { nextNumber, pageArgs, parseDateOnly, requiredDate, toDateOnly, toMinor } from './accounting.utils';
import { LedgerService } from './ledger.service';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async createVendor(tenantId: string, actorUserId: string, input: VendorCreateRequest): Promise<Vendor> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const created = await tx.vendor.create({
        data: {
          tenantId,
          name: input.name,
          contactName: input.contactName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.vendor.created',
          resourceType: 'vendor',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toVendor(row);
  }

  async listVendors(tenantId: string, query: VendorListQuery): Promise<VendorPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.VendorWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
      const [items, total] = await Promise.all([
        tx.vendor.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
        tx.vendor.count({ where }),
      ]);
      return { items: items.map((row) => this.toVendor(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getVendor(tenantId: string, id: string): Promise<Vendor> {
    const row = await this.prisma.withTenant(tenantId, (tx) => tx.vendor.findFirst({ where: { id } }));
    if (!row) throw new DomainError('VENDOR_NOT_FOUND', 'That vendor could not be found');
    return this.toVendor(row);
  }

  async updateVendor(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: VendorUpdateRequest,
  ): Promise<Vendor> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.vendor.findFirst({ where: { id } });
      if (!existing) throw new DomainError('VENDOR_NOT_FOUND', 'That vendor could not be found');
      const updated = await tx.vendor.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          contactName: input.contactName === undefined ? undefined : input.contactName,
          email: input.email === undefined ? undefined : input.email,
          phone: input.phone === undefined ? undefined : input.phone,
          notes: input.notes === undefined ? undefined : input.notes,
          status: input.status ?? undefined,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.vendor.updated',
          resourceType: 'vendor',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toVendor(row);
  }

  async createPurchaseOrder(
    tenantId: string,
    actorUserId: string,
    input: PurchaseOrderCreateRequest,
  ): Promise<PurchaseOrder> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: input.vendorId } });
      if (!vendor) throw new DomainError('VENDOR_NOT_FOUND', 'That vendor could not be found');
      if (input.projectId) {
        const project = await tx.financeProject.findFirst({ where: { id: input.projectId } });
        if (!project) throw new DomainError('PROJECT_NOT_FOUND', 'That project could not be found');
      }
      const max = await tx.purchaseOrder.aggregate({ _max: { number: true } });
      const created = await tx.purchaseOrder.create({
        data: {
          tenantId,
          number: nextNumber(max._max.number),
          vendorId: vendor.id,
          orderedOn: requiredDate(input.orderedOn),
          expectedOn: parseDateOnly(input.expectedOn),
          memo: input.memo ?? null,
          projectId: input.projectId ?? null,
          lines: {
            create: input.lines.map((line) => ({
              tenantId,
              description: line.description,
              quantity: line.quantity,
              unitCostMinor: BigInt(line.unitCostMinor),
              accountId: line.accountId ?? null,
            })),
          },
        },
        include: { vendor: true, lines: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.purchase_order.created',
          resourceType: 'purchase_order',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toPurchaseOrder(row);
  }

  async listPurchaseOrders(tenantId: string, query: PurchaseOrderListQuery): Promise<PurchaseOrderPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.PurchaseOrderWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.vendorId) where.vendorId = query.vendorId;
      const [items, total] = await Promise.all([
        tx.purchaseOrder.findMany({
          where,
          include: { vendor: true, lines: true },
          orderBy: { number: 'desc' },
          ...pageArgs(query),
        }),
        tx.purchaseOrder.count({ where }),
      ]);
      return {
        items: items.map((row) => this.toPurchaseOrderSummary(row)),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async getPurchaseOrder(tenantId: string, id: string): Promise<PurchaseOrder> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.purchaseOrder.findFirst({ where: { id }, include: { vendor: true, lines: true } }),
    );
    if (!row) throw new DomainError('PURCHASE_ORDER_NOT_FOUND', 'That purchase order could not be found');
    return this.toPurchaseOrder(row);
  }

  async submitPurchaseOrder(tenantId: string, actorUserId: string, id: string): Promise<PurchaseOrder> {
    return this.transitionPurchaseOrder(tenantId, actorUserId, id, 'DRAFT', 'SUBMITTED', 'submitted');
  }

  async approvePurchaseOrder(tenantId: string, actorUserId: string, id: string): Promise<PurchaseOrder> {
    return this.transitionPurchaseOrder(tenantId, actorUserId, id, 'SUBMITTED', 'APPROVED', 'approved');
  }

  async createBill(tenantId: string, actorUserId: string, input: BillCreateRequest): Promise<Bill> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: input.vendorId } });
      if (!vendor) throw new DomainError('VENDOR_NOT_FOUND', 'That vendor could not be found');
      await this.ledger.requireAccount(tx, input.expenseAccountId, AccountType.EXPENSE);
      if (input.purchaseOrderId) {
        const po = await tx.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId } });
        if (!po) throw new DomainError('PURCHASE_ORDER_NOT_FOUND', 'That purchase order could not be found');
      }
      const max = await tx.bill.aggregate({ _max: { number: true } });
      const created = await tx.bill.create({
        data: {
          tenantId,
          number: nextNumber(max._max.number),
          vendorId: vendor.id,
          purchaseOrderId: input.purchaseOrderId ?? null,
          billedOn: requiredDate(input.billedOn),
          dueOn: parseDateOnly(input.dueOn),
          memo: input.memo ?? null,
          expenseAccountId: input.expenseAccountId,
          amountMinor: BigInt(input.amountMinor),
          projectId: input.projectId ?? null,
        },
        include: { vendor: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.bill.created',
          resourceType: 'bill',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toBill(row);
  }

  async listBills(tenantId: string, query: BillListQuery): Promise<BillPage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.BillWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.vendorId) where.vendorId = query.vendorId;
      const [items, total] = await Promise.all([
        tx.bill.findMany({
          where,
          include: { vendor: true },
          orderBy: { number: 'desc' },
          ...pageArgs(query),
        }),
        tx.bill.count({ where }),
      ]);
      return { items: items.map((row) => this.toBill(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getBill(tenantId: string, id: string): Promise<Bill> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.bill.findFirst({ where: { id }, include: { vendor: true } }),
    );
    if (!row) throw new DomainError('BILL_NOT_FOUND', 'That bill could not be found');
    return this.toBill(row);
  }

  async approveBill(tenantId: string, actorUserId: string, id: string): Promise<Bill> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.bill.findFirst({ where: { id }, include: { vendor: true } });
      if (!existing) throw new DomainError('BILL_NOT_FOUND', 'That bill could not be found');
      if (existing.status !== 'DRAFT') {
        throw new DomainError('BILL_NOT_POSTABLE', 'Only a draft bill can be approved');
      }
      const updated = await tx.bill.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { vendor: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.bill.approved',
          resourceType: 'bill',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toBill(row);
  }

  async postBill(tenantId: string, actorUserId: string, id: string): Promise<Bill> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.bill.findFirst({ where: { id }, include: { vendor: true } });
      if (!existing) throw new DomainError('BILL_NOT_FOUND', 'That bill could not be found');
      if (existing.status !== 'APPROVED') {
        throw new DomainError('BILL_NOT_POSTABLE', 'A bill must be approved before it is posted');
      }
      const payable = (await this.ledger.accountByCode(tx, '2000'))?.id;
      if (!payable) throw new DomainError('ACCOUNT_NOT_FOUND', 'Accounts payable is not configured');
      const amount = toMinor(existing.amountMinor);
      const journal = await this.ledger.writeJournal(
        tx,
        tenantId,
        actorUserId,
        {
          memo: existing.memo ?? `Bill ${existing.number}`,
          occurredOn: toDateOnly(existing.billedOn)!,
          source: 'PROCUREMENT',
          lines: [
            {
              accountId: existing.expenseAccountId,
              debitMinor: amount,
              creditMinor: 0,
              projectId: existing.projectId ?? undefined,
            },
            { accountId: payable, debitMinor: 0, creditMinor: amount },
          ],
        },
        existing.billedOn,
        true,
      );
      const updated = await tx.bill.update({
        where: { id },
        data: { status: 'POSTED', journalId: journal.id },
        include: { vendor: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.bill.posted',
          resourceType: 'bill',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toBill(row);
  }

  async createExpense(
    tenantId: string,
    actorUserId: string,
    input: ExpenseCreateRequest,
  ): Promise<Expense> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      await this.ledger.requireAccount(tx, input.expenseAccountId, AccountType.EXPENSE);
      const created = await tx.expenseClaim.create({
        data: {
          tenantId,
          memberId: input.memberId ?? null,
          submitterName: input.submitterName ?? null,
          incurredOn: requiredDate(input.incurredOn),
          amountMinor: BigInt(input.amountMinor),
          merchant: input.merchant ?? null,
          memo: input.memo,
          expenseAccountId: input.expenseAccountId,
          projectId: input.projectId ?? null,
          departmentId: input.departmentId ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.expense.created',
          resourceType: 'expense_claim',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return this.toExpense(row);
  }

  async listExpenses(tenantId: string, query: ExpenseListQuery): Promise<ExpensePage> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.ExpenseClaimWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.memberId) where.memberId = query.memberId;
      const [items, total] = await Promise.all([
        tx.expenseClaim.findMany({
          where,
          orderBy: { incurredOn: 'desc' },
          ...pageArgs(query),
        }),
        tx.expenseClaim.count({ where }),
      ]);
      return { items: items.map((row) => this.toExpense(row)), total, limit: query.limit, offset: query.offset };
    });
  }

  async getExpense(tenantId: string, id: string): Promise<Expense> {
    const row = await this.prisma.withTenant(tenantId, (tx) => tx.expenseClaim.findFirst({ where: { id } }));
    if (!row) throw new DomainError('EXPENSE_NOT_FOUND', 'That expense could not be found');
    return this.toExpense(row);
  }

  async submitExpense(tenantId: string, actorUserId: string, id: string): Promise<Expense> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.expenseClaim.findFirst({ where: { id } });
      if (!existing) throw new DomainError('EXPENSE_NOT_FOUND', 'That expense could not be found');
      if (existing.status !== 'DRAFT') {
        throw new DomainError('EXPENSE_NOT_APPROVABLE', 'Only a draft expense can be submitted');
      }
      const updated = await tx.expenseClaim.update({ where: { id }, data: { status: 'SUBMITTED' } });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.expense.submitted',
          resourceType: 'expense_claim',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toExpense(row);
  }

  async decideExpense(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: ExpenseDecisionRequest,
  ): Promise<Expense> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.expenseClaim.findFirst({ where: { id } });
      if (!existing) throw new DomainError('EXPENSE_NOT_FOUND', 'That expense could not be found');
      if (existing.status !== 'SUBMITTED') {
        throw new DomainError('EXPENSE_NOT_APPROVABLE', 'Only a submitted expense can be decided');
      }
      const updated = await tx.expenseClaim.update({
        where: { id },
        data: {
          status: input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          decidedByUserId: actorUserId,
          decidedAt: new Date(),
          decisionNote: input.note ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: `accounting.expense.${input.decision.toLowerCase()}`,
          resourceType: 'expense_claim',
          resourceId: id,
          metadata: { note: input.note ?? null },
        },
        tx,
      );
      return updated;
    });
    return this.toExpense(row);
  }

  async postExpense(tenantId: string, actorUserId: string, id: string): Promise<Expense> {
    await this.ledger.ensureChart(tenantId, actorUserId);
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.expenseClaim.findFirst({ where: { id } });
      if (!existing) throw new DomainError('EXPENSE_NOT_FOUND', 'That expense could not be found');
      if (existing.status !== 'APPROVED') {
        throw new DomainError('EXPENSE_NOT_APPROVABLE', 'An expense must be approved before it is posted');
      }
      const cash = (await this.ledger.accountByCode(tx, '1000'))?.id;
      if (!cash) throw new DomainError('ACCOUNT_NOT_FOUND', 'Operating cash is not configured');
      const amount = toMinor(existing.amountMinor);
      const journal = await this.ledger.writeJournal(
        tx,
        tenantId,
        actorUserId,
        {
          memo: existing.memo,
          occurredOn: toDateOnly(existing.incurredOn)!,
          source: 'EXPENSE',
          lines: [
            {
              accountId: existing.expenseAccountId,
              debitMinor: amount,
              creditMinor: 0,
              projectId: existing.projectId ?? undefined,
              departmentId: existing.departmentId ?? undefined,
            },
            { accountId: cash, debitMinor: 0, creditMinor: amount },
          ],
        },
        existing.incurredOn,
        true,
      );
      const updated = await tx.expenseClaim.update({
        where: { id },
        data: { status: 'POSTED', journalId: journal.id },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: 'accounting.expense.posted',
          resourceType: 'expense_claim',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toExpense(row);
  }

  private async transitionPurchaseOrder(
    tenantId: string,
    actorUserId: string,
    id: string,
    from: 'DRAFT' | 'SUBMITTED',
    to: 'SUBMITTED' | 'APPROVED',
    action: string,
  ): Promise<PurchaseOrder> {
    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { id },
        include: { vendor: true, lines: true },
      });
      if (!existing) throw new DomainError('PURCHASE_ORDER_NOT_FOUND', 'That purchase order could not be found');
      if (existing.status !== from) {
        throw new DomainError('PURCHASE_ORDER_NOT_APPROVABLE', `That purchase order cannot be ${action}`);
      }
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: to },
        include: { vendor: true, lines: true },
      });
      await this.audit.record(
        {
          tenantId,
          actorUserId,
          action: `accounting.purchase_order.${action}`,
          resourceType: 'purchase_order',
          resourceId: id,
        },
        tx,
      );
      return updated;
    });
    return this.toPurchaseOrder(row);
  }

  private toVendor(row: {
    id: string;
    tenantId: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    status: Vendor['status'];
    createdAt: Date;
    updatedAt: Date;
  }): Vendor {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private poTotal(lines: Array<{ quantity: number; unitCostMinor: bigint }>): number {
    return lines.reduce((sum, line) => sum + line.quantity * toMinor(line.unitCostMinor), 0);
  }

  private toPurchaseOrder(row: {
    id: string;
    tenantId: string;
    number: number;
    vendorId: string;
    vendor: { name: string };
    orderedOn: Date;
    expectedOn: Date | null;
    memo: string | null;
    status: PurchaseOrder['status'];
    projectId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      unitCostMinor: bigint;
      accountId: string | null;
    }>;
  }): PurchaseOrder {
    return {
      ...this.toPurchaseOrderSummary(row),
      lines: row.lines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitCostMinor: toMinor(line.unitCostMinor),
        amountMinor: line.quantity * toMinor(line.unitCostMinor),
        accountId: line.accountId,
      })),
    };
  }

  private toPurchaseOrderSummary(row: {
    id: string;
    tenantId: string;
    number: number;
    vendorId: string;
    vendor: { name: string };
    orderedOn: Date;
    expectedOn: Date | null;
    memo: string | null;
    status: PurchaseOrder['status'];
    projectId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{ quantity: number; unitCostMinor: bigint }>;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      number: row.number,
      vendorId: row.vendorId,
      vendorName: row.vendor.name,
      orderedOn: toDateOnly(row.orderedOn)!,
      expectedOn: toDateOnly(row.expectedOn),
      memo: row.memo,
      status: row.status,
      projectId: row.projectId,
      totalMinor: this.poTotal(row.lines),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBill(row: {
    id: string;
    tenantId: string;
    number: number;
    vendorId: string;
    vendor: { name: string };
    purchaseOrderId: string | null;
    billedOn: Date;
    dueOn: Date | null;
    memo: string | null;
    status: Bill['status'];
    expenseAccountId: string;
    amountMinor: bigint;
    projectId: string | null;
    journalId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Bill {
    return {
      id: row.id,
      tenantId: row.tenantId,
      number: row.number,
      vendorId: row.vendorId,
      vendorName: row.vendor.name,
      purchaseOrderId: row.purchaseOrderId,
      billedOn: toDateOnly(row.billedOn)!,
      dueOn: toDateOnly(row.dueOn),
      memo: row.memo,
      status: row.status,
      expenseAccountId: row.expenseAccountId,
      amountMinor: toMinor(row.amountMinor),
      projectId: row.projectId,
      journalId: row.journalId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toExpense(row: {
    id: string;
    tenantId: string;
    memberId: string | null;
    submitterName: string | null;
    incurredOn: Date;
    amountMinor: bigint;
    merchant: string | null;
    memo: string;
    status: Expense['status'];
    expenseAccountId: string;
    projectId: string | null;
    departmentId: string | null;
    journalId: string | null;
    decidedByUserId: string | null;
    decidedAt: Date | null;
    decisionNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Expense {
    return {
      id: row.id,
      tenantId: row.tenantId,
      memberId: row.memberId,
      submitterName: row.submitterName,
      incurredOn: toDateOnly(row.incurredOn)!,
      amountMinor: toMinor(row.amountMinor),
      merchant: row.merchant,
      memo: row.memo,
      status: row.status,
      expenseAccountId: row.expenseAccountId,
      projectId: row.projectId,
      departmentId: row.departmentId,
      journalId: row.journalId,
      decidedByUserId: row.decidedByUserId,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
