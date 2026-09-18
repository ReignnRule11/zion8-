import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission, PurchaseOrderStatus } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { approvePurchaseOrderAction, submitPurchaseOrderAction } from '../../../actions';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Purchase order' };

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ purchaseOrderId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { purchaseOrderId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view procurement." />;
  }

  let order;
  try {
    order = await api.getPurchaseOrder(token, purchaseOrderId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'PURCHASE_ORDER_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  return (
    <div className="space-y-6">
      <Link href="/accounting/procurement" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to procurement
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            PO-{order.number} {order.vendorName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Ordered {formatDate(order.orderedOn)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
          {canManage && order.status === PurchaseOrderStatus.DRAFT ? (
            <ConfirmActionButton
              action={submitPurchaseOrderAction}
              fields={{ purchaseOrderId: order.id }}
              pendingLabel="Submitting"
              variant="secondary"
            >
              Submit
            </ConfirmActionButton>
          ) : null}
          {canManage && order.status === PurchaseOrderStatus.SUBMITTED ? (
            <ConfirmActionButton
              action={approvePurchaseOrderAction}
              fields={{ purchaseOrderId: order.id }}
              pendingLabel="Approving"
              variant="primary"
            >
              Approve
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <Card>
        <DefinitionList
          items={[
            { term: 'Total', value: formatMoney(order.totalMinor) },
            { term: 'Expected', value: formatDate(order.expectedOn) },
            { term: 'Memo', value: order.memo ?? '—' },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading title="Lines" />
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right">{line.quantity}</td>
                <td className="py-2 text-right">{formatMoney(line.unitCostMinor)}</td>
                <td className="py-2 text-right">{formatMoney(line.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
