'use client';

import { useActionState, useState } from 'react';
import { MemoryLinkType } from '@zion8/contracts';
import { addMemoryArtifactLinkAction } from '@/app/(dashboard)/memory/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, hintClass, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

const LINK_TYPES = Object.values(MemoryLinkType);

/**
 * Attaching an artifact to the people and structures it belongs to is how a
 * photograph reaches every member in it, and how a sermon reaches a series or a
 * department. Members are chosen from the directory; the other resource kinds
 * are addressed by id until their pickers exist.
 */
export function ArtifactLinkForm({
  artifactId,
  members,
}: {
  artifactId: string;
  members: Array<{ id: string; fullName: string }>;
}) {
  const [state, formAction] = useActionState(addMemoryArtifactLinkAction, initialFormState);
  const [linkType, setLinkType] = useState<string>(MemoryLinkType.MEMBER);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="artifactId" value={artifactId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Link to" htmlFor="artifact-link-type">
          <select
            id="artifact-link-type"
            name="linkType"
            value={linkType}
            onChange={(event) => setLinkType(event.target.value)}
            className={inputClass}
          >
            {LINK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Target" htmlFor="artifact-link-target">
          {linkType === MemoryLinkType.MEMBER ? (
            <select id="artifact-link-target" name="linkId" className={inputClass} required>
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="artifact-link-target"
              name="linkId"
              placeholder="Resource id"
              className={inputClass}
              required
            />
          )}
        </Field>
      </div>

      {linkType !== MemoryLinkType.MEMBER ? (
        <p className={hintClass}>
          Paste the id of the family, department, visitor, or other resource this artifact belongs
          to.
        </p>
      ) : null}

      <SubmitButton pendingLabel="Linking..." variant="secondary">
        Add link
      </SubmitButton>
    </form>
  );
}
