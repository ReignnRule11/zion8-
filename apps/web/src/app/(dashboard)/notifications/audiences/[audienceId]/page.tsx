import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, DefinitionList, EmptyState, PageHeader, SectionHeading } from '@/components/membership/ui';
import { NotificationAudienceForm } from '@/components/notifications/notification-forms';

export const metadata: Metadata = { title: 'Audience' };

export default async function NotificationAudienceDetailPage({
  params,
}: {
  params: Promise<{ audienceId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.NOTIFICATION_READ)) {
    return <EmptyState message="You do not have permission to view notifications." />;
  }

  const { audienceId } = await params;
  const [audience, preview] = await Promise.all([
    api.getNotificationAudience(token, audienceId),
    api.previewNotificationAudience(token, audienceId),
  ]);
  const canSend = can(me, Permission.NOTIFICATION_SEND);

  return (
    <div className="space-y-6">
      <Link
        href="/notifications/audiences"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        Back to audiences
      </Link>
      <PageHeader title={audience.name} description={audience.description ?? 'Saved membership filter'} />

      <Card>
        <DefinitionList
          items={[
            { term: 'Members in filter', value: String(preview.total) },
            { term: 'Updated', value: formatDateTime(audience.updatedAt) },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading title="Sample" description="First members matching the live filter." />
        {preview.sample.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No members match this filter." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {preview.sample.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{member.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {member.email ?? 'No email'} · {member.phone ?? 'No phone'}
                  </p>
                </div>
                <Link href={`/people/${member.id}`} className="text-sm text-zion-200 hover:text-zion-100">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canSend ? (
        <Card>
          <SectionHeading title="Edit audience" />
          <div className="mt-4">
            <NotificationAudienceForm audience={audience} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
