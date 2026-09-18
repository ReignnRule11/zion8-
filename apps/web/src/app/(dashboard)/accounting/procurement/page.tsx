import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  BillForm,
  ExpenseForm,
  PurchaseOrderForm,
  VendorForm,
} from '@/components/accounting/procurement-forms';
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Procurement' };

export default async function ProcurementPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view procurement." />;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const [vendors, purchaseOrders, bills, expenses, accounts, projects] = await Promise.all([
    api.listVendors(token, { limit: 50, offset: 0 }),
    api.listPurchaseOrders(token, { limit: 20, offset: 0 }),
    api.listBills(token, { limit: 20, offset: 0 }),
    api.listExpenses(token, { limit: 20, offset: 0 }),
    canManage
      ? api.listAccounts(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof api.listAccounts>>['items'] }),
    canManage
      ? api.listProjects(token, { limit: 100, offset: 0 })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof api.listProjects>>['items'] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description="Vendors, purchase orders, bills, and staff expenses. Bills and approved expenses post to the ledger."
      />

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeading title="New vendor" />
            <div className="mt-4">
              <VendorForm />
            </div>
          </Card>
          <Card>
            <SectionHeading title="New purchase order" />
            <div className="mt-4">
              {vendors.items.length === 0 ? (
                <EmptyState message="Create a vendor first." />
              ) : (
                <PurchaseOrderForm vendors={vendors.items} accounts={accounts.items} projects={projects.items} />
              )}
            </div>
          </Card>
          <Card>
            <SectionHeading title="New bill" />
            <div className="mt-4">
              {vendors.items.length === 0 ? (
                <EmptyState message="Create a vendor first." />
              ) : (
                <BillForm vendors={vendors.items} accounts={accounts.items} projects={projects.items} />
              )}
            </div>
          </Card>
          <Card>
            <SectionHeading title="New expense" />
            <div className="mt-4">
              <ExpenseForm accounts={accounts.items} projects={projects.items} />
            </div>
          </Card>
        </div>
      ) : null}

      <Card>
        <SectionHeading title="Vendors" />
        {vendors.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No vendors yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {vendors.items.map((vendor) => (
              <li key={vendor.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{vendor.name}</p>
                  <p className="text-sm text-slate-400">{vendor.email ?? vendor.contactName ?? '—'}</p>
                </div>
                <StatusBadge status={vendor.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeading title="Purchase orders" />
        {purchaseOrders.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No purchase orders yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {purchaseOrders.items.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/accounting/procurement/purchase-orders/${order.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition hover:text-zion-100"
                >
                  <div>
                    <p className="font-medium">
                      PO-{order.number} {order.vendorName}
                    </p>
                    <p className="text-sm text-slate-400">{formatDate(order.orderedOn)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatMoney(order.totalMinor)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeading title="Bills" />
        {bills.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No bills yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {bills.items.map((bill) => (
              <li key={bill.id}>
                <Link
                  href={`/accounting/procurement/bills/${bill.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition hover:text-zion-100"
                >
                  <div>
                    <p className="font-medium">
                      BILL-{bill.number} {bill.vendorName}
                    </p>
                    <p className="text-sm text-slate-400">{formatDate(bill.billedOn)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatMoney(bill.amountMinor)}</span>
                    <StatusBadge status={bill.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeading title="Expenses" />
        {expenses.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No expenses yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {expenses.items.map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`/accounting/procurement/expenses/${expense.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition hover:text-zion-100"
                >
                  <div>
                    <p className="font-medium">{expense.memo}</p>
                    <p className="text-sm text-slate-400">
                      {expense.submitterName ?? 'Staff'} · {formatDate(expense.incurredOn)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatMoney(expense.amountMinor)}</span>
                    <StatusBadge status={expense.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
