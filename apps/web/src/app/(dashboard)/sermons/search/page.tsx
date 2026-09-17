import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState, inputClass, PageHeader, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Search sermons' };

export default async function SermonSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.SERMON_READ)) {
    return <EmptyState message="You do not have permission to search sermons." />;
  }
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const page = q.length > 0 ? await api.searchSermons(token, { q, limit: 50, offset: 0 }) : null;

  return (
    <div className="space-y-6">
      <Link href="/sermons" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to sermons
      </Link>
      <PageHeader
        title="Search sermons"
        description="Looks across titles, speakers, tags, scripture and the current transcript."
      />
      <Card className="!p-4">
        <form method="get" className="flex gap-3">
          <input
            name="q"
            defaultValue={q}
            required
            minLength={1}
            placeholder="grace, John 3:16, baptism"
            className={inputClass}
          />
          <button
            type="submit"
            className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Search
          </button>
        </form>
      </Card>
      {page && page.items.length === 0 ? (
        <EmptyState message={`No sermons matched “${q}”.`} />
      ) : null}
      {page ? (
        <ul className="space-y-3">
          {page.items.map((sermon) => (
            <li key={sermon.id}>
              <Link
                href={`/sermons/${sermon.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{sermon.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {sermon.speakerName ?? 'Unknown speaker'}
                      {sermon.preachedAt ? ` · ${formatDateTime(sermon.preachedAt)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={sermon.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
