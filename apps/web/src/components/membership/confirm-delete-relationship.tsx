'use client';

import { removeRelationshipAction } from '@/app/(dashboard)/people/actions';
import { ConfirmActionButton } from './confirm-action-button';

export function ConfirmDeleteRelationship({
  memberId,
  relationshipId,
}: {
  memberId: string;
  relationshipId: string;
}) {
  return (
    <ConfirmActionButton
      action={removeRelationshipAction}
      fields={{ memberId, relationshipId }}
      pendingLabel="Removing..."
      confirmMessage="Remove this relationship?"
      variant="secondary"
    >
      Remove
    </ConfirmActionButton>
  );
}
