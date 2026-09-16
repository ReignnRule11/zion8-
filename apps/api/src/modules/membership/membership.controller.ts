import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  Permission,
  attendanceBulkMarkSchema,
  attendanceMarkSchema,
  attendanceSessionListQuerySchema,
  attendanceSessionSchema,
  attendanceSessionUpdateSchema,
  departmentListQuerySchema,
  departmentMemberAddSchema,
  departmentMemberUpdateSchema,
  departmentSchema,
  departmentUpdateSchema,
  documentListQuerySchema,
  documentUpdateSchema,
  documentUploadSchema,
  familyListQuerySchema,
  familyMemberAddSchema,
  familySchema,
  familyUpdateSchema,
  generateSummarySchema,
  memberListQuerySchema,
  memberSchema,
  memberUpdateSchema,
  relationshipGraphQuerySchema,
  relationshipListQuerySchema,
  relationshipSchema,
  timelineNoteSchema,
  timelineQuerySchema,
  visitorConvertSchema,
  visitorListQuerySchema,
  visitorSchema,
  visitorUpdateSchema,
  visitorVisitSchema,
  volunteerAssignmentSchema,
  volunteerAssignmentUpdateSchema,
  volunteerRoleListQuerySchema,
  volunteerRoleSchema,
  volunteerRoleUpdateSchema,
  type AttendanceBulkMarkRequest,
  type AttendanceMarkRequest,
  type AttendanceRecord,
  type AttendanceSessionListQuery,
  type AttendanceSessionPage,
  type AttendanceSessionRequest,
  type AttendanceSessionResponse,
  type AttendanceSessionUpdateRequest,
  type DepartmentListQuery,
  type DepartmentMember,
  type DepartmentMemberAddRequest,
  type DepartmentMemberUpdateRequest,
  type DepartmentPage,
  type DepartmentRequest,
  type DepartmentResponse,
  type DepartmentUpdateRequest,
  type DocumentDownload,
  type DocumentListQuery,
  type DocumentPage,
  type DocumentResponse,
  type DocumentUpdateRequest,
  type DocumentUploadRequest,
  type FamilyListQuery,
  type FamilyMemberAddRequest,
  type FamilyPage,
  type FamilyRequest,
  type FamilyResponse,
  type FamilyUpdateRequest,
  type GenerateSummaryRequest,
  type MemberAiSummaryResponse,
  type MemberAttendanceStats,
  type MemberListQuery,
  type MemberPage,
  type MemberProfile,
  type MemberRequest,
  type MemberResponse,
  type MemberUpdateRequest,
  type RelationshipGraph,
  type RelationshipGraphQuery,
  type RelationshipListQuery,
  type RelationshipPage,
  type RelationshipRequest,
  type RelationshipResponse,
  type TimelineEntryResponse,
  type TimelineNoteRequest,
  type TimelinePage,
  type TimelineQuery,
  type VisitorConvertRequest,
  type VisitorListQuery,
  type VisitorPage,
  type VisitorRequest,
  type VisitorResponse,
  type VisitorUpdateRequest,
  type VisitorVisitRequest,
  type VisitorVisitResponse,
  type VolunteerAssignmentRequest,
  type VolunteerAssignmentResponse,
  type VolunteerAssignmentUpdateRequest,
  type VolunteerRoleListQuery,
  type VolunteerRolePage,
  type VolunteerRoleRequest,
  type VolunteerRoleResponse,
  type VolunteerRoleUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import { AttendanceService } from './attendance.service';
import { DepartmentService } from './department.service';
import { DocumentService } from './documents/document.service';
import { FamilyService } from './family.service';
import { MemberProfileService } from './member-profile.service';
import { MemberService } from './member.service';
import { tenantOf } from './membership.utils';
import { RelationshipService } from './relationship.service';
import { SummaryService } from './summaries/summary.service';
import { TimelineService } from './timeline.service';
import { VisitorService } from './visitor.service';
import { VolunteerService } from './volunteer.service';

