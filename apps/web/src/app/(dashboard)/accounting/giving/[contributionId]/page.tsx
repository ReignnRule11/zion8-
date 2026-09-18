import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContributionStatus, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { RefundContributionForm } from '@/components/accounting/giving-forms';
import { Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Contribution' };

export default async function ContributionDetailPage({
  params,
}: {
  params: Promise<{ contributionId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { contributionId } = await params;
  if (!can(me, Permission.GIVING_READ) && !can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view giving." />;
  }

  let gift;
  try {
    gift = await api.getContribution(token, contributionId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'CONTRIBUTION_NOT_FOUND') notFound();
    throw error;
  }

  const canRefund = can(me, Permission.GIVING_REFUND);

  return (
    <div className="space-y-6">
      <Link href="/accounting/giving" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to giving
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gift.donorName ?? 'Anonymous'}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {gift.fundName} · {formatDate(gift.receivedOn)}
          </p>
        </div>
        <StatusBadge status={gift.status} />
      </header>

      <Card>
        <DefinitionList
          items={[
            { term: 'Amount', value: formatMoney(gift.amountMinor, gift.currency) },
            { term: 'Method', value: humanize(gift.method) },
            { term: 'Tax deductible', value: gift.taxDeductible ? 'Yes' : 'No' },
            { term: 'External ref', value: gift.externalRef ?? '—' },
            { term: 'Note', value: gift.note ?? '—' },
            {
              term: 'Journal',
              value: gift.journalId ? (
                <Link href={`/accounting/journals/${gift.journalId}`} className="text-zion-200 hover:underline">
                  View journal
                </Link>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </Card>

      {canRefund && gift.status !== ContributionStatus.REFUNDED && gift.status !== ContributionStatus.VOID ? (
        <Card>
          <SectionHeading title="Refund" description="Reverses revenue to cash and links a REFUNDED contribution." />
          <div className="mt-4">
            <RefundContributionForm contributionId={gift.id} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
