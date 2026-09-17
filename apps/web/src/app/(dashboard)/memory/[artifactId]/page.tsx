import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { archiveMemoryArtifactAction, removeMemoryArtifactLinkAction } from '../actions';
import {
  Badge,
  Card,
  DefinitionList,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { ArtifactDetailsForm } from '@/components/memory/artifact-details-form';
import { ArtifactLinkForm } from '@/components/memory/artifact-link-form';
import { ArtifactReprocessForm } from '@/components/memory/artifact-reprocess-form';

export const metadata: Metadata = { title: 'Artifact' };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { artifactId } = await params;

  if (!can(me, Permission.MEMORY_READ)) {
    return <EmptyState message="You do not have permission to view the church archive." />;
  }

  let artifact;
  let jobs;
  try {
    [artifact, jobs] = await Promise.all([
      api.getMemoryArtifact(token, artifactId),
      api.listMemoryJobs(token, artifactId),
    ]);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'MEMORY_ARTIFACT_NOT_FOUND') notFound();
    throw error;
  }

  const canCurate = can(me, Permission.MEMORY_CURATE);
  const members = canCurate
    ? (await api.listMembers(token, { limit: 200, offset: 0 })).items.map((member) => ({
        id: member.id,
        fullName: member.fullName,
      }))
    : [];
  const current = artifact.currentVersion;

  return (
    <div className="space-y-6">
      <Link href="/memory" className="text-sm text-slate-400 transition hover:text-slate-200">
        ← Back to memory
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{artifact.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {humanize(artifact.kind)}
            {artifact.capturedAt
              ? ` · ${formatDate(artifact.capturedAt)} (${humanize(artifact.datePrecision)})`
              : ' · undated'}
            {' · '}
            {humanize(artifact.origin)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={artifact.status} />
          {canCurate && artifact.status !== 'ARCHIVED' ? (
            <ConfirmActionButton
              action={archiveMemoryArtifactAction}
              fields={{ artifactId: artifact.id }}
              pendingLabel="Archiving..."
              confirmMessage="Archive this artifact? It leaves the active archive but its history is kept."
            >
              Archive
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      {artifact.duplicateOfArtifactId ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          These bytes are already archived as{' '}
          <Link href={`/memory/${artifact.duplicateOfArtifactId}`} className="underline">
            another artifact
          </Link>
          . Content is content-addressed, so no duplicate copy was stored.
        </div>
      ) : null}

      {artifact.description ? (
        <Card>
          <p className="text-sm text-slate-300">{artifact.description}</p>
        </Card>
      ) : null}

      <Card>
        <SectionHeading
          title="Current version"
          action={
            current ? (
              <a
                href={`/api/memory/artifacts/${artifact.id}/content`}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Download
              </a>
            ) : undefined
          }
        />
        <div className="mt-4">
          {current ? (
            <DefinitionList
              items={[
                { term: 'File name', value: current.fileName },
                { term: 'Size', value: formatBytes(current.sizeBytes) },
                {
                  term: 'Content type',
                  value: current.detectedContentType ?? current.declaredContentType,
                },
                { term: 'Version', value: String(current.version) },
                { term: 'Checksum', value: `${current.sha256.slice(0, 16)}…` },
                { term: 'Stored', value: formatDateTime(current.createdAt) },
              ]}
            />
          ) : (
            <p className="text-sm text-slate-400">No stored version yet.</p>
          )}
        </div>
      </Card>

      {artifact.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {artifact.tags.map((tag) => (
            <Badge key={tag} tone="info">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        <SectionHeading
          title="Links"
          description="What this artifact belongs to — the people, teams, and events it touches."
        />
        <ul className="mt-4 divide-y divide-white/10">
          {artifact.links.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">Not linked to anything yet.</li>
          ) : (
            artifact.links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Badge>{humanize(link.linkType)}</Badge>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">{link.linkId}</p>
                </div>
                {canCurate ? (
                  <ConfirmActionButton
                    action={removeMemoryArtifactLinkAction}
                    fields={{ artifactId: artifact.id, linkId: link.id }}
                    pendingLabel="Removing..."
                    confirmMessage="Remove this link?"
                    variant="secondary"
                  >
                    Remove
                  </ConfirmActionButton>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {canCurate ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <ArtifactLinkForm artifactId={artifact.id} members={members} />
          </div>
        ) : null}
      </Card>

      {canCurate ? (
        <Card>
          <SectionHeading
            title="Details"
            description="Human corrections are authoritative; the archived bytes never change."
          />
          <div className="mt-4">
            <ArtifactDetailsForm artifact={artifact} />
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeading
          title="Processing"
          description="What the engine has done, is doing, or is waiting on."
        />
        <ul className="mt-4 divide-y divide-white/10">
          {jobs.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">No processing jobs recorded.</li>
          ) : (
            jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{humanize(job.type)}</p>
                  <p className="text-xs text-slate-500">
                    Attempt {job.attempts} of {job.maxAttempts}
                    {job.provider ? ` · ${job.provider}` : ''}
                    {job.blockedReason ? ` · ${humanize(job.blockedReason)}` : ''}
                    {job.lastError ? ` · ${job.lastError}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{formatDateTime(job.completedAt)}</span>
                  <StatusBadge status={job.status} />
                </div>
              </li>
            ))
          )}
        </ul>
        {canCurate ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <ArtifactReprocessForm artifactId={artifact.id} />
          </div>
        ) : null}
      </Card>

      {artifact.versions.length > 1 ? (
        <Card>
          <SectionHeading
            title="Version history"
            description="Immutable, content-addressed copies."
          />
          <ul className="mt-4 divide-y divide-white/10">
            {artifact.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    v{version.version} · {version.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(version.sizeBytes)} ·{' '}
                    {version.detectedContentType ?? version.declaredContentType} ·{' '}
                    {formatDateTime(version.createdAt)}
                    {version.isCurrent ? ' · current' : ''}
                  </p>
                </div>
                <a
                  href={`/api/memory/artifacts/${artifact.id}/content?versionId=${version.id}`}
                  className="hover:text-zion-200 text-sm text-slate-300 transition"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