/**
 * Membership REST surface. Every route is tenant-scoped: the tenant comes from
 * the authenticated principal, never from the request, and the repositories run
 * under row-level security for that tenant.
 */
@Controller('membership')
export class MembershipController {
  constructor(
    private readonly members: MemberService,
    private readonly profiles: MemberProfileService,
    private readonly families: FamilyService,
    private readonly relationships: RelationshipService,
    private readonly visitors: VisitorService,
    private readonly attendance: AttendanceService,
    private readonly departments: DepartmentService,
    private readonly volunteers: VolunteerService,
    private readonly timeline: TimelineService,
    private readonly documents: DocumentService,
    private readonly summaries: SummaryService,
  ) {}

  // Members -----------------------------------------------------------------

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MEMBER_CREATE)
  createMember(
    @Body(new ZodValidationPipe(memberSchema)) body: MemberRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.create(tenantOf(principal), principal.userId, body);
  }

  @Get('members')
  @RequirePermissions(Permission.MEMBER_READ)
  listMembers(
    @Query(new ZodValidationPipe(memberListQuerySchema)) query: MemberListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberPage> {
    return this.members.list(tenantOf(principal), query);
  }

  @Get('members/:memberId')
  @RequirePermissions(Permission.MEMBER_READ)
  getMember(
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.get(tenantOf(principal), memberId);
  }

  @Get('members/:memberId/profile')
  @RequirePermissions(Permission.MEMBER_READ)
  getMemberProfile(
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberProfile> {
    return this.profiles.get(tenantOf(principal), memberId);
  }

  @Patch('members/:memberId')
  @RequirePermissions(Permission.MEMBER_UPDATE)
  updateMember(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(memberUpdateSchema)) body: MemberUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.update(tenantOf(principal), principal.userId, memberId, body);
  }

  @Delete('members/:memberId')
  @RequirePermissions(Permission.MEMBER_ARCHIVE)
  archiveMember(
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.archive(tenantOf(principal), principal.userId, memberId);
  }

  // Families ----------------------------------------------------------------

  @Post('families')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.FAMILY_MANAGE)
  createFamily(
    @Body(new ZodValidationPipe(familySchema)) body: FamilyRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.create(tenantOf(principal), body);
  }

  @Get('families')
  @RequirePermissions(Permission.FAMILY_READ)
  listFamilies(
    @Query(new ZodValidationPipe(familyListQuerySchema)) query: FamilyListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyPage> {
    return this.families.list(tenantOf(principal), query);
  }

  @Get('families/:familyId')
  @RequirePermissions(Permission.FAMILY_READ)
  getFamily(
    @Param('familyId') familyId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.get(tenantOf(principal), familyId);
  }

  @Patch('families/:familyId')
  @RequirePermissions(Permission.FAMILY_MANAGE)
  updateFamily(
    @Param('familyId') familyId: string,
    @Body(new ZodValidationPipe(familyUpdateSchema)) body: FamilyUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.update(tenantOf(principal), familyId, body);
  }

  @Post('families/:familyId/members')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.FAMILY_MANAGE)
  addFamilyMember(
    @Param('familyId') familyId: string,
    @Body(new ZodValidationPipe(familyMemberAddSchema)) body: FamilyMemberAddRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.addMember(tenantOf(principal), principal.userId, familyId, body);
  }

  @Delete('families/:familyId/members/:memberId')
  @RequirePermissions(Permission.FAMILY_MANAGE)
  removeFamilyMember(
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.removeMember(tenantOf(principal), principal.userId, familyId, memberId);
  }

  // Relationships -----------------------------------------------------------

  @Post('relationships')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.RELATIONSHIP_MANAGE)
  createRelationship(
    @Body(new ZodValidationPipe(relationshipSchema)) body: RelationshipRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RelationshipResponse> {
    return this.relationships.create(tenantOf(principal), principal.userId, body);
  }

  @Get('relationships')
  @RequirePermissions(Permission.RELATIONSHIP_READ)
  listRelationships(
    @Query(new ZodValidationPipe(relationshipListQuerySchema)) query: RelationshipListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RelationshipPage> {
    return this.relationships.list(tenantOf(principal), query);
  }

  @Get('relationships/graph')
  @RequirePermissions(Permission.RELATIONSHIP_READ)
  relationshipGraph(
    @Query(new ZodValidationPipe(relationshipGraphQuerySchema)) query: RelationshipGraphQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RelationshipGraph> {
    return this.relationships.graph(tenantOf(principal), query);
  }

  @Delete('relationships/:relationshipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.RELATIONSHIP_MANAGE)
  async removeRelationship(
    @Param('relationshipId') relationshipId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.relationships.remove(tenantOf(principal), relationshipId);
  }

  // Visitors ----------------------------------------------------------------

  @Post('visitors')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.VISITOR_CREATE)
  createVisitor(
    @Body(new ZodValidationPipe(visitorSchema)) body: VisitorRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.create(tenantOf(principal), principal.userId, body);
  }

  @Get('visitors')
  @RequirePermissions(Permission.VISITOR_READ)
  listVisitors(
    @Query(new ZodValidationPipe(visitorListQuerySchema)) query: VisitorListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorPage> {
    return this.visitors.list(tenantOf(principal), query);
  }

  @Get('visitors/:visitorId')
  @RequirePermissions(Permission.VISITOR_READ)
  getVisitor(
    @Param('visitorId') visitorId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.get(tenantOf(principal), visitorId);
  }

  @Patch('visitors/:visitorId')
  @RequirePermissions(Permission.VISITOR_UPDATE)
  updateVisitor(
    @Param('visitorId') visitorId: string,
    @Body(new ZodValidationPipe(visitorUpdateSchema)) body: VisitorUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.update(tenantOf(principal), visitorId, body);
  }

  @Post('visitors/:visitorId/visits')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.VISITOR_UPDATE)
  addVisitorVisit(
    @Param('visitorId') visitorId: string,
    @Body(new ZodValidationPipe(visitorVisitSchema)) body: VisitorVisitRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorVisitResponse> {
    return this.visitors.addVisit(tenantOf(principal), principal.userId, visitorId, body);
  }

  @Post('visitors/:visitorId/convert')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VISITOR_MANAGE)
  convertVisitor(
    @Param('visitorId') visitorId: string,
    @Body(new ZodValidationPipe(visitorConvertSchema)) body: VisitorConvertRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.convert(tenantOf(principal), principal.userId, visitorId, body);
  }

  // Attendance --------------------------------------------------------------

  @Post('attendance/sessions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  createAttendanceSession(
    @Body(new ZodValidationPipe(attendanceSessionSchema)) body: AttendanceSessionRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.createSession(tenantOf(principal), principal.userId, body);
  }

  @Get('attendance/sessions')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  listAttendanceSessions(
    @Query(new ZodValidationPipe(attendanceSessionListQuerySchema))
    query: AttendanceSessionListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionPage> {
    return this.attendance.listSessions(tenantOf(principal), query);
  }

  @Get('attendance/sessions/:sessionId')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  getAttendanceSession(
    @Param('sessionId') sessionId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.getSession(tenantOf(principal), sessionId);
  }

  @Patch('attendance/sessions/:sessionId')
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  updateAttendanceSession(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(attendanceSessionUpdateSchema))
    body: AttendanceSessionUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.updateSession(tenantOf(principal), sessionId, body);
  }

  @Post('attendance/sessions/:sessionId/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  closeAttendanceSession(
    @Param('sessionId') sessionId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceSessionResponse> {
    return this.attendance.closeSession(tenantOf(principal), sessionId);
  }

  @Post('attendance/sessions/:sessionId/mark')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  markAttendance(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(attendanceMarkSchema)) body: AttendanceMarkRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceRecord> {
    return this.attendance.mark(tenantOf(principal), principal.userId, sessionId, body);
  }

  @Post('attendance/sessions/:sessionId/bulk-mark')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ATTENDANCE_RECORD)
  bulkMarkAttendance(
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(attendanceBulkMarkSchema)) body: AttendanceBulkMarkRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AttendanceRecord[]> {
    return this.attendance.bulkMark(tenantOf(principal), principal.userId, sessionId, body);
  }

  @Get('attendance/members/:memberId/stats')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  memberAttendanceStats(
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberAttendanceStats> {
    return this.attendance.stats(tenantOf(principal), memberId);
  }

  // Departments -------------------------------------------------------------

  @Post('departments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  createDepartment(
    @Body(new ZodValidationPipe(departmentSchema)) body: DepartmentRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentResponse> {
    return this.departments.create(tenantOf(principal), body);
  }

  @Get('departments')
  @RequirePermissions(Permission.DEPARTMENT_READ)
  listDepartments(
    @Query(new ZodValidationPipe(departmentListQuerySchema)) query: DepartmentListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentPage> {
    return this.departments.list(tenantOf(principal), query);
  }

  @Get('departments/:departmentId')
  @RequirePermissions(Permission.DEPARTMENT_READ)
  getDepartment(
    @Param('departmentId') departmentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentResponse> {
    return this.departments.get(tenantOf(principal), departmentId);
  }

  @Patch('departments/:departmentId')
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  updateDepartment(
    @Param('departmentId') departmentId: string,
    @Body(new ZodValidationPipe(departmentUpdateSchema)) body: DepartmentUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentResponse> {
    return this.departments.update(tenantOf(principal), departmentId, body);
  }

  @Post('departments/:departmentId/members')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  addDepartmentMember(
    @Param('departmentId') departmentId: string,
    @Body(new ZodValidationPipe(departmentMemberAddSchema)) body: DepartmentMemberAddRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentMember> {
    return this.departments.addMember(tenantOf(principal), principal.userId, departmentId, body);
  }

  @Patch('departments/:departmentId/members/:memberId')
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  updateDepartmentMember(
    @Param('departmentId') departmentId: string,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(departmentMemberUpdateSchema))
    body: DepartmentMemberUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentMember> {
    return this.departments.updateMember(tenantOf(principal), departmentId, memberId, body);
  }

  @Delete('departments/:departmentId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  async removeDepartmentMember(
    @Param('departmentId') departmentId: string,
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.departments.removeMember(tenantOf(principal), principal.userId, departmentId, memberId);
  }

  // Volunteer roles ---------------------------------------------------------

  @Post('volunteer-roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  createVolunteerRole(
    @Body(new ZodValidationPipe(volunteerRoleSchema)) body: VolunteerRoleRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRoleResponse> {
    return this.volunteers.createRole(tenantOf(principal), body);
  }

  @Get('volunteer-roles')
  @RequirePermissions(Permission.VOLUNTEER_READ)
  listVolunteerRoles(
    @Query(new ZodValidationPipe(volunteerRoleListQuerySchema)) query: VolunteerRoleListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRolePage> {
    return this.volunteers.listRoles(tenantOf(principal), query);
  }

  @Get('volunteer-roles/:roleId')
  @RequirePermissions(Permission.VOLUNTEER_READ)
  getVolunteerRole(
    @Param('roleId') roleId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRoleResponse> {
    return this.volunteers.getRole(tenantOf(principal), roleId);
  }

  @Patch('volunteer-roles/:roleId')
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  updateVolunteerRole(
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(volunteerRoleUpdateSchema)) body: VolunteerRoleUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRoleResponse> {
    return this.volunteers.updateRole(tenantOf(principal), roleId, body);
  }

  @Post('volunteer-roles/:roleId/assignments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  assignVolunteer(
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(volunteerAssignmentSchema)) body: VolunteerAssignmentRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerAssignmentResponse> {
    return this.volunteers.assign(tenantOf(principal), principal.userId, roleId, body);
  }

  @Patch('volunteer-roles/:roleId/assignments/:assignmentId')
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  updateVolunteerAssignment(
    @Param('roleId') roleId: string,
    @Param('assignmentId') assignmentId: string,
    @Body(new ZodValidationPipe(volunteerAssignmentUpdateSchema))
    body: VolunteerAssignmentUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerAssignmentResponse> {
    return this.volunteers.updateAssignment(tenantOf(principal), roleId, assignmentId, body);
  }

  @Delete('volunteer-roles/:roleId/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  async endVolunteerAssignment(
    @Param('roleId') roleId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.volunteers.endAssignment(tenantOf(principal), roleId, assignmentId);
  }

  // Timeline ----------------------------------------------------------------

  @Get('members/:memberId/timeline')
  @RequirePermissions(Permission.TIMELINE_READ)
  listTimeline(
    @Param('memberId') memberId: string,
    @Query(new ZodValidationPipe(timelineQuerySchema)) query: TimelineQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<TimelinePage> {
    return this.timeline.list(tenantOf(principal), memberId, query);
  }

  @Post('members/:memberId/timeline/notes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.TIMELINE_MANAGE)
  addTimelineNote(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(timelineNoteSchema)) body: TimelineNoteRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<TimelineEntryResponse> {
    return this.timeline.addNote(tenantOf(principal), principal.userId, memberId, body);
  }

  @Delete('timeline/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.TIMELINE_MANAGE)
  async deleteTimelineNote(
    @Param('noteId') noteId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.timeline.deleteNote(tenantOf(principal), noteId);
  }

  // Documents ---------------------------------------------------------------

  @Post('members/:memberId/documents')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.DOCUMENT_UPLOAD)
  uploadDocument(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(documentUploadSchema)) body: DocumentUploadRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentResponse> {
    return this.documents.upload(tenantOf(principal), principal.userId, memberId, body);
  }

  @Get('members/:memberId/documents')
  @RequirePermissions(Permission.DOCUMENT_READ)
  listDocuments(
    @Param('memberId') memberId: string,
    @Query(new ZodValidationPipe(documentListQuerySchema)) query: DocumentListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentPage> {
    return this.documents.list(tenantOf(principal), memberId, query);
  }

  @Patch('documents/:documentId')
  @RequirePermissions(Permission.DOCUMENT_MANAGE)
  updateDocument(
    @Param('documentId') documentId: string,
    @Body(new ZodValidationPipe(documentUpdateSchema)) body: DocumentUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentResponse> {
    return this.documents.update(tenantOf(principal), documentId, body);
  }

  @Delete('documents/:documentId')
  @RequirePermissions(Permission.DOCUMENT_MANAGE)
  archiveDocument(
    @Param('documentId') documentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentResponse> {
    return this.documents.archive(tenantOf(principal), documentId);
  }

  @Get('documents/:documentId/download')
  @RequirePermissions(Permission.DOCUMENT_READ)
  downloadDocument(
    @Param('documentId') documentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DocumentDownload> {
    return this.documents.download(tenantOf(principal), documentId);
  }

  @Get('documents/:documentId/content')
  @RequirePermissions(Permission.DOCUMENT_READ)
  async documentContent(
    @Param('documentId') documentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.documents.content(tenantOf(principal), documentId);
    response.setHeader('content-type', file.contentType);
    response.setHeader(
      'content-disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return new StreamableFile(file.bytes);
  }

  // AI summary --------------------------------------------------------------

  @Get('members/:memberId/summary')
  @RequirePermissions(Permission.SUMMARY_READ)
  getSummary(
    @Param('memberId') memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberAiSummaryResponse | null> {
    return this.summaries.get(tenantOf(principal), memberId);
  }

  @Post('members/:memberId/summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SUMMARY_GENERATE)
  generateSummary(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(generateSummarySchema)) body: GenerateSummaryRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberAiSummaryResponse> {
    return this.summaries.generate(tenantOf(principal), principal.userId, memberId, body);
  }
}
