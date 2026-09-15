import { z } from 'zod';

export const Role = {
  CHURCH_OWNER: 'CHURCH_OWNER',
  SENIOR_PASTOR: 'SENIOR_PASTOR',
  ADMINISTRATOR: 'ADMINISTRATOR',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  MINISTRY_LEADER: 'MINISTRY_LEADER',
  VOLUNTEER: 'VOLUNTEER',
  MEMBER: 'MEMBER',
  VISITOR: 'VISITOR',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const roleSchema = z.enum(Object.values(Role) as [Role, ...Role[]]);

export const roleRank: Readonly<Record<Role, number>> = {
  [Role.CHURCH_OWNER]: 100,
  [Role.SENIOR_PASTOR]: 90,
  [Role.ADMINISTRATOR]: 80,
  [Role.FINANCE_OFFICER]: 70,
  [Role.MINISTRY_LEADER]: 60,
  [Role.VOLUNTEER]: 40,
  [Role.MEMBER]: 20,
  [Role.VISITOR]: 10,
};

export function outranks(actor: Role, target: Role): boolean {
  return roleRank[actor] > roleRank[target];
}

export const MembershipStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const membershipStatusSchema = z.enum(
  Object.values(MembershipStatus) as [MembershipStatus, ...MembershipStatus[]],
);
