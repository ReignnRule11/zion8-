import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState, PageHeader } from '@/components/membership/ui';
import { NotificationCampaignForm } from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'New campaign' };

export default async function NewNotificationCampaignPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_SEND)) {
    return <EmptyState message="You do not have permission to send notifications." />;
  }

  const [templates, audiences] = await Promise.all([
    api.listNotificationTemplates(token, { limit: 200, offset: 0 }),
    api.listNotificationAudiences(token, { limit: 200, offset: 0 }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/notifications" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to campaigns
      </Link>
      <PageHeader
        title="New campaign"
        description="Pick a channel, a saved audience or a membership filter, then send or schedule."
      />
      <Card>
        <NotificationCampaignForm templates={templates.items} audiences={audiences.items} />
      </Card>
    </div>
  );
}
