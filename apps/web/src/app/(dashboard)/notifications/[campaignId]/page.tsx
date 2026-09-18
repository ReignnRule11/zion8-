import type { Metadata } from 'next';
import Link from 'next/link';
import {
  NotificationCampaignStatus,
  NotificationMessageStatus,
  Permission,
  notificationMessageStatusSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Card,
  DefinitionList,
  EmptyState,
  inputClass,
  PageHeader,
  Pagination,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import {
  CancelCampaignForm,
  NotificationCampaignForm,
  ScheduleCampaignForm,
  SendCampaignForm,
} from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'Campaign' };

const PAGE_SIZE = 50;

export default async function NotificationCampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ status?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const { campaignId } = await params;
  const query = await searchParams;
  const limit = Math.min(Math.max(Number(query.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const status = query.status
    ? notificationMessageStatusSchema.safeParse(query.status.toUpperCase())
    : null;
  const canSend = can(me, Permission.NOTIFICATION_SEND);

  const [campaign, messages, analytics, templates, audiences] = await Promise.all([
    api.getNotificationCampaign(token, campaignId),
    api.listNotificationMessages(token, campaignId, {
      limit,
      offset,
      status: status?.success ? status.data : undefined,
    }),
    api.getNotificationCampaignAnalytics(token, campaignId),
    canSend
      ? api.listNotificationTemplates(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] }),
    canSend
      ? api.listNotificationAudiences(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] }),
  ]);

  const editable = canSend && campaign.status === NotificationCampaignStatus.DRAFT;
  const sendable = canSend && campaign.status === NotificationCampaignStatus.DRAFT;
  const cancellable =
    canSend &&
    (campaign.status === NotificationCampaignStatus.DRAFT ||
      campaign.status === NotificationCampaignStatus.SCHEDULED ||
      campaign.status === NotificationCampaignStatus.SENDING);

  return (
    <div className="space-y-6">
      <Link href="/notifications" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to campaigns
      </Link>
      <PageHeader
        title={campaign.name}
        description={`${humanize(campaign.channel)} · ${campaign.recipientCount} recipients`}
        action={<StatusBadge status={campaign.status} />}
      />

      <Card>
        <DefinitionList
          items={[
            { term: 'Channel', value: humanize(campaign.channel) },
            { term: 'Status', value: humanize(campaign.status) },
            { term: 'Scheduled', value: campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : '—' },
            { term: 'Sent', value: campaign.sentAt ? formatDateTime(campaign.sentAt) : '—' },
            { term: 'Recipients', value: String(campaign.recipientCount) },
            { term: 'Delivered / sent', value: `${analytics.delivered} / ${analytics.sent}` },
            { term: 'Failed', value: String(analytics.failed) },
            { term: 'Blocked', value: String(analytics.blocked) },
            { term: 'Read', value: String(analytics.read) },
            { term: 'Pending', value: String(analytics.pending) },
          ]}
        />
      </Card>

      {editable || sendable || cancellable ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {editable ? (
            <Card>
              <SectionHeading title="Edit draft" />
              <div className="mt-4">
                <NotificationCampaignForm
                  campaign={campaign}
                  templates={templates.items}
                  audiences={audiences.items}
                />
              </div>
            </Card>
          ) : null}
          {sendable || cancellable ? (
            <Card className="space-y-6">
              {sendable ? (
                <div>
                  <SectionHeading title="Send" description="Expands the audience and queues messages." />
                  <div className="mt-4">
                    <SendCampaignForm campaignId={campaign.id} />
                  </div>
                </div>
              ) : null}
              {sendable || campaign.status === NotificationCampaignStatus.SCHEDULED ? (
                <div>
                  <SectionHeading title="Schedule" />
                  <div className="mt-4">
                    <ScheduleCampaignForm
                      campaignId={campaign.id}
                      scheduledAt={campaign.scheduledAt}
                    />
                  </div>
                </div>
              ) : null}
              {cancellable ? (
                <div>
                  <SectionHeading
                    title="Cancel"
                    description="Pending rows are cancelled. Already-sent messages stay sent."
                  />
                  <div className="mt-4">
                    <CancelCampaignForm campaignId={campaign.id} />
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      {campaign.subject || campaign.body ? (
        <Card>
          <SectionHeading title="Copy" />
          {campaign.subject ? <p className="mt-3 text-sm font-medium">{campaign.subject}</p> : null}
          <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{campaign.body}</pre>
        </Card>
      ) : null}

      <Card>
        <SectionHeading title="Messages" description="Each row is the delivery job." />
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="message-status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              id="message-status"
              name="status"
              defaultValue={status?.success ? status.data : ''}
              className={inputClass}
            >
              <option value="">Any status</option>
              {Object.values(NotificationMessageStatus).map((value) => (
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
        {messages.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No messages yet. Send or schedule the campaign to expand the audience." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {messages.items.map((message) => (
              <li key={message.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{message.address ?? 'No address'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {message.attempts}/{message.maxAttempts} attempts
                    {message.blockedReason ? ` · ${message.blockedReason}` : ''}
                    {message.lastError ? ` · ${message.lastError}` : ''}
                  </p>
                </div>
                <StatusBadge status={message.status} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Pagination
            basePath={`/notifications/${campaign.id}`}
            limit={limit}
            offset={offset}
            total={messages.total}
            filters={{ status: status?.success ? status.data : undefined }}
          />
        </div>
      </Card>
    </div>
  );
}
