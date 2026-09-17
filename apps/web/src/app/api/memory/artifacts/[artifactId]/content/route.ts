import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/env';
import { getAccessToken } from '@/lib/session';

/**
 * Streams archived memory bytes through the web origin.
 *
 * The API requires a bearer token for artifact content, and a browser anchor
 * cannot attach one. This handler reads the httpOnly session cookie, calls the
 * API, and pipes the response back so downloads stay same-origin and
 * authenticated. An optional `versionId` selects a stored version.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in to download this artifact.' } },
      { status: 401 },
    );
  }

  const { artifactId } = await params;
  const versionId = new URL(request.url).searchParams.get('versionId');
  const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';

  const upstream = await fetch(
    `${apiBaseUrl}/memory/artifacts/${encodeURIComponent(artifactId)}/content${query}`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') ?? 'application/octet-stream');
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
