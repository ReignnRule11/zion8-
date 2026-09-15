import { z } from 'zod';
import { Role } from './roles';

export const Permission = {
  TENANT_READ: 'tenant:read',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',

  USER_READ: 'user:read',
  USER_INVITE: 'user:invite',
  USER_UPDATE: 'user:update',
  USER_SUSPEND: 'user:suspend',
  ROLE_ASSIGN: 'role:assign',

  MEMBER_READ: 'member:read',
  MEMBER_CREATE: 'member:create',
  MEMBER_UPDATE: 'member:update',
  MEMBER_ARCHIVE: 'member:archive',

  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_RECORD: 'attendance:record',
  ATTENDANCE_MANAGE: 'attendance:manage',

  EVENT_READ: 'event:read',
  EVENT_CREATE: 'event:create',
  EVENT_UPDATE: 'event:update',
  EVENT_DELETE: 'event:delete',

  MINISTRY_READ: 'ministry:read',
  MINISTRY_MANAGE: 'ministry:manage',

  VOLUNTEER_READ: 'volunteer:read',
  VOLUNTEER_MANAGE: 'volunteer:manage',

  GIVING_READ: 'giving:read',
  GIVING_RECORD: 'giving:record',
  GIVING_REFUND: 'giving:refund',

  ACCOUNTING_READ: 'accounting:read',
  ACCOUNTING_MANAGE: 'accounting:manage',
  ACCOUNTING_CLOSE_PERIOD: 'accounting:close-period',

  PRAYER_READ: 'prayer:read',
  PRAYER_SUBMIT: 'prayer:submit',
  PRAYER_RESPOND: 'prayer:respond',

  COUNSELING_READ: 'counseling:read',
  COUNSELING_REQUEST: 'counseling:request',
  COUNSELING_MANAGE: 'counseling:manage',

  SERMON_READ: 'sermon:read',
  SERMON_PUBLISH: 'sermon:publish',
  SERMON_MANAGE: 'sermon:manage',

  ARCHIVE_READ: 'archive:read',
  ARCHIVE_UPLOAD: 'archive:upload',
  ARCHIVE_MANAGE: 'archive:manage',

  MEMORY_QUERY: 'memory:query',
  MEMORY_CURATE: 'memory:curate',

  WEBSITE_READ: 'website:read',
  WEBSITE_MANAGE: 'website:manage',
  WEBSITE_PUBLISH: 'website:publish',

  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_SEND: 'notification:send',

  REPORT_READ: 'report:read',
  ANALYTICS_VIEW: 'analytics:view',

  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const permissionSchema = z.enum(Object.values(Permission) as [Permission, ...Permission[]]);

const FINANCE_PERMISSIONS: readonly Permission[] = [
  Permission.GIVING_READ,
  Permission.GIVING_RECORD,
  Permission.GIVING_REFUND,
  Permission.ACCOUNTING_READ,
  Permission.ACCOUNTING_MANAGE,
  Permission.ACCOUNTING_CLOSE_PERIOD,
];

const OPERATIONAL_PERMISSIONS: readonly Permission[] = [
  Permission.USER_READ,
  Permission.USER_INVITE,
  Permission.USER_UPDATE,
  Permission.USER_SUSPEND,
  Permission.ROLE_ASSIGN,
  Permission.MEMBER_READ,
  Permission.MEMBER_CREATE,
  Permission.MEMBER_UPDATE,
  Permission.MEMBER_ARCHIVE,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_MANAGE,
  Permission.EVENT_READ,
  Permission.EVENT_CREATE,
  Permission.EVENT_UPDATE,
  Permission.EVENT_DELETE,
  Permission.MINISTRY_READ,
  Permission.MINISTRY_MANAGE,
  Permission.VOLUNTEER_READ,
  Permission.VOLUNTEER_MANAGE,
  Permission.PRAYER_READ,
  Permission.PRAYER_RESPOND,
  Permission.COUNSELING_READ,
  Permission.COUNSELING_MANAGE,
  Permission.SERMON_READ,
  Permission.SERMON_MANAGE,
  Permission.ARCHIVE_READ,
  Permission.ARCHIVE_UPLOAD,
  Permission.ARCHIVE_MANAGE,
  Permission.MEMORY_QUERY,
  Permission.WEBSITE_READ,
  Permission.WEBSITE_MANAGE,
  Permission.NOTIFICATION_READ,
  Permission.NOTIFICATION_SEND,
  Permission.REPORT_READ,
];

const MEMBER_PERMISSIONS: readonly Permission[] = [
  Permission.TENANT_READ,
  Permission.MEMBER_READ,
  Permission.EVENT_READ,
  Permission.MINISTRY_READ,
  Permission.SERMON_READ,
  Permission.ARCHIVE_READ,
  Permission.MEMORY_QUERY,
  Permission.PRAYER_SUBMIT,
  Permission.COUNSELING_REQUEST,
  Permission.NOTIFICATION_READ,
  Permission.WEBSITE_READ,
];

const VISITOR_PERMISSIONS: readonly Permission[] = [
  Permission.TENANT_READ,
  Permission.EVENT_READ,
  Permission.SERMON_READ,
  Permission.WEBSITE_READ,
];

export const rolePermissions: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  [Role.CHURCH_OWNER]: new Set(Object.values(Permission)),
  [Role.SENIOR_PASTOR]: new Set([
    ...OPERATIONAL_PERMISSIONS,
    ...FINANCE_PERMISSIONS,
    Permission.TENANT_READ,
    Permission.TENANT_UPDATE,
    Permission.SERMON_PUBLISH,
    Permission.MEMORY_CURATE,
    Permission.WEBSITE_PUBLISH,
    Permission.ANALYTICS_VIEW,
    Permission.AUDIT_READ,
  ]),
  [Role.ADMINISTRATOR]: new Set([
    ...OPERATIONAL_PERMISSIONS,
    Permission.TENANT_READ,
    Permission.SERMON_PUBLISH,
    Permission.WEBSITE_PUBLISH,
    Permission.ANALYTICS_VIEW,
  ]),
  [Role.FINANCE_OFFICER]: new Set([
    ...FINANCE_PERMISSIONS,
    Permission.TENANT_READ,
    Permission.MEMBER_READ,
    Permission.REPORT_READ,
    Permission.ANALYTICS_VIEW,
    Permission.AUDIT_READ,
  ]),
  [Role.MINISTRY_LEADER]: new Set([
    Permission.TENANT_READ,
    Permission.MEMBER_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_RECORD,
    Permission.EVENT_READ,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,
    Permission.MINISTRY_READ,
    Permission.VOLUNTEER_READ,
    Permission.VOLUNTEER_MANAGE,
    Permission.PRAYER_READ,
    Permission.PRAYER_RESPOND,
    Permission.SERMON_READ,
    Permission.ARCHIVE_READ,
    Permission.ARCHIVE_UPLOAD,
    Permission.MEMORY_QUERY,
    Permission.NOTIFICATION_READ,
    Permission.NOTIFICATION_SEND,
    Permission.REPORT_READ,
  ]),
  [Role.VOLUNTEER]: new Set([
    Permission.TENANT_READ,
    Permission.MEMBER_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_RECORD,
    Permission.EVENT_READ,
    Permission.MINISTRY_READ,
    Permission.PRAYER_READ,
    Permission.SERMON_READ,
    Permission.ARCHIVE_READ,
    Permission.MEMORY_QUERY,
    Permission.NOTIFICATION_READ,
  ]),
  [Role.MEMBER]: new Set(MEMBER_PERMISSIONS),
  [Role.VISITOR]: new Set(VISITOR_PERMISSIONS),
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function roleHasAnyPermission(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => rolePermissions[role].has(permission));
}

export function roleHasAllPermissions(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => rolePermissions[role].has(permission));
}

export function permissionsForRole(role: Role): Permission[] {
  return [...rolePermissions[role]].sort();
}
