import {
  ContributionStatus,
  MemberStatus,
  Permission,
  ReportKind,
  attendanceSessionKindSchema,
  type AttendanceSessionKind as SessionKind,
  type AttendanceSessionPage,
  type AttendanceSessionSummary,
  type ContributionPage,
  type JournalPage,
  type MeResponse,
  type MemberPage,
  type MemoryArtifactPage,
  type Report,
  type SermonPage,
  type VisitorPage,
  type VolunteerRolePage,
  type VolunteerRoleSummary,
} from '@zion8/contracts';
import { api } from './api-client';
import { can } from './principal';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_WINDOW_DAYS = 90;
const LIST_LIMIT = 50;
const STRIP_LIMIT = 8;

export interface DashboardFilters {
  from: string;
  to: string;
  kind?: SessionKind;
}

export interface WeeklyPoint {
  label: string;
  value: number;
}

export interface ActivityItem {
  id: string;
  at: string;
  title: string;
  detail: string;
  href: string;
  source: 'Attendance' | 'Giving' | 'Sermon' | 'Archive' | 'Journal';
}

export interface DashboardData {
  filters: DashboardFilters;
  attendance: AttendanceSessionPage | null;
  upcoming: AttendanceSessionPage | null;
  givingReport: Report | null;
  incomeReport: Report | null;
  contributions: ContributionPage | null;
  activeMembers: MemberPage | null;
  joinedMembers: MemberPage | null;
  visitors: VisitorPage | null;
  volunteers: VolunteerRolePage | null;
  sermons: SermonPage | null;
  archive: MemoryArtifactPage | null;
  journals: JournalPage | null;
}

export function parseDashboardFilters(params: {
  from?: string;
  to?: string;
  kind?: string;
}): DashboardFilters {
  const defaults = defaultRange();
  const from = params.from && ISO_DATE.test(params.from) ? params.from : defaults.from;
  const to = params.to && ISO_DATE.test(params.to) ? params.to : defaults.to;
  const kind = params.kind ? attendanceSessionKindSchema.safeParse(params.kind.toUpperCase()) : null;
  return {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    kind: kind?.success ? kind.data : undefined,
  };
}

