import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  attendanceBulkMarkSchema,
  attendanceMarkSchema,
  attendanceSessionListQuerySchema,
  attendanceSessionSchema,
  attendanceSessionUpdateSchema,
  type AttendanceBulkMarkRequest,
  type AttendanceMarkRequest,
  type AttendanceRecord,
  type AttendanceSessionListQuery,
  type AttendanceSessionPage,
  type AttendanceSessionRequest,
  type AttendanceSessionResponse,
  type AttendanceSessionUpdateRequest,
  type MemberAttendanceStats,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { tenantOf } from '../membership.utils';
import { AttendanceService } from '../attendance.service';
import {
  AttendanceBulkMarkInput,
  AttendanceMarkInput,
  AttendanceSessionInput,
  AttendanceSessionListInput,
  AttendanceSessionUpdateInput,
} from './inputs';
import {
  AttendanceRecordType,
  AttendanceSessionPageType,
  AttendanceSessionType,
  MemberAttendanceStatsType,
} from './types';

@Resolver(() => AttendanceSessionType)
export class AttendanceResolver {
  constructor(private readonly attendance: AttendanceService) {}

  @Query(() => AttendanceSessionPageType, { name: 'attendanceSessions' })
  @RequirePermissions(Permission.ATTENDANCE_READ)
  listSessions(
    @Args('filter', { type: () => AttendanceSessionListInput, nullable: true }, new ZodValidationPipe(attendanceSessionListQuerySchema.default({})))
    filter: AttendanceSessionListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionPage> {
    return this.attendance.listSessions(tenantOf(principal), filter);
  }

  @Query(() => AttendanceSessionType, { name: 'attendanceSession' })
  @RequirePermissions(Permission.ATTENDANCE_READ)
  getSession(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.getSession(tenantOf(principal), id);
  }

  @Query(() => MemberAttendanceStatsType, { name: 'memberAttendanceStats' })
  @RequirePermissions(Permission.ATTENDANCE_READ)
  memberStats(
    @Args('memberId', { type: () => ID }) memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberAttendanceStats> {
    return this.attendance.stats(tenantOf(principal), memberId);
  }

  @Mutation(() => AttendanceSessionType, { name: 'createAttendanceSession' })
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  createSession(
    @Args('input', { type: () => AttendanceSessionInput }, new ZodValidationPipe(attendanceSessionSchema))
    input: AttendanceSessionRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.createSession(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => AttendanceSessionType, { name: 'updateAttendanceSession' })
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  updateSession(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => AttendanceSessionUpdateInput }, new ZodValidationPipe(attendanceSessionUpdateSchema))
    input: AttendanceSessionUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.updateSession(tenantOf(principal), id, input);
  }

  @Mutation(() => AttendanceSessionType, { name: 'closeAttendanceSession' })
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  closeSession(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.closeSession(tenantOf(principal), id);
  }

  @Mutation(() => AttendanceRecordType, { name: 'markAttendance' })
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  mark(
    @Args('sessionId', { type: () => ID }) sessionId: string,
    @Args('input', { type: () => AttendanceMarkInput }, new ZodValidationPipe(attendanceMarkSchema))
    input: AttendanceMarkRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceRecord> {
    return this.attendance.mark(tenantOf(principal), principal.userId, sessionId, input);
  }

  @Mutation(() => [AttendanceRecordType], { name: 'bulkMarkAttendance' })
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  bulkMark(
    @Args('sessionId', { type: () => ID }) sessionId: string,
    @Args('input', { type: () => AttendanceBulkMarkInput }, new ZodValidationPipe(attendanceBulkMarkSchema))
    input: AttendanceBulkMarkRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceRecord[]> {
    return this.attendance.bulkMark(tenantOf(principal), principal.userId, sessionId, input);
  }
}
