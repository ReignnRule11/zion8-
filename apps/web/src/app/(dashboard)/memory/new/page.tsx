import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState } from '@/components/membership/ui';
import { ArtifactUploadForm } from '@/components/memory/artifact-upload-form';

export const metadata: Metadata = { title: 'Add to memory' };

export default async function NewArtifactPage() {
  const { me } = await loadPrincipal();

  if (!can(me, Permission.MEMORY_INGEST)) {
    return <EmptyState message="You do not have permission to add to the church archive." />;
  }

  return (
    <div className="space-y-6">
      <Link href="/memory" className="text-sm text-slate-400 transition hover:text-slate-200">
        ← Back to memory
      </Link>

      <Card>
        <ArtifactUploadForm />
      </Card>
    </div>
  );
}
