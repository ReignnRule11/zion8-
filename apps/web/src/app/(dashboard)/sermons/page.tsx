import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Permission,
  SermonStatus,
  SermonVisibility,
  sermonStatusSchema,
  sermonVisibilitySchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
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

export const metadata: Metadata = { title: 'Sermons' };

const PAGE_SIZE = 24;

export default async function SermonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    visibility?: string;
    speaker?: string;
    tag?: string;
    includeArchived?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.SERMON_READ)) {
    return <EmptyState message="You do not have permission to view sermons." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const speaker = params.speaker?.trim() || undefined;
  const tag = params.tag?.trim() || undefined;
  const status = params.status ? sermonStatusSchema.safeParse(params.status.toUpperCase()) : null;
  const visibility = params.visibility
    ? sermonVisibilitySchema.safeParse(params.visibility.toUpperCase())
    : null;
  const includeArchived = params.includeArchived === 'true';
  const canManage = can(me, Permission.SERMON_MANAGE);

  const page = await api.listSermons(token, {
    limit,
    offset,
    search,
    speaker,
    tag,
    status: status?.success ? status.data : undefined,
    visibility: visibility?.success ? visibility.data : undefined,
    includeArchived: includeArchived || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sermons"
        description="Teachings, transcripts, chapters and the public podcast feed."
        action={
          canManage ? (
            <div className="flex gap-2">
              <Link
                href="/sermons/series"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30"
              >
                Series
              </Link>
              <Link
                href="/sermons/new"
                className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2 text-sm font-medium text-white transition"
              >
                New sermon
              </Link>
            </div>
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
              placeholder="Title, speaker or series"
              className={inputClass}
            />
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
              {Object.values(SermonStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="visibility" className="text-xs uppercase tracking-wide text-slate-500">
              Visibility
            </label>
            <select
              id="visibility"
              name="visibility"
              defaultValue={visibility?.success ? visibility.data : ''}
              className={inputClass}
            >
              <option value="">Any visibility</option>
              {Object.values(SermonVisibility).map((value) => (
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
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
          >
            Filter
          </button>
          <Link href="/sermons/search" className="py-2 text-sm text-zion-200 hover:text-white">
            Full-text search
          </Link>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState
          message="No sermons yet."
          hint={canManage ? 'Create a sermon with a transcript or a recording to start the study surface.' : undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {page.items.map((sermon) => (
            <li key={sermon.id}>
              <Link
                href={`/sermons/${sermon.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold tracking-tight">{sermon.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {sermon.speakerName ?? 'Unknown speaker'}
                      {sermon.preachedAt ? ` · ${formatDateTime(sermon.preachedAt)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={sermon.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{humanize(sermon.mediaKind)}</Badge>
                  {sermon.series ? <Badge tone="info">{sermon.series.title}</Badge> : null}
                  {sermon.tags.slice(0, 4).map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/sermons"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{
          search,
          status: status?.success ? status.data : undefined,
          visibility: visibility?.success ? visibility.data : undefined,
          speaker,
          tag,
          includeArchived: includeArchived ? 'true' : undefined,
        }}
      />
    </div>
  );
}
