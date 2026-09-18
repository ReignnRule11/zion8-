import type { Metadata } from 'next';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState, inputClass, PageHeader, SectionHeading } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Notification analytics' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toInstant(date: string | undefined, endOfDay: boolean): string | undefined {
  if (!date || !ISO_DATE.test(date)) return undefined;
  return endOfDay ? `${date}T23:59:59.999Z` : `${date}T00:00:00.000Z`;
}

export default async function NotificationAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const params = await searchParams;
  const from = params.from && ISO_DATE.test(params.from) ? params.from : undefined;
  const to = params.to && ISO_DATE.test(params.to) ? params.to : undefined;
  const analytics = await api.getNotificationAnalytics(token, {
    from: toInstant(from, false),
    to: toInstant(to, true),
  });

  const tiles = [
    { label: 'Campaigns', value: analytics.campaigns },
    { label: 'Recipients', value: analytics.recipients },
    { label: 'Sent', value: analytics.sent },
    { label: 'Delivered', value: analytics.delivered },
    { label: 'Failed', value: analytics.failed },
    { label: 'Blocked', value: analytics.blocked },
    { label: 'Pending', value: analytics.pending },
    { label: 'Read', value: analytics.read },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Delivery counts across campaigns. Blocked rows are missing contact or provider config."
      />

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="from" className="text-xs uppercase tracking-wide text-slate-500">
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={from ?? ''} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="text-xs uppercase tracking-wide text-slate-500">
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={to ?? ''} className={inputClass} />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Apply range
          </button>
        </form>
      </Card>

      <section aria-label="Delivery totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{tile.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{tile.value}</p>
          </Card>
        ))}
      </section>

      <Card>
        <SectionHeading title="By channel" />
        {analytics.byChannel.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No delivery rows in this range." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {analytics.byChannel.map((row) => (
              <li key={row.channel} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p className="font-medium">{humanize(row.channel)}</p>
                <p className="text-sm tabular-nums text-slate-400">
                  {row.sent} sent · {row.failed} failed · {row.blocked} blocked · {row.recipients}{' '}
                  recipients
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
