import { describe, expect, it } from 'vitest';
import {
  Permission,
  permissionsForRole,
  roleHasAllPermissions,
  roleHasAnyPermission,
  roleHasPermission,
  rolePermissions,
} from './permissions';
import { Role, outranks, roleSchema } from './roles';

const allPermissions = Object.values(Permission);

describe('role permissions', () => {
  it('grants the church owner every declared permission', () => {
    expect(roleHasAllPermissions(Role.CHURCH_OWNER, allPermissions)).toBe(true);
  });

  it('only references declared permission values', () => {
    const declared = new Set<string>(allPermissions);
    for (const role of Object.values(Role)) {
      for (const permission of rolePermissions[role]) {
        expect(declared.has(permission)).toBe(true);
      }
    }
  });

  it('allows every role to read the tenant workspace', () => {
    for (const role of Object.values(Role)) {
      expect(roleHasPermission(role, Permission.TENANT_READ)).toBe(true);
    }
  });

  it('restricts finance capabilities away from administrators', () => {
    expect(roleHasPermission(Role.FINANCE_OFFICER, Permission.GIVING_RECORD)).toBe(true);
    expect(roleHasPermission(Role.ADMINISTRATOR, Permission.GIVING_RECORD)).toBe(false);
    expect(roleHasPermission(Role.ADMINISTRATOR, Permission.ACCOUNTING_CLOSE_PERIOD)).toBe(false);
  });

  it('prevents members from moderating content or managing people', () => {
    expect(roleHasPermission(Role.MEMBER, Permission.SERMON_PUBLISH)).toBe(false);
    expect(roleHasPermission(Role.MEMBER, Permission.MEMBER_ARCHIVE)).toBe(false);
    expect(roleHasPermission(Role.MEMBER, Permission.PRAYER_SUBMIT)).toBe(true);
  });

  it('keeps visitors read-only', () => {
    const visitor = permissionsForRole(Role.VISITOR);
    expect(visitor).toContain(Permission.EVENT_READ);
    expect(roleHasPermission(Role.VISITOR, Permission.MEMBER_CREATE)).toBe(false);
    expect(roleHasPermission(Role.VISITOR, Permission.GIVING_READ)).toBe(false);
  });

  it('returns sorted, de-duplicated permission lists', () => {
    const list = permissionsForRole(Role.SENIOR_PASTOR);
    expect(list).toEqual([...new Set(list)].sort());
  });

  it('evaluates any/all helpers correctly', () => {
    expect(
      roleHasAnyPermission(Role.VOLUNTEER, [Permission.GIVING_READ, Permission.EVENT_READ]),
    ).toBe(true);
    expect(
      roleHasAllPermissions(Role.VOLUNTEER, [Permission.GIVING_READ, Permission.EVENT_READ]),
    ).toBe(false);
  });

  it('orders roles by administrative authority', () => {
    expect(outranks(Role.CHURCH_OWNER, Role.SENIOR_PASTOR)).toBe(true);
    expect(outranks(Role.SENIOR_PASTOR, Role.FINANCE_OFFICER)).toBe(true);
    expect(outranks(Role.VOLUNTEER, Role.MEMBER)).toBe(true);
    expect(outranks(Role.MEMBER, Role.CHURCH_OWNER)).toBe(false);
  });

  it('exposes a schema that accepts every role and rejects unknown ones', () => {
    for (const role of Object.values(Role)) {
      expect(roleSchema.safeParse(role).success).toBe(true);
    }
    expect(roleSchema.safeParse('SUPER_USER').success).toBe(false);
  });
});
