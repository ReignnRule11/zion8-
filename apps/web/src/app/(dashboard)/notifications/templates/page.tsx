import type { Metadata } from 'next';
import Link from 'next/link';
import {
  NotificationChannel,
  Permission,
  notificationChannelSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Card,
  EmptyState,
  inputClass,
  PageHeader,
  Pagination,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { NotificationTemplateForm } from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'Templates' };

const PAGE_SIZE = 24;

export default async function NotificationTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    channel?: string;
    includeArchived?: string;
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
  const channel = params.channel
    ? notificationChannelSchema.safeParse(params.channel.toUpperCase())
    : null;
  const includeArchived = params.includeArchived === 'true';
  const canSend = can(me, Permission.NOTIFICATION_SEND);

  const page = await api.listNotificationTemplates(token, {
    limit,
    offset,
    search,
    channel: channel?.success ? channel.data : undefined,
    includeArchived: includeArchived || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Reusable copy per channel. Campaigns may snapshot a template or send inline."
      />

      {canSend ? (
        <Card>
          <SectionHeading title="New template" />
          <div className="mt-4">
            <NotificationTemplateForm />
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
              placeholder="Template name"
              className={inputClass}
            />
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
          <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-200">
            <input
              type="checkbox"
              name="includeArchived"
              value="true"
              defaultChecked={includeArchived}
              className="h-4 w-4 rounded"
            />
            Include archived
          </label>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Filter
          </button>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState message="No templates yet." />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-white/10">
            {page.items.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/notifications/templates/${template.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{template.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {humanize(template.channel)} · {formatDateTime(template.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={template.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination
        basePath="/notifications/templates"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{
          search,
          channel: channel?.success ? channel.data : undefined,
          includeArchived: includeArchived ? 'true' : undefined,
        }}
      />
    </div>
  );
}