export function defaultRange(now = new Date()): { from: string; to: string } {
  const to = toIsoDate(now);
  const fromDate = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from: toIsoDate(fromDate), to };
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfDayUtc(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

export function endOfDayUtc(isoDate: string): string {
  return `${isoDate}T23:59:59.999Z`;
}

export async function loadDashboard(
  token: string,
  me: MeResponse,
  filters: DashboardFilters,
): Promise<DashboardData> {
  const fromInstant = startOfDayUtc(filters.from);
  const toInstant = endOfDayUtc(filters.to);
  const nowInstant = new Date().toISOString();
  const canAttendance = can(me, Permission.ATTENDANCE_READ);
  const canGivingList = can(me, Permission.GIVING_READ);
  const canReports = can(me, Permission.REPORT_READ);
  const canBooks = can(me, Permission.ACCOUNTING_READ);
  const canMembers = can(me, Permission.MEMBER_READ);
  const canVisitors = can(me, Permission.VISITOR_READ);
  const canVolunteers = can(me, Permission.VOLUNTEER_READ);
  const canSermons = can(me, Permission.SERMON_READ);
  const canMemory = can(me, Permission.MEMORY_READ);

  const [
    attendance,
    upcoming,
    givingReport,
    incomeReport,
    contributions,
    activeMembers,
    joinedMembers,
    visitors,
    volunteers,
    sermons,
    archive,
    journals,
  ] = await Promise.all([
    loadIf(canAttendance, () =>
      api.listAttendanceSessions(token, {
        limit: LIST_LIMIT,
        offset: 0,
        from: fromInstant,
        to: toInstant,
        kind: filters.kind,
      }),
    ),
    loadIf(canAttendance, () =>
      api.listAttendanceSessions(token, {
        limit: STRIP_LIMIT,
        offset: 0,
        from: nowInstant,
        kind: filters.kind,
      }),
    ),
    loadIf(canReports && canGivingList, () =>
      api.getAccountingReport(token, {
        kind: ReportKind.GIVING_STATEMENT,
        from: filters.from,
        to: filters.to,
      }),
    ),
    loadIf(canReports && canBooks, () =>
      api.getAccountingReport(token, {
        kind: ReportKind.INCOME_STATEMENT,
        from: filters.from,
        to: filters.to,
      }),
    ),
    loadIf(canGivingList, () =>
      api.listContributions(token, {
        limit: STRIP_LIMIT,
        offset: 0,
        from: filters.from,
        to: filters.to,
        status: ContributionStatus.POSTED,
      }),
    ),
    loadIf(canMembers, () =>
      api.listMembers(token, { limit: 1, offset: 0, status: MemberStatus.ACTIVE }),
    ),
    loadIf(canMembers, () =>
      api.listMembers(token, {
        limit: 1,
        offset: 0,
        joinedAfter: filters.from,
        joinedBefore: filters.to,
      }),
    ),
    loadIf(canVisitors, () => api.listVisitors(token, { limit: 1, offset: 0 })),
    loadIf(canVolunteers, () =>
      api.listVolunteerRoles(token, { limit: LIST_LIMIT, offset: 0, isActive: true }),
    ),
    loadIf(canSermons, () =>
      api.listSermons(token, {
        limit: STRIP_LIMIT,
        offset: 0,
        from: fromInstant,
        to: toInstant,
      }),
    ),
    loadIf(canMemory, () =>
      api.listMemoryArtifacts(token, {
        limit: STRIP_LIMIT,
        offset: 0,
        from: fromInstant,
        to: toInstant,
      }),
    ),
    loadIf(canBooks, () =>
      api.listJournals(token, {
        limit: STRIP_LIMIT,
        offset: 0,
        from: filters.from,
        to: filters.to,
      }),
    ),
  ]);

  return {
    filters,
    attendance,
    upcoming,
    givingReport,
    incomeReport,
    contributions,
    activeMembers,
    joinedMembers,
    visitors,
    volunteers,
    sermons,
    archive,
    journals,
  };
}

export function sumAttended(sessions: AttendanceSessionSummary[]): number {
  return sessions.reduce((sum, session) => sum + session.attendedCount, 0);
}

export function weeklyAttendance(
  sessions: AttendanceSessionSummary[],
  from: string,
  to: string,
): WeeklyPoint[] {
  const start = Date.parse(startOfDayUtc(from));
  const end = Date.parse(endOfDayUtc(to));
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets: WeeklyPoint[] = [];
  for (let cursor = start, index = 1; cursor <= end; cursor += weekMs, index += 1) {
    buckets.push({ label: `W${index}`, value: 0 });
  }
  if (buckets.length === 0) return [];

  for (const session of sessions) {
    const at = Date.parse(session.occurredAt);
    if (Number.isNaN(at) || at < start || at > end) continue;
    const index = Math.min(Math.floor((at - start) / weekMs), buckets.length - 1);
    const bucket = buckets[index];
    if (bucket) bucket.value += session.attendedCount;
  }
  return buckets;
}

export function openVolunteerSlots(roles: VolunteerRoleSummary[]): number {
  return roles.reduce((sum, role) => sum + role.openSlots, 0);
}

export function mergeActivity(data: DashboardData): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const session of data.attendance?.items ?? []) {
    items.push({
      id: `attendance-${session.id}`,
      at: session.occurredAt,
      title: session.title,
      detail: `${session.attendedCount} attended`,
      href: `/community/attendance/${session.id}`,
      source: 'Attendance',
    });
  }

  for (const gift of data.contributions?.items ?? []) {
    items.push({
      id: `giving-${gift.id}`,
      at: `${gift.receivedOn}T00:00:00.000Z`,
      title: gift.donorName ?? 'Anonymous',
      detail: gift.fundName,
      href: `/accounting/giving/${gift.id}`,
      source: 'Giving',
    });
  }

  for (const sermon of data.sermons?.items ?? []) {
    items.push({
      id: `sermon-${sermon.id}`,
      at: sermon.preachedAt ?? sermon.createdAt,
      title: sermon.title,
      detail: sermon.speakerName ?? 'Sermon',
      href: `/sermons/${sermon.id}`,
      source: 'Sermon',
    });
  }

  for (const artifact of data.archive?.items ?? []) {
    items.push({
      id: `memory-${artifact.id}`,
      at: artifact.capturedAt ?? artifact.createdAt,
      title: artifact.title,
      detail: artifact.kind,
      href: `/memory/${artifact.id}`,
      source: 'Archive',
    });
  }

  for (const journal of data.journals?.items ?? []) {
    items.push({
      id: `journal-${journal.id}`,
      at: `${journal.occurredOn}T00:00:00.000Z`,
      title: journal.memo,
      detail: `Journal ${journal.number}`,
      href: `/accounting/journals/${journal.id}`,
      source: 'Journal',
    });
  }

  return items.sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 12);
}

export function givingFundBars(report: Report): WeeklyPoint[] {
  const lines = report.sections.flatMap((section) => section.lines);
  return lines
    .map((line) => ({ label: line.accountName, value: Math.max(line.balanceMinor, 0) }))
    .filter((point) => point.value > 0)
    .slice(0, 8);
}

async function loadIf<T>(enabled: boolean, load: () => Promise<T>): Promise<T | null> {
  if (!enabled) return null;
  return load();
}


