'use client';

import { removeRelationshipFromGraphAction } from '@/app/(dashboard)/community/actions';
import { ConfirmActionButton } from './confirm-action-button';

export function RemoveRelationshipGraphButton({ relationshipId }: { relationshipId: string }) {
  return (
    <ConfirmActionButton
      action={removeRelationshipFromGraphAction}
      fields={{ relationshipId }}
      pendingLabel="Removing..."
      confirmMessage="Remove this relationship?"
      variant="secondary"
    >
      Remove
    </ConfirmActionButton>
  );
}
