import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JournalStatus, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { postJournalAction } from '../../actions';
import { VoidJournalForm } from '@/components/accounting/ledger-forms';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import {
  Card,
  DefinitionList,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Journal' };

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ journalId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { journalId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view journals." />;
  }

  let journal;
  try {
    journal = await api.getJournal(token, journalId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'JOURNAL_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  return (
    <div className="space-y-6">
      <Link href="/accounting/journals" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to journals
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            #{journal.number} {journal.memo}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {formatDate(journal.occurredOn)} · {humanize(journal.source)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={journal.status} />
          {canManage && journal.status === JournalStatus.DRAFT ? (
            <ConfirmActionButton
              action={postJournalAction}
              fields={{ journalId: journal.id }}
              pendingLabel="Posting"
              confirmMessage="Post this journal? It cannot be edited afterwards."
              variant="primary"
            >
              Post
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <Card>
        <DefinitionList
          items={[
            { term: 'Debit', value: formatMoney(journal.debitMinor) },
            { term: 'Credit', value: formatMoney(journal.creditMinor) },
            { term: 'Reference', value: journal.reference ?? '—' },
            { term: 'Posted at', value: journal.postedAt ? formatDate(journal.postedAt) : '—' },
            { term: 'Void reason', value: journal.voidReason ?? '—' },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading title="Lines" />
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2">Account</th>
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Debit</th>
              <th className="pb-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {journal.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2">
                  {line.accountCode} {line.accountName}
                </td>
                <td className="py-2 text-slate-400">{line.description ?? '—'}</td>
                <td className="py-2 text-right">{line.debitMinor ? formatMoney(line.debitMinor) : ''}</td>
                <td className="py-2 text-right">{line.creditMinor ? formatMoney(line.creditMinor) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {canManage && journal.status === JournalStatus.POSTED ? (
        <Card>
          <SectionHeading title="Void" description="Creates a reversing entry in an open period." />
          <div className="mt-4">
            <VoidJournalForm journalId={journal.id} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
