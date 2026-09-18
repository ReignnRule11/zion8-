import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/env';
import { getAccessToken } from '@/lib/session';

/**
 * Streams a member document through the web origin.
 *
 * The API requires a bearer token for document bytes, and a browser anchor
 * cannot attach one. Rather than expose the token to the client, this handler
 * reads the httpOnly session cookie, calls the API, and pipes the response back
 * so downloads stay same-origin and authenticated.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in to download this document.' } },
      { status: 401 },
    );
  }

  const { documentId } = await params;
  const upstream = await fetch(
    `${apiBaseUrl}/membership/documents/${encodeURIComponent(documentId)}/content`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  const headers = new Headers();
  headers.set(
    'content-type',
    upstream.headers.get('content-type') ?? 'application/octet-stream',
  );
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
