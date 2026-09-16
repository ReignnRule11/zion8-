import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatDateTime, formatPercent, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { archiveMemberAction, generateSummaryAction } from '../actions';
import {
  Avatar,
  Badge,
  Card,
  DefinitionList,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { TimelineNoteForm } from '@/components/membership/timeline-note-form';
import { RelationshipForm } from '@/components/membership/relationship-form';
import { DocumentUploadForm } from '@/components/membership/document-upload-form';
import { ConfirmDeleteRelationship } from '@/components/membership/confirm-delete-relationship';
import { DocumentRowActions } from '@/components/membership/document-row-actions';

export const metadata: Metadata = { title: 'Member profile' };

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { memberId } = await params;

  if (!can(me, Permission.MEMBER_READ)) {
    return <EmptyState message="You do not have permission to view member profiles." />;
  }

  let profile;
  try {
    profile = await api.getMemberProfile(token, memberId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'MEMBER_NOT_FOUND') notFound();
    throw error;
  }

  const { member } = profile;
  const memberOptions = can(me, Permission.RELATIONSHIP_MANAGE)
    ? (
        await api.listMembers(token, { limit: 200, offset: 0 })
      ).items
        .filter((candidate) => candidate.id !== member.id)
        .map((candidate) => ({ id: candidate.id, fullName: candidate.fullName }))
    : [];

  return (
    <div className="space-y-8">
      <Link href="/people" className="text-sm text-slate-400 transition hover:text-slate-200">
        ← Back to members
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            firstName={member.firstName}
            lastName={member.lastName}
            photoUrl={member.photoUrl}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {member.preferredName?.trim() || `${member.firstName} ${member.lastName}`.trim()}
              </h1>
              <StatusBadge status={member.status} />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {[member.email, member.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
            {member.tags.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {member.tags.map((tag) => (
                  <li key={tag}>
                    <Badge>{tag}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {can(me, Permission.MEMBER_UPDATE) ? (
            <Link
              href={`/people/${member.id}/edit`}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              Edit profile
            </Link>
          ) : null}
          {can(me, Permission.MEMBER_ARCHIVE) && member.status !== 'ARCHIVED' ? (
            <ConfirmActionButton
              action={archiveMemberAction}
              fields={{ memberId: member.id }}
              pendingLabel="Archiving..."
              confirmMessage="Archive this member? The record is kept for history and can no longer be edited."
            >
              Archive
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card>
            <SectionHeading
              title="AI summary"
              description="Generated from this member's timeline, attendance, and connected records."
              action={
                can(me, Permission.SUMMARY_GENERATE) ? (
                  <form action={generateSummaryAction}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <button
                      type="submit"
                      className="bg-zion-600 hover:bg-zion-500 rounded-lg px-3 py-2 text-sm font-medium text-white transition"
                    >
                      {profile.summary ? 'Regenerate' : 'Generate summary'}
                    </button>
                  </form>
                ) : null
              }
            />
            {profile.summary?.content ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <StatusBadge status={profile.summary.status} />
                  <span>via {humanize(profile.summary.provider)}</span>
                  {profile.summary.model ? <span>· {profile.summary.model}</span> : null}
                  <span>· {formatDateTime(profile.summary.generatedAt)}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-slate-200">
                  {profile.summary.content}
                </p>
                {profile.summary.highlights.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                    {profile.summary.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
                {profile.summary.facts ? (
                  <p className="text-xs text-slate-500">
                    Based on {profile.summary.facts.timelineEventCount} timeline events,{' '}
                    {profile.summary.facts.sessionsAttended} attended sessions, and{' '}
                    {profile.summary.facts.relationshipCount} relationships.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No summary yet. Generate one to see pastoral highlights for this member.
              </p>
            )}
          </Card>

          <Card>
            <SectionHeading title="Timeline" description="The append-only story of this member." />
            <ul className="mt-4 space-y-4">
              {profile.timeline.length === 0 ? (
                <li className="text-sm text-slate-400">Nothing recorded yet.</li>
              ) : (
                profile.timeline.map((entry) => (
                  <li key={entry.id} className="border-l border-white/10 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{humanize(entry.type)}</Badge>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(entry.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-200">{entry.title}</p>
                    {entry.summary ? (
                      <p className="mt-0.5 text-sm text-slate-400">{entry.summary}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {can(me, Permission.TIMELINE_MANAGE) ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <h3 className="text-sm font-medium text-slate-200">Add a note</h3>
                <div className="mt-3">
                  <TimelineNoteForm memberId={member.id} />
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title="Relationships" description="Family, mentorship, and contacts." />
            <ul className="mt-4 divide-y divide-white/10">
              {profile.relationships.length === 0 ? (
                <li className="py-3 text-sm text-slate-400">No relationships recorded.</li>
              ) : (
                profile.relationships.map((relationship) => {
                  const outgoing = relationship.fromMemberId === member.id;
                  const otherName = outgoing
                    ? relationship.toMemberName
                    : relationship.fromMemberName;
                  const label = outgoing ? relationship.type : relationship.inverseType;
                  const otherId = outgoing ? relationship.toMemberId : relationship.fromMemberId;
                  return (
                    <li
                      key={relationship.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-200">
                          <span className="text-slate-400">{humanize(label)} · </span>
                          <Link href={`/people/${otherId}`} className="hover:text-zion-200">
                            {otherName}
                          </Link>
                        </p>
                        {relationship.notes ? (
                          <p className="truncate text-xs text-slate-500">{relationship.notes}</p>
                        ) : null}
                      </div>
                      {can(me, Permission.RELATIONSHIP_MANAGE) ? (
                        <ConfirmDeleteRelationship
                          memberId={member.id}
                          relationshipId={relationship.id}
                        />
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
            {can(me, Permission.RELATIONSHIP_MANAGE) ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <RelationshipForm memberId={member.id} members={memberOptions} />
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading
              title="Documents"
              description="Certificates, consent forms, and pastoral records."
            />
            <ul className="mt-4 divide-y divide-white/10">
              {profile.documents.length === 0 ? (
                <li className="py-3 text-sm text-slate-400">No documents filed.</li>
              ) : (
                profile.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {document.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {humanize(document.category)} · {document.fileName} ·{' '}
                        {Math.max(1, Math.round(document.sizeBytes / 1024))} KiB ·{' '}
                        {formatDate(document.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={document.status} />
                      {can(me, Permission.DOCUMENT_READ) && document.status === 'AVAILABLE' ? (
                        <a
                          href={`/api/membership/documents/${document.id}/content`}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
                        >
                          Download
                        </a>
                      ) : null}
                      {can(me, Permission.DOCUMENT_MANAGE) && document.status !== 'ARCHIVED' ? (
                        <DocumentRowActions memberId={member.id} documentId={document.id} />
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
            {can(me, Permission.DOCUMENT_UPLOAD) ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <DocumentUploadForm memberId={member.id} />
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <SectionHeading title="Attendance" />
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Rate</dt>
                <dd className="text-2xl font-semibold">
                  {formatPercent(profile.attendance.attendanceRate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Streak</dt>
                <dd className="text-2xl font-semibold">{profile.attendance.currentStreak}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Attended</dt>
                <dd className="text-sm text-slate-200">
                  {profile.attendance.sessionsAttended} of {profile.attendance.sessionsRecorded}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Last attended</dt>
                <dd className="text-sm text-slate-200">
                  {formatDate(profile.attendance.lastAttendedAt)}
                </dd>
              </div>
            </dl>
            {profile.recentAttendance.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {profile.recentAttendance.map((session) => (
                  <li key={session.sessionId} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/community/attendance/${session.sessionId}`}
                      className="truncate text-sm text-slate-300 hover:text-zion-200"
                    >
                      {session.title}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatDate(session.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title="Profile details" />
            <div className="mt-4">
              <DefinitionList
                items={[
                  { term: 'Date of birth', value: formatDate(member.dateOfBirth) },
                  { term: 'Gender', value: humanize(member.gender) },
                  { term: 'Marital status', value: humanize(member.maritalStatus) },
                  { term: 'Joined', value: formatDate(member.joinedAt) },
                  { term: 'Baptized', value: formatDate(member.baptizedAt) },
                  {
                    term: 'Address',
                    value:
                      [member.addressLine1, member.city, member.region, member.countryCode]
                        .filter(Boolean)
                        .join(', ') || '—',
                  },
                ]}
              />
            </div>
            {member.notes ? (
              <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">
                {member.notes}
              </p>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title="Families" />
            {profile.families.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Not part of a family yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.families.map((family) => (
                  <li key={family.familyId} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/community/families/${family.familyId}`}
                      className="text-sm text-slate-200 hover:text-zion-200"
                    >
                      {family.familyName}
                    </Link>
                    <Badge>{humanize(family.role)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading title="Departments & volunteering" />
            {profile.departments.length === 0 && profile.volunteerRoles.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Serving in no departments or roles.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.departments.map((department) => (
                  <li
                    key={department.departmentId}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/community/departments/${department.departmentId}`}
                      className="text-sm text-slate-200 hover:text-zion-200"
                    >
                      {department.name}
                    </Link>
                    <Badge tone="info">{humanize(department.role)}</Badge>
                  </li>
                ))}
                {profile.volunteerRoles.map((role) => (
                  <li key={role.roleId} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/community/volunteers/${role.roleId}`}
                      className="text-sm text-slate-200 hover:text-zion-200"
                    >
                      {role.name}
                    </Link>
                    <Badge>{humanize(role.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
