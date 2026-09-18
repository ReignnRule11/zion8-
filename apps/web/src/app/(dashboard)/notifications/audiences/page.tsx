import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Card,
  EmptyState,
  inputClass,
  PageHeader,
  Pagination,
  SectionHeading,
} from '@/components/membership/ui';
import { NotificationAudienceForm } from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'Audiences' };

const PAGE_SIZE = 24;

export default async function NotificationAudiencesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const canSend = can(me, Permission.NOTIFICATION_SEND);

  const page = await api.listNotificationAudiences(token, { limit, offset, search });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audiences"
        description="Saved membership filters. Campaigns snapshot members at send time."
      />

      {canSend ? (
        <Card>
          <SectionHeading title="New audience" />
          <div className="mt-4">
            <NotificationAudienceForm />
          </div>
        </Card>
      ) : null}

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <label htmlFor="search" className="text-xs uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              id="search"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Audience name"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Filter
          </button>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState message="No saved audiences." />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-white/10">
            {page.items.map((audience) => (
              <li key={audience.id}>
                <Link
                  href={`/notifications/audiences/${audience.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{audience.name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {audience.description ?? 'No description'} · {formatDateTime(audience.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination
        basePath="/notifications/audiences"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{ search }}
      />
    </div>
  );
}
