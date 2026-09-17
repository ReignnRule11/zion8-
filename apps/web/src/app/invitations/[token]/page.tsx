import type { Metadata } from 'next';
import Link from 'next/link';
import type { InvitationPreview } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { AcceptInvitationForm } from '@/components/accept-invitation-form';

export const metadata: Metadata = { title: 'Join a church workspace' };
export const dynamic = 'force-dynamic';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let preview: InvitationPreview | null = null;
  let errorMessage: string | null = null;
  try {
    preview = await api.previewInvitation(token);
  } catch (error) {
    errorMessage =
      error instanceof ApiRequestError
        ? error.message
        : 'This invitation could not be loaded. Please ask for a new link.';
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>

      {preview ? (
        <>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Join {preview.tenantName}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {preview.invitedByName
              ? `${preview.invitedByName} invited you`
              : 'You have been invited'}{' '}
            to join as {preview.role.replaceAll('_', ' ').toLowerCase()}.
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <AcceptInvitationForm preview={preview} token={token} />
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {errorMessage}
          </p>
          <Link
            href="/sign-in"
            className="text-zion-300 hover:text-zion-200 mt-6 text-sm font-medium"
          >
            Go to sign in
          </Link>
        </>
      )}
    </main>
  );
}
