import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState, PageHeader } from '@/components/membership/ui';
import { SermonForm } from '@/components/sermon/sermon-form';

export const metadata: Metadata = { title: 'New sermon' };

export default async function NewSermonPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.SERMON_MANAGE)) {
    return <EmptyState message="You do not have permission to create sermons." />;
  }
  const series = await api.listSermonSeries(token, { limit: 200, offset: 0 });

  return (
    <div className="space-y-6">
      <Link href="/sermons" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to sermons
      </Link>
      <PageHeader
        title="New sermon"
        description="Metadata lives here. Recordings are stored in Memory; Zion AI derives the study surface."
      />
      <Card>
        <SermonForm series={series.items} />
      </Card>
    </div>
  );
}
