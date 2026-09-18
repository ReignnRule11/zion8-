'use client';

import { archiveDocumentAction } from '@/app/(dashboard)/people/actions';
import { ConfirmActionButton } from './confirm-action-button';

export function DocumentRowActions({
  memberId,
  documentId,
}: {
  memberId: string;
  documentId: string;
}) {
  return (
    <ConfirmActionButton
      action={archiveDocumentAction}
      fields={{ memberId, documentId }}
      pendingLabel="Archiving..."
      confirmMessage="Archive this document? It will no longer be downloadable."
      variant="secondary"
    >
      Archive
    </ConfirmActionButton>
  );
}
