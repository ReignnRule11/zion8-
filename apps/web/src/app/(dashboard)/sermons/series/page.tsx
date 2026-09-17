import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState, PageHeader } from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { archiveSermonSeriesAction } from '../actions';
import { SeriesCreateForm } from './series-create-form';

export const metadata: Metadata = { title: 'Sermon series' };

export default async function SermonSeriesPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.SERMON_READ)) {
    return <EmptyState message="You do not have permission to view sermon series." />;
  }
  const canManage = can(me, Permission.SERMON_MANAGE);
  const page = await api.listSermonSeries(token, { limit: 100, offset: 0 });

  return (
    <div className="space-y-6">
      <Link href="/sermons" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to sermons
      </Link>
      <PageHeader title="Series" description="Group teachings that belong together." />
      {canManage ? (
        <Card>
          <SeriesCreateForm />
        </Card>
      ) : null}
      {page.items.length === 0 ? (
        <EmptyState message="No series yet." />
      ) : (
        <ul className="space-y-3">
          {page.items.map((series) => (
            <li
              key={series.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div>
                <h2 className="font-semibold">{series.title}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {series.sermonCount} sermon{series.sermonCount === 1 ? '' : 's'}
                  {series.startsOn ? ` · ${formatDate(series.startsOn)}` : ''}
                </p>
              </div>
              {canManage && !series.archivedAt ? (
                <ConfirmActionButton
                  action={archiveSermonSeriesAction}
                  fields={{ seriesId: series.id }}
                  pendingLabel="Archiving..."
                  confirmMessage="Archive this series?"
                >
                  Archive
                </ConfirmActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
