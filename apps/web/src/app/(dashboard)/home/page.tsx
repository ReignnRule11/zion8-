import type { Metadata } from 'next';
import { Permission } from '@zion8/contracts';
import {
  ArchiveTimelineWidget,
  AttendanceWidget,
  DashboardFiltersForm,
  GivingWidget,
  GrowthWidget,
  KpiTile,
  RecentActivityWidget,
  UnavailableWidget,
  UpcomingSessionsWidget,
  VolunteerHealthWidget,
} from '@/components/dashboard/widgets';
import { PageHeader } from '@/components/membership/ui';
import {
  givingFundBars,
  loadDashboard,
  mergeActivity,
  openVolunteerSlots,
  parseDashboardFilters,
  sumAttended,
  weeklyAttendance,
} from '@/lib/dashboard';
import { formatMoney, humanize } from '@/lib/format';
import { can, canAny, loadPrincipal } from '@/lib/principal';

export const metadata: Metadata = { title: 'Home' };

export default async function HomeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kind?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const params = await searchParams;
  const filters = parseDashboardFilters(params);
  const data = await loadDashboard(token, me, filters);
  const firstName = me.principal.firstName;
  const roleLabel = me.role ? humanize(me.role) : 'Platform';

  const showAttendance = can(me, Permission.ATTENDANCE_READ);
  const showGiving = can(me, Permission.GIVING_READ) && can(me, Permission.REPORT_READ);
  const showBooks = can(me, Permission.ACCOUNTING_READ) && can(me, Permission.REPORT_READ);
  const showGrowth = can(me, Permission.MEMBER_READ);
  const showVolunteers = can(me, Permission.VOLUNTEER_READ);
  const showArchive = can(me, Permission.MEMORY_READ);
  const showPrayer = can(me, Permission.PRAYER_READ);
  const showEvents = can(me, Permission.EVENT_READ);
  const showAi = canAny(me, [Permission.AI_ASK, Permission.AI_RECOMMEND, Permission.ANALYTICS_VIEW]);
  const showNotifications = can(me, Permission.NOTIFICATION_READ);
  const showActivity = Boolean(
    data.attendance || data.contributions || data.sermons || data.archive || data.journals,
  );

  const attended = data.attendance ? sumAttended(data.attendance.items) : 0;
  const givingNet = data.givingReport?.netMinor ?? 0;
  const givingCurrency = data.givingReport?.currency ?? 'USD';
  const activity = mergeActivity(data);
  const rangeHint = `${filters.from} – ${filters.to}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good day, ${firstName}`}
        description={`${roleLabel} view for this workspace. Widgets follow permissions, not a hardcoded role.`}
      />

      <DashboardFiltersForm filters={filters} />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {showAttendance ? (
          <KpiTile
            label="Attendance"
            value={String(attended)}
            hint={`${data.attendance?.total ?? 0} sessions · ${rangeHint}`}
            href="/community/attendance"
          />
        ) : null}
        {showGiving ? (
          <KpiTile
            label="Giving"
            value={formatMoney(givingNet, givingCurrency)}
            hint="Giving statement net"
            href="/accounting/giving"
          />
        ) : null}
        {showGrowth ? (
          <KpiTile
            label="Active members"
            value={String(data.activeMembers?.total ?? 0)}
            hint={`${data.joinedMembers?.total ?? 0} joined in range`}
            href="/people"
          />
        ) : null}
        {showBooks && data.incomeReport ? (
          <KpiTile
            label="Income statement"
            value={formatMoney(data.incomeReport.netMinor, data.incomeReport.currency)}
            hint="Revenue minus expenses"
            href="/accounting/reports"
          />
        ) : showVolunteers ? (
          <KpiTile
            label="Open volunteer slots"
            value={String(openVolunteerSlots(data.volunteers?.items ?? []))}
            hint={`${data.volunteers?.total ?? 0} active roles`}
            href="/community/volunteers"
          />
        ) : showArchive ? (
          <KpiTile
            label="Archive"
            value={String(data.archive?.total ?? 0)}
            hint="Artifacts in range"
            href="/memory"
          />
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {showAttendance && data.attendance ? (
          <AttendanceWidget
            sessions={data.attendance.items}
            series={weeklyAttendance(data.attendance.items, filters.from, filters.to)}
            total={attended}
          />
        ) : null}

        {showGiving && data.givingReport ? (
          <GivingWidget
            netMinor={data.givingReport.netMinor}
            currency={data.givingReport.currency}
            bars={givingFundBars(data.givingReport)}
          />
        ) : null}

        {showGrowth && data.activeMembers && data.joinedMembers ? (
          <GrowthWidget
            activeTotal={data.activeMembers.total}
            joinedTotal={data.joinedMembers.total}
            visitorTotal={data.visitors ? data.visitors.total : null}
          />
        ) : null}

        {showVolunteers && data.volunteers ? (
          <VolunteerHealthWidget roles={data.volunteers.items} />
        ) : null}

        {showAttendance && data.upcoming ? (
          <UpcomingSessionsWidget sessions={data.upcoming.items} />
        ) : null}

        {showArchive && data.archive ? (
          <ArchiveTimelineWidget items={data.archive.items} />
        ) : null}
      </section>

      {showActivity ? <RecentActivityWidget items={activity} /> : null}

      {showPrayer || showEvents || showAi || showNotifications ? (
        <section aria-label="Capabilities not yet served over HTTP" className="grid gap-6 lg:grid-cols-2">
          {showPrayer ? (
            <UnavailableWidget
              id="widget-prayer"
              title="Prayer requests"
              reason="The care context is planned. There is no prayer-request list on /api/v1 yet, so this card does not invent a count."
            />
          ) : null}
          {showEvents ? (
            <UnavailableWidget
              id="widget-events"
              title="Events calendar"
              reason="The events bounded context is planned. Upcoming attendance sessions above are the operational calendar that exists today."
            />
          ) : null}
          {showAi ? (
            <UnavailableWidget
              id="widget-ai"
              title="AI insights"
              reason="Insight contracts exist, but the API has no HTTP controller for prayer insights or recommendations yet."
            />
          ) : null}
          {showNotifications ? (
            <UnavailableWidget
              id="widget-notifications"
              title="Notifications"
              reason="Notifications today send mail and SMS. There is no inbox list for a leader to read here."
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
