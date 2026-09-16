import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission, VolunteerCommitment, volunteerCommitmentSchema } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { createVolunteerRoleAction } from '../actions';
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
import { VolunteerRoleForm } from '@/components/membership/volunteer-role-form';

export const metadata: Metadata = { title: 'Volunteers' };

const PAGE_SIZE = 25;

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; commitment?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.VOLUNTEER_READ)) {
    return <EmptyState message="You do not have permission to view volunteers." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const commitment = params.commitment
    ? volunteerCommitmentSchema.safeParse(params.commitment.toUpperCase())
    : null;
  const canManage = can(me, Permission.VOLUNTEER_MANAGE);

  const [page, departmentPage] = await Promise.all([
    api.listVolunteerRoles(token, {
      limit,
      offset,
      search,
      commitment: commitment?.success ? commitment.data : undefined,
    }),
    canManage
      ? api.listDepartments(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] as Array<{ id: string; name: string }> }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volunteers"
        description="The roles a church needs filled, and who is currently serving in them."
      />

      {canManage ? (
        <Card>
          <SectionHeading title="Create a role" />
          <div className="mt-4">
            <VolunteerRoleForm
              departments={departmentPage.items.map((department) => ({
                id: department.id,
                name: department.name,
              }))}
            />
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
              placeholder="Role name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="commitment" className="text-xs uppercase tracking-wide text-slate-500">
              Commitment
            </label>
            <select
              id="commitment"
              name="commitment"
              defaultValue={commitment?.success ? commitment.data : ''}
              className={inputClass}
            >
              <option value="">Any commitment</option>
              {Object.values(VolunteerCommitment).map((value) => (
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
        <EmptyState message="No volunteer roles yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((role) => (
            <li key={role.id}>
              <Link
                href={`/community/volunteers/${role.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{role.name}</p>
                  <p className="truncate text-sm text-slate-400">
                    {role.departmentName ?? 'No department'} · {humanize(role.commitment)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={role.openSlots > 0 ? 'warning' : 'success'}>
                    {role.activeCount}/{role.requiredCount} filled
                  </Badge>
                  {role.requiresBackgroundCheck ? <Badge>Check required</Badge> : null}
                  <StatusBadge status={role.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/community/volunteers"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{ search, commitment: commitment?.success ? commitment.data : undefined }}
      />
    </div>
  );
}
