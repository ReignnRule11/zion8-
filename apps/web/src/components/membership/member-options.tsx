export interface MemberOption {
  id: string;
  fullName: string;
}

/** Renders the `<option>` list for a member picker, optionally excluding one member. */
export function MemberOptions({
  members,
  excludeId,
}: {
  members: MemberOption[];
  excludeId?: string;
}) {
  return (
    <>
      {members
        .filter((member) => member.id !== excludeId)
        .map((member) => (
          <option key={member.id} value={member.id}>
            {member.fullName}
          </option>
        ))}
    </>
  );
}
