import type { Metadata } from 'next';
import Link from 'next/link';
import { DepartmentKind, departmentKindSchema, Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { createDepartmentAction } from '../actions';
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
import { DepartmentForm } from '@/components/membership/department-form';

export const metadata: Metadata = { title: 'Departments' };

const PAGE_SIZE = 25;

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; kind?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.DEPARTMENT_READ)) {
    return <EmptyState message="You do not have permission to view departments." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const kind = params.kind ? departmentKindSchema.safeParse(params.kind.toUpperCase()) : null;
  const canManage = can(me, Permission.DEPARTMENT_MANAGE);

  const [page, memberPage] = await Promise.all([
    api.listDepartments(token, {
      limit,
      offset,
      search,
      kind: kind?.success ? kind.data : undefined,
    }),
    canManage
      ? api.listMembers(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] as Array<{ id: string; fullName: string }> }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="The teams that run the church: ushering, choir, media, children."
      />

      {canManage ? (
        <Card>
          <SectionHeading title="Create a department" />
          <div className="mt-4">
            <DepartmentForm
              members={memberPage.items.map((member) => ({
                id: member.id,
                fullName: member.fullName,
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
              placeholder="Department name"
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
              {Object.values(DepartmentKind).map((value) => (
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
        <EmptyState message="No departments yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((department) => (
            <li key={department.id}>
              <Link
                href={`/community/departments/${department.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{department.name}</p>
                  <p className="truncate text-sm text-slate-400">
                    {department.leaderName ? `Led by ${department.leaderName}` : 'No leader assigned'}
                    {department.meetingDay
                      ? ` · meets ${humanize(department.meetingDay)}${
                          department.meetingTime ? ` at ${department.meetingTime}` : ''
                        }`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="info">{department.memberCount} serving</Badge>
                  <Badge>{humanize(department.kind)}</Badge>
                  <StatusBadge status={department.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/community/departments"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{ search, kind: kind?.success ? kind.data : undefined }}
      />
    </div>
  );
}
