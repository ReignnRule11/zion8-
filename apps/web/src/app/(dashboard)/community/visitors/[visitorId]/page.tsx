import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Badge, Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';
import {
  VisitorConvertForm,
  VisitorVisitForm,
} from '@/components/membership/visitor-detail-forms';

export const metadata: Metadata = { title: 'Visitor' };

export default async function VisitorDetailPage({
  params,
}: {
  params: Promise<{ visitorId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { visitorId } = await params;

  if (!can(me, Permission.VISITOR_READ)) {
    return <EmptyState message="You do not have permission to view visitors." />;
  }

  let visitor;
  try {
    visitor = await api.getVisitor(token, visitorId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'VISITOR_NOT_FOUND') notFound();
    throw error;
  }

  const converted = Boolean(visitor.convertedMemberId);

  return (
    <div className="space-y-6">
      <Link
        href="/community/visitors"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to visitors
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {visitor.firstName} {visitor.lastName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {[visitor.email, visitor.phone].filter(Boolean).join(' · ') || 'No contact details'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{humanize(visitor.source)}</Badge>
          <StatusBadge status={visitor.status} />
        </div>
      </header>

      {converted ? (
        <Card className="!border-emerald-500/30 !bg-emerald-500/5">
          <p className="text-sm text-emerald-100">
            Converted to a member on {formatDate(visitor.convertedAt)}.{' '}
            <Link
              href={`/people/${visitor.convertedMemberId}`}
              className="underline hover:text-white"
            >
              View member profile
            </Link>
          </p>
        </Card>
      ) : null}

      <Card>
        <SectionHeading title="Details" />
        <div className="mt-4">
          <DefinitionList
            items={[
              { term: 'First visit', value: formatDateTime(visitor.firstVisitAt) },
              { term: 'Follow up by', value: formatDateTime(visitor.followUpAt) },
              {
                term: 'Address',
                value:
                  [visitor.addressLine1, visitor.city, visitor.countryCode]
                    .filter(Boolean)
                    .join(', ') || '—',
              },
              { term: 'Interests', value: visitor.interests.join(', ') || '—' },
            ]}
          />
          {visitor.notes ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">
              {visitor.notes}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Visit history" description={`${visitor.visits.length} recorded`} />
        <ul className="mt-4 divide-y divide-white/10">
          {visitor.visits.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">No visits logged yet.</li>
          ) : (
            visitor.visits.map((visit) => (
              <li key={visit.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-slate-200">
                    {visit.serviceName || 'Service'}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(visit.occurredAt)}</p>
                </div>
                <StatusBadge status={visit.attended ? 'PRESENT' : 'ABSENT'} />
              </li>
            ))
          )}
        </ul>
        {can(me, Permission.VISITOR_UPDATE) ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <VisitorVisitForm visitorId={visitor.id} />
          </div>
        ) : null}
      </Card>

      {can(me, Permission.VISITOR_MANAGE) && !converted ? (
        <Card>
          <SectionHeading
            title="Convert to a member"
            description="Keeps the visit history and links the new member record back to this visitor."
          />
          <div className="mt-4">
            <VisitorConvertForm
              visitorId={visitor.id}
              defaults={{
                firstName: visitor.firstName,
                lastName: visitor.lastName,
                email: visitor.email ?? null,
                phone: visitor.phone ?? null,
              }}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
