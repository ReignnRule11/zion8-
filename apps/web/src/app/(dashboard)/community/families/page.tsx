import type { Metadata } from 'next';
import Link from 'next/link';
import { FamilyStatus, familyStatusSchema, Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { createFamilyAction } from '../actions';
import {
  Badge,
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { FamilyForm } from '@/components/membership/family-form';

export const metadata: Metadata = { title: 'Families' };

const PAGE_SIZE = 25;

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.FAMILY_READ)) {
    return <EmptyState message="You do not have permission to view families." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const status = params.status ? familyStatusSchema.safeParse(params.status.toUpperCase()) : null;

  const page = await api.listFamilies(token, {
    limit,
    offset,
    search,
    status: status?.success ? status.data : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Families"
        description="Households the church visits, cares for, and records giving against."
      />

      {can(me, Permission.FAMILY_MANAGE) ? (
        <Card>
          <SectionHeading title="Create a family" />
          <div className="mt-4">
            <FamilyForm />
          </div>
        </Card>
      ) : null}

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <label htmlFor="search" className="text-xs uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              id="search"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Family name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select id="status" name="status" defaultValue={status?.success ? status.data : ''} className={inputClass}>
              <option value="">Any status</option>
              {Object.values(FamilyStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
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
        <EmptyState message="No families yet." hint="Create a family to group a household." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((family) => (
            <li key={family.id}>
              <Link
                href={`/community/families/${family.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{family.name}</p>
                  <p className="text-sm text-slate-400">{family.city ?? 'No city recorded'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="info">
                    {family.memberCount} {family.memberCount === 1 ? 'member' : 'members'}
                  </Badge>
                  <StatusBadge status={family.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/community/families"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{ search, status: status?.success ? status.data : undefined }}
      />
    </div>
  );
}
