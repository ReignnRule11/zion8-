import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MemoryArtifactKind,
  MemoryArtifactStatus,
  memoryArtifactKindSchema,
  memoryArtifactStatusSchema,
  Permission,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Badge,
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Memory' };

const PAGE_SIZE = 24;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

/**
 * The archive browse surface. Everything the church remembers passes through one
 * grid regardless of modality, because kind is an attribute of an artifact, not a
 * separate collection.
 */
export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    kind?: string;
    status?: string;
    tag?: string;
    includeArchived?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.MEMORY_READ)) {
    return <EmptyState message="You do not have permission to view the church archive." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const tag = params.tag?.trim() || undefined;
  const kind = params.kind ? memoryArtifactKindSchema.safeParse(params.kind.toUpperCase()) : null;
  const status = params.status
    ? memoryArtifactStatusSchema.safeParse(params.status.toUpperCase())
    : null;
  const includeArchived = params.includeArchived === 'true';
  const canIngest = can(me, Permission.MEMORY_INGEST);

  const page = await api.listMemoryArtifacts(token, {
    limit,
    offset,
    search,
    tag,
    kind: kind?.success ? kind.data : undefined,
    status: status?.success ? status.data : undefined,
    includeArchived: includeArchived || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Memory"
        description="The church's living archive: photographs, minutes, sermons, bulletins, and letters."
        action={
          canIngest ? (
            <Link
              href="/memory/new"
              className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2 text-sm font-medium text-white transition"
            >
              Add to memory
            </Link>
          ) : undefined
        }
      />

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
              placeholder="Title or description"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="kind" className="text-xs uppercase tracking-wide text-slate-500">
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={kind?.success ? kind.data : ''}
              className={inputClass}
            >
              <option value="">Any kind</option>
              {Object.values(MemoryArtifactKind).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status?.success ? status.data : ''}
              className={inputClass}
            >
              <option value="">Any status</option>
              {Object.values(MemoryArtifactStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tag" className="text-xs uppercase tracking-wide text-slate-500">
              Tag
            </label>
            <input id="tag" name="tag" defaultValue={tag ?? ''} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 py-2.5 text-sm text-slate-300">
            <input
              type="checkbox"
              name="includeArchived"
              value="true"
              defaultChecked={includeArchived}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Archived
          </label>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Apply filters
          </button>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState
          message="Nothing archived here yet."
          hint={canIngest ? 'Add a photograph, a minute book, or a recording to begin.' : undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((artifact) => (
            <li key={artifact.id}>
              <Link
                href={`/memory/${artifact.id}`}
                className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{artifact.title}</p>
                    <StatusBadge status={artifact.status} />
                  </div>
                  {artifact.description ? (
                    <p className="line-clamp-2 text-sm text-slate-400">{artifact.description}</p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {artifact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {artifact.tags.slice(0, 4).map((tagValue) => (
                        <Badge key={tagValue}>{tagValue}</Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="info">{humanize(artifact.kind)}</Badge>
                    <span>
                      {artifact.capturedAt
                        ? `${formatDate(artifact.capturedAt)} · ${humanize(artifact.datePrecision)}`
                        : 'Undated'}
                    </span>
                    {artifact.currentVersion ? (
                      <span>· {formatBytes(artifact.currentVersion.sizeBytes)}</span>
                    ) : null}
                  </div>
                  {artifact.duplicateOfArtifactId ? (
                    <p className="text-xs text-amber-300">Identical bytes already archived.</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/memory"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{
          search,
          tag,
          kind: kind?.success ? kind.data : undefined,
          status: status?.success ? status.data : undefined,
          includeArchived: includeArchived ? 'true' : undefined,
        }}
      />
    </div>
  );
}
