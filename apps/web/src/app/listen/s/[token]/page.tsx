import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Card } from '@/components/membership/ui';
import { SermonPlayer } from '@/components/sermon/sermon-player';

export const metadata: Metadata = { title: 'Shared sermon' };
export const dynamic = 'force-dynamic';

export default async function SharedSermonPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let sermon;
  try {
    sermon = await api.getSharedSermon(token);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.code === 'SERMON_SHARE_NOT_FOUND' ||
        error.code === 'SERMON_SHARE_REVOKED' ||
        error.code === 'SERMON_SHARE_EXPIRED' ||
        error.code === 'SERMON_NOT_FOUND')
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 px-6 py-12">
      <p className="text-sm text-slate-400">Shared sermon</p>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{sermon.title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {sermon.speakerName ?? 'Unknown speaker'}
          {sermon.preachedAt ? ` · ${formatDateTime(sermon.preachedAt)}` : ''}
        </p>
      </header>
      {sermon.media.url ? (
        <Card>
          <SermonPlayer media={sermon.media} chapters={sermon.chapters} />
        </Card>
      ) : null}
      {sermon.insight.summary ? (
        <Card>
          <p className="text-sm leading-6 text-slate-200">{sermon.insight.summary}</p>
        </Card>
      ) : null}
      {sermon.transcript ? (
        <Card>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
            {sermon.transcript.text}
          </pre>
        </Card>
      ) : null}
    </main>
  );
}
