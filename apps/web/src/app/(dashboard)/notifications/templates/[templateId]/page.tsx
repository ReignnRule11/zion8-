import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, DefinitionList, EmptyState, PageHeader, StatusBadge } from '@/components/membership/ui';
import { NotificationTemplateForm } from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'Template' };

export default async function NotificationTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const { templateId } = await params;
  const template = await api.getNotificationTemplate(token, templateId);
  const canSend = can(me, Permission.NOTIFICATION_SEND);

  return (
    <div className="space-y-6">
      <Link
        href="/notifications/templates"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        Back to templates
      </Link>
      <PageHeader
        title={template.name}
        description={`${humanize(template.channel)} template`}
        action={<StatusBadge status={template.status} />}
      />
      <Card>
        <DefinitionList
          items={[
            { term: 'Channel', value: humanize(template.channel) },
            { term: 'Updated', value: formatDateTime(template.updatedAt) },
            { term: 'Subject', value: template.subject ?? '—' },
          ]}
        />
      </Card>
      {canSend ? (
        <Card>
          <NotificationTemplateForm template={template} />
        </Card>
      ) : (
        <Card>
          <pre className="whitespace-pre-wrap text-sm text-slate-300">{template.body}</pre>
        </Card>
      )}
    </div>
  );
}
