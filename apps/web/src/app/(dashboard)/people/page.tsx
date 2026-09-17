import type { Metadata } from 'next';
import Link from 'next/link';
import { MemberStatus, memberStatusSchema, Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, humanize } from '@/lib/format';
import { loadPrincipal, can } from '@/lib/principal';
import {
  Avatar,
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Members' };

const PAGE_SIZE = 25;

interface DirectorySearchParams {
  search?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

function parseFilters(params: DirectorySearchParams) {
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const status = params.status ? memberStatusSchema.safeParse(params.status.toUpperCase()) : null;
  const search = params.search?.trim() || undefined;
  return { limit, offset, search, status: status?.success ? status.data : undefined };
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<DirectorySearchParams>;
}) {
  const { token, me } = await loadPrincipal();
  const params = await searchParams;
  const filters = parseFilters(params);

  if (!can(me, Permission.MEMBER_READ)) {
    return <EmptyState message="You do not have permission to view the member directory." />;
  }

  const page = await api.listMembers(token, {
    limit: filters.limit,
    offset: filters.offset,
    search: filters.search,
    status: filters.status,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description={`${page.total} ${page.total === 1 ? 'person' : 'people'} in this church`}
        action={
          can(me, Permission.MEMBER_CREATE) ? (
            <Link
              href="/people/new"
              className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
            >
              Add member
            </Link>
          ) : null
        }
      />

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <label htmlFor="search" className="text-xs uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              id="search"
              name="search"
              defaultValue={filters.search ?? ''}
              placeholder="Name, email, or phone"
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
              defaultValue={filters.status ?? ''}
              className={inputClass}
            >
              <option value="">Any status</option>
              {Object.values(MemberStatus).map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </div>
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
          message="No members match these filters."
          hint="Try clearing the search, or add the first member."
        />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((member) => (
            <li key={member.id}>
              <Link
                href={`/people/${member.id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <Avatar
                  firstName={member.firstName}
                  lastName={member.lastName ?? ''}
                  photoUrl={member.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{member.fullName}</p>
                  <p className="truncate text-sm text-slate-400">
                    {[member.email, member.phone].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-slate-400 sm:block">
                  <p>Joined {formatDate(member.joinedAt)}</p>
                  <p>
                    {member.familyCount} families · {member.departmentCount} departments
                  </p>
                </div>
                <StatusBadge status={member.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/people"
        limit={filters.limit}
        offset={filters.offset}
        total={page.total}
        filters={{ search: filters.search, status: filters.status }}
      />
    </div>
  );
}
