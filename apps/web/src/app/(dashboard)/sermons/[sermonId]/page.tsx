import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  archiveSermonAction,
  deleteSermonNoteAction,
  publishSermonAction,
  revokeSermonShareAction,
} from '../actions';
import {
  Badge,
  Card,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { SubmitButton } from '@/components/membership/submit-button';
import { SermonForm } from '@/components/sermon/sermon-form';
import { SermonPlayer } from '@/components/sermon/sermon-player';
import {
  SermonGenerateForm,
  SermonNoteForm,
  SermonReprocessForm,
  SermonShareForm,
  SermonTranscriptForm,
} from '@/components/sermon/sermon-study-forms';

export const metadata: Metadata = { title: 'Sermon' };

export default async function SermonDetailPage({
  params,
}: {
  params: Promise<{ sermonId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { sermonId } = await params;
  if (!can(me, Permission.SERMON_READ)) {
    return <EmptyState message="You do not have permission to view sermons." />;
  }

  let sermon;
  try {
    sermon = await api.getSermon(token, sermonId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'SERMON_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.SERMON_MANAGE);
  const canPublish = can(me, Permission.SERMON_PUBLISH);
  const series = canManage
    ? (await api.listSermonSeries(token, { limit: 200, offset: 0 })).items
    : [];
  const notes = await api.listSermonNotes(token, sermonId, { limit: 50, offset: 0 });
  const shares = canPublish ? await api.listSermonShares(token, sermonId) : [];
  const recommendations = await api.listSermonRecommendations(token, sermonId);
  const workspace = me.activeTenant;

  return (
    <div className="space-y-6">
      <Link href="/sermons" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to sermons
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sermon.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {sermon.speakerName ?? 'Unknown speaker'}
            {sermon.preachedAt ? ` · ${formatDateTime(sermon.preachedAt)}` : ''}
            {sermon.series ? ` · ${sermon.series.title}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={sermon.status} />
          <Badge>{humanize(sermon.visibility)}</Badge>
          {canPublish && sermon.status !== 'PUBLISHED' && sermon.status !== 'ARCHIVED' ? (
            <form action={publishSermonAction}>
              <input type="hidden" name="sermonId" value={sermon.id} />
              <SubmitButton pendingLabel="Publishing...">Publish</SubmitButton>
            </form>
          ) : null}
          {canManage && sermon.status !== 'ARCHIVED' ? (
            <ConfirmActionButton
              action={archiveSermonAction}
              fields={{ sermonId: sermon.id }}
              pendingLabel="Archiving..."
              confirmMessage="Archive this sermon?"
            >
              Archive
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      {sermon.media.url ? (
        <Card>
          <SectionHeading title="Player" />
          <div className="mt-4">
            <SermonPlayer media={sermon.media} chapters={sermon.chapters} />
          </div>
        </Card>
      ) : null}

      {sermon.insight.summary ? (
        <Card>
          <SectionHeading title="Summary" description={sermon.insight.provider ?? undefined} />
          <p className="mt-3 text-sm leading-6 text-slate-200">{sermon.insight.summary}</p>
          {sermon.insight.keyPoints.length > 0 ? (
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-300">
              {sermon.insight.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
          {sermon.insight.socialCaption ? (
            <p className="mt-3 text-xs text-slate-400">{sermon.insight.socialCaption}</p>
          ) : null}
        </Card>
      ) : null}

      {sermon.scriptures.length > 0 ? (
        <Card>
          <SectionHeading title="Scripture" />
          <div className="mt-3 flex flex-wrap gap-2">
            {sermon.scriptures.map((item) => (
              <Badge key={item.id} tone="info">
                {item.reference}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {sermon.chapters.length > 0 ? (
        <Card>
          <SectionHeading title="Chapters" />
          <ol className="mt-3 space-y-2 text-sm text-slate-300">
            {sermon.chapters.map((chapter) => (
              <li key={chapter.id}>
                <span className="font-medium text-slate-100">{chapter.title}</span>
                {chapter.summary ? ` — ${chapter.summary}` : ''}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Card>
        <SectionHeading title="Transcript" />
        <div className="mt-4">
          {canManage ? (
            <SermonTranscriptForm
              sermonId={sermon.id}
              language={sermon.language}
              text={sermon.transcript?.text ?? ''}
            />
          ) : sermon.transcript ? (
            <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {sermon.transcript.text}
            </pre>
          ) : (
            <EmptyState message="No transcript yet." />
          )}
        </div>
      </Card>

      {canManage ? (
        <Card>
          <SectionHeading title="Pipeline" />
          <div className="mt-4 space-y-6">
            <SermonReprocessForm sermonId={sermon.id} />
            <SermonGenerateForm sermonId={sermon.id} />
            <ul className="space-y-1 text-xs text-slate-400">
              {sermon.jobs.map((job) => (
                <li key={job.id}>
                  {job.type} · {job.status}
                  {job.blockedReason ? ` · ${job.blockedReason}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeading title="Notes" />
        <div className="mt-4 space-y-4">
          <SermonNoteForm sermonId={sermon.id} />
          {notes.items.length === 0 ? (
            <p className="text-sm text-slate-400">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.items.map((note) => (
                <li key={note.id} className="rounded-xl border border-white/10 p-3 text-sm">
                  <p className="text-slate-200">{note.body}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatDateTime(note.createdAt)}</span>
                    <ConfirmActionButton
                      action={deleteSermonNoteAction}
                      fields={{ sermonId: sermon.id, noteId: note.id }}
                      pendingLabel="Removing..."
                      confirmMessage="Delete this note?"
                    >
                      Delete
                    </ConfirmActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {canPublish ? (
        <Card>
          <SectionHeading title="Share" />
          <div className="mt-4 space-y-4">
            <SermonShareForm sermonId={sermon.id} />
            {shares.length === 0 ? (
              <p className="text-sm text-slate-400">No share links.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {shares.map((share) => (
                  <li key={share.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all text-slate-300">{share.url}</span>
                    {share.revokedAt ? (
                      <Badge>Revoked</Badge>
                    ) : (
                      <ConfirmActionButton
                        action={revokeSermonShareAction}
                        fields={{ sermonId: sermon.id, shareId: share.id }}
                        pendingLabel="Revoking..."
                        confirmMessage="Revoke this share link?"
                      >
                        Revoke
                      </ConfirmActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {workspace && sermon.status === 'PUBLISHED' && sermon.visibility === 'PUBLIC' ? (
              <p className="text-xs text-slate-500">
                Public permalink: /listen/{workspace.slug}/{sermon.slug}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {recommendations.items.length > 0 ? (
        <Card>
          <SectionHeading title="Related" />
          <ul className="mt-3 space-y-2 text-sm">
            {recommendations.items.map((item) => (
              <li key={item.id}>
                <Link href={`/sermons/${item.id}`} className="text-zion-200 hover:text-white">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <SectionHeading title="Edit" />
          <div className="mt-4">
            <SermonForm series={series} sermon={sermon} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
