import type { Metadata } from 'next';
import Link from 'next/link';
import {
  NotificationCampaignStatus,
  NotificationChannel,
  Permission,
  notificationCampaignStatusSchema,
  notificationChannelSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Notifications' };

const PAGE_SIZE = 24;

export default async function NotificationCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    channel?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const status = params.status
    ? notificationCampaignStatusSchema.safeParse(params.status.toUpperCase())
    : null;
  const channel = params.channel
    ? notificationChannelSchema.safeParse(params.channel.toUpperCase())
    : null;
  const canSend = can(me, Permission.NOTIFICATION_SEND);

  const page = await api.listNotificationCampaigns(token, {
    limit,
    offset,
    search,
    status: status?.success ? status.data : undefined,
    channel: channel?.success ? channel.data : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Draft, schedule and send across email, SMS, WhatsApp, push and in-app."
        action={
          canSend ? (
            <Link
              href="/notifications/new"
              className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2 text-sm font-medium text-white transition"
            >
              New campaign
            </Link>
          ) : undefined
        }
      />

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
              placeholder="Campaign name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status?.success ? status.data : ''}
              className={inputClass}
            >
              <option value="">Any status</option>
              {Object.values(NotificationCampaignStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="channel" className="text-xs uppercase tracking-wide text-slate-500">
              Channel
            </label>
            <select
              id="channel"
              name="channel"
              defaultValue={channel?.success ? channel.data : ''}
              className={inputClass}
            >
              <option value="">Any channel</option>
              {Object.values(NotificationChannel).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
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
        <EmptyState
          message="No campaigns yet."
          hint={canSend ? 'Create a campaign to reach the directory.' : undefined}
        />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-white/10">
            {page.items.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/notifications/${campaign.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{campaign.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {humanize(campaign.channel)}
                      {campaign.scheduledAt
                        ? ` · ${formatDateTime(campaign.scheduledAt)}`
                        : ` · ${formatDateTime(campaign.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-slate-400">
                      {campaign.sentCount}/{campaign.recipientCount} sent
                    </span>
                    <StatusBadge status={campaign.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination
        basePath="/notifications"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{
          search,
          status: status?.success ? status.data : undefined,
          channel: channel?.success ? channel.data : undefined,
        }}
      />
    </div>
  );
}
