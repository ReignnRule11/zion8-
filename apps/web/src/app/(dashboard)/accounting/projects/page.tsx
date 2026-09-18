import type { Metadata } from 'next';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { ProjectForm } from '@/components/accounting/budget-forms';
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view projects." />;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const [projects, accounts] = await Promise.all([
    api.listProjects(token, { limit: 50, offset: 0 }),
    canManage ? api.listAccounts(token, { limit: 200, offset: 0 }) : Promise.resolve({ items: [] as Awaited<ReturnType<typeof api.listAccounts>>['items'] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Capital and ministry projects with a budget envelope and spend to date." />

      {canManage ? (
        <Card>
          <SectionHeading title="New project" />
          <div className="mt-4">
            <ProjectForm accounts={accounts.items} />
          </div>
        </Card>
      ) : null}

      {projects.items.length === 0 ? (
        <EmptyState message="No projects yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {projects.items.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-medium">{project.name}</p>
                <p className="text-sm text-slate-400">
                  Spent {formatMoney(project.spentMinor)} of {formatMoney(project.budgetMinor)} · remaining{' '}
                  {formatMoney(project.remainingMinor)}
                </p>
              </div>
              <StatusBadge status={project.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
