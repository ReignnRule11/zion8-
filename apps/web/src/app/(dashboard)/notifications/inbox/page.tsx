import type { Metadata } from 'next';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/membership/ui';
import { MarkReadForm } from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'Inbox' };

const PAGE_SIZE = 24;

export default async function NotificationInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ unreadOnly?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const unreadOnly = params.unreadOnly === 'true';

  const page = await api.listNotificationInbox(token, {
    limit,
    offset,
    unreadOnly: unreadOnly || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="In-app messages for your linked member record."
      />

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              name="unreadOnly"
              value="true"
              defaultChecked={unreadOnly}
              className="h-4 w-4 rounded"
            />
            Unread only
          </label>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Apply
          </button>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState message="No in-app messages." hint="Campaigns on the in-app channel appear here." />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-white/10">
            {page.items.map((message) => (
              <li key={message.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {message.subject ? (
                      <p className="font-medium">{message.subject}</p>
                    ) : (
                      <p className="font-medium">In-app message</p>
                    )}
                    {message.readAt ? <StatusBadge status="READ" /> : <StatusBadge status="PENDING" />}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{message.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(message.createdAt)}</p>
                </div>
                {message.readAt ? null : <MarkReadForm messageId={message.id} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination
        basePath="/notifications/inbox"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{ unreadOnly: unreadOnly ? 'true' : undefined }}
      />
    </div>
  );
}
