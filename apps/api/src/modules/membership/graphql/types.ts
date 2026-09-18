import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import {
  AttendanceMethodEnum,
  AttendanceSessionKindEnum,
  AttendanceSessionStatusEnum,
  AttendanceStatusEnum,
  DepartmentKindEnum,
  DepartmentMemberRoleEnum,
  DepartmentMemberStatusEnum,
  DocumentCategoryEnum,
  DocumentStatusEnum,
  FamilyRoleEnum,
  FamilyStatusEnum,
  GraphEdgeTypeEnum,
  GraphNodeTypeEnum,
  MaritalStatusEnum,
  MemberGenderEnum,
  MemberStatusEnum,
  RelationshipTypeEnum,
  SummaryProviderKindEnum,
  SummaryStatusEnum,
  TimelineEventTypeEnum,
  VisitorSourceEnum,
  VisitorStatusEnum,
  VolunteerAssignmentStatusEnum,
  VolunteerCommitmentEnum,
} from './enums';

/**
 * GraphQL object types. They intentionally mirror the REST contract shapes for
 * the fields the clients read, so a consumer can move between the two surfaces
 * without relearning the domain.
 */

@ObjectType()
export class MemberType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => String, { nullable: true }) userId!: string | null;
  @Field() firstName!: string;
  @Field(() => String, { nullable: true }) middleName!: string | null;
  @Field() lastName!: string;
  @Field(() => String, { nullable: true }) preferredName!: string | null;
  @Field(() => MemberStatusEnum) status!: string;
  @Field(() => MemberGenderEnum) gender!: string;
  @Field(() => MaritalStatusEnum) maritalStatus!: string;
  @Field(() => String, { nullable: true }) dateOfBirth!: string | null;
  @Field(() => String, { nullable: true }) email!: string | null;
  @Field(() => String, { nullable: true }) phone!: string | null;
  @Field(() => String, { nullable: true }) photoUrl!: string | null;
  @Field(() => String, { nullable: true }) addressLine1!: string | null;
  @Field(() => String, { nullable: true }) addressLine2!: string | null;
  @Field(() => String, { nullable: true }) city!: string | null;
  @Field(() => String, { nullable: true }) region!: string | null;
  @Field(() => String, { nullable: true }) postalCode!: string | null;
  @Field(() => String, { nullable: true }) countryCode!: string | null;
  @Field(() => String, { nullable: true }) joinedAt!: string | null;
  @Field(() => String, { nullable: true }) baptizedAt!: string | null;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => [String]) tags!: string[];
  @Field(() => String, { nullable: true }) archivedAt!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class MemberSummaryType {
  @Field() id!: string;
  @Field() firstName!: string;
  @Field(() => String, { nullable: true }) middleName!: string | null;
  @Field(() => String, { nullable: true }) lastName!: string | null;
  @Field(() => String, { nullable: true }) preferredName!: string | null;
  @Field() fullName!: string;
  @Field(() => MemberStatusEnum) status!: string;
  @Field(() => MemberGenderEnum) gender!: string;
  @Field(() => String, { nullable: true }) email!: string | null;
  @Field(() => String, { nullable: true }) phone!: string | null;
  @Field(() => String, { nullable: true }) photoUrl!: string | null;
  @Field(() => String, { nullable: true }) joinedAt!: string | null;
  @Field(() => String, { nullable: true }) userId!: string | null;
  @Field(() => [String]) tags!: string[];
  @Field(() => Int) familyCount!: number;
  @Field(() => Int) departmentCount!: number;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class MemberPageType {
  @Field(() => [MemberSummaryType]) items!: MemberSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class FamilyMemberType {
  @Field() id!: string;
  @Field() familyId!: string;
  @Field() memberId!: string;
  @Field() memberName!: string;
  @Field() memberStatus!: string;
  @Field(() => FamilyRoleEnum) role!: string;
  @Field() createdAt!: string;
}

@ObjectType()
export class FamilyType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => FamilyStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) addressLine1!: string | null;
  @Field(() => String, { nullable: true }) addressLine2!: string | null;
  @Field(() => String, { nullable: true }) city!: string | null;
  @Field(() => String, { nullable: true }) region!: string | null;
  @Field(() => String, { nullable: true }) postalCode!: string | null;
  @Field(() => String, { nullable: true }) countryCode!: string | null;
  @Field(() => String, { nullable: true }) homePhone!: string | null;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => [FamilyMemberType]) members!: FamilyMemberType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class FamilySummaryType {
  @Field() id!: string;
  @Field() name!: string;
  @Field(() => FamilyStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) city!: string | null;
  @Field(() => Int) memberCount!: number;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class FamilyPageType {
  @Field(() => [FamilySummaryType]) items!: FamilySummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class RelationshipTypeObject {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() fromMemberId!: string;
  @Field() fromMemberName!: string;
  @Field() toMemberId!: string;
  @Field() toMemberName!: string;
  @Field(() => RelationshipTypeEnum) type!: string;
  @Field(() => RelationshipTypeEnum) inverseType!: string;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class RelationshipPageType {
  @Field(() => [RelationshipTypeObject]) items!: RelationshipTypeObject[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class GraphNodeTypeObject {
  @Field() id!: string;
  @Field(() => GraphNodeTypeEnum) type!: string;
  @Field() label!: string;
  @Field(() => Int) depth!: number;
  @Field() root!: boolean;
  @Field(() => String, { nullable: true }) memberStatus!: string | null;
  @Field(() => String, { nullable: true }) photoUrl!: string | null;
}

@ObjectType()
export class GraphEdgeTypeObject {
  @Field() id!: string;
  @Field(() => GraphEdgeTypeEnum) type!: string;
  @Field() source!: string;
  @Field() target!: string;
  @Field() label!: string;
}

@ObjectType()
export class RelationshipGraphType {
  @Field() rootId!: string;
  @Field(() => Int) depth!: number;
  @Field() truncated!: boolean;
  @Field(() => [GraphNodeTypeObject]) nodes!: GraphNodeTypeObject[];
  @Field(() => [GraphEdgeTypeObject]) edges!: GraphEdgeTypeObject[];
}

@ObjectType()
export class VisitorVisitType {
  @Field() id!: string;
  @Field() visitorId!: string;
  @Field() occurredAt!: string;
  @Field(() => String, { nullable: true }) serviceName!: string | null;
  @Field() attended!: boolean;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => String, { nullable: true }) recordedByUserId!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class VisitorType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() firstName!: string;
  @Field() lastName!: string;
  @Field(() => String, { nullable: true }) email!: string | null;
  @Field(() => String, { nullable: true }) phone!: string | null;
  @Field(() => VisitorStatusEnum) status!: string;
  @Field(() => VisitorSourceEnum) source!: string;
  @Field(() => String, { nullable: true }) firstVisitAt!: string | null;
  @Field(() => String, { nullable: true }) invitedByMemberId!: string | null;
  @Field(() => String, { nullable: true }) assignedToUserId!: string | null;
  @Field(() => String, { nullable: true }) addressLine1!: string | null;
  @Field(() => String, { nullable: true }) city!: string | null;
  @Field(() => String, { nullable: true }) countryCode!: string | null;
  @Field(() => [String]) interests!: string[];
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => String, { nullable: true }) followUpAt!: string | null;
  @Field(() => String, { nullable: true }) convertedMemberId!: string | null;
  @Field(() => String, { nullable: true }) convertedAt!: string | null;
  @Field(() => [VisitorVisitType]) visits!: VisitorVisitType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class VisitorSummaryType {
  @Field() id!: string;
  @Field() firstName!: string;
  @Field() lastName!: string;
  @Field() fullName!: string;
  @Field(() => String, { nullable: true }) email!: string | null;
  @Field(() => String, { nullable: true }) phone!: string | null;
  @Field(() => VisitorStatusEnum) status!: string;
  @Field(() => VisitorSourceEnum) source!: string;
  @Field(() => String, { nullable: true }) firstVisitAt!: string | null;
  @Field(() => String, { nullable: true }) lastVisitAt!: string | null;
  @Field(() => Int) visitCount!: number;
  @Field(() => String, { nullable: true }) assignedToUserId!: string | null;
  @Field(() => String, { nullable: true }) followUpAt!: string | null;
  @Field(() => String, { nullable: true }) convertedMemberId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class VisitorPageType {
  @Field(() => [VisitorSummaryType]) items!: VisitorSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class AttendanceRecordType {
  @Field() id!: string;
  @Field() sessionId!: string;
  @Field(() => String, { nullable: true }) memberId!: string | null;
  @Field(() => String, { nullable: true }) visitorId!: string | null;
  @Field() attendeeName!: string;
  @Field(() => AttendanceStatusEnum) status!: string;
  @Field(() => AttendanceMethodEnum) method!: string;
  @Field() checkedInAt!: string;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class AttendanceSessionType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() title!: string;
  @Field(() => AttendanceSessionKindEnum) kind!: string;
  @Field(() => AttendanceSessionStatusEnum) status!: string;
  @Field() occurredAt!: string;
  @Field(() => String, { nullable: true }) endedAt!: string | null;
  @Field(() => String, { nullable: true }) location!: string | null;
  @Field(() => String, { nullable: true }) departmentId!: string | null;
  @Field(() => Int, { nullable: true }) expectedCount!: number | null;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => String, { nullable: true }) recordedByUserId!: string | null;
  @Field(() => Int) attendedCount!: number;
  @Field(() => Int) absentCount!: number;
  @Field(() => [AttendanceRecordType]) records!: AttendanceRecordType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class AttendanceSessionSummaryType {
  @Field() id!: string;
  @Field() title!: string;
  @Field(() => AttendanceSessionKindEnum) kind!: string;
  @Field(() => AttendanceSessionStatusEnum) status!: string;
  @Field() occurredAt!: string;
  @Field(() => String, { nullable: true }) location!: string | null;
  @Field(() => String, { nullable: true }) departmentId!: string | null;
  @Field(() => Int) attendedCount!: number;
  @Field(() => Int) absentCount!: number;
  @Field(() => Int, { nullable: true }) expectedCount!: number | null;
  @Field(() => String, { nullable: true }) recordedByUserId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class AttendanceSessionPageType {
  @Field(() => [AttendanceSessionSummaryType]) items!: AttendanceSessionSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class MemberAttendanceStatsType {
  @Field() memberId!: string;
  @Field(() => Int) sessionsAttended!: number;
  @Field(() => Int) sessionsRecorded!: number;
  @Field(() => Float) attendanceRate!: number;
  @Field(() => String, { nullable: true }) lastAttendedAt!: string | null;
  @Field(() => Int) currentStreak!: number;
}

@ObjectType()
export class DepartmentMemberType {
  @Field() id!: string;
  @Field() departmentId!: string;
  @Field() memberId!: string;
  @Field() memberName!: string;
  @Field() memberStatus!: string;
  @Field(() => DepartmentMemberRoleEnum) role!: string;
  @Field(() => DepartmentMemberStatusEnum) status!: string;
  @Field() joinedAt!: string;
  @Field(() => String, { nullable: true }) leftAt!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class DepartmentType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => DepartmentKindEnum) kind!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field(() => String, { nullable: true }) leaderMemberId!: string | null;
  @Field(() => String, { nullable: true }) meetingDay!: string | null;
  @Field(() => String, { nullable: true }) meetingTime!: string | null;
  @Field(() => String, { nullable: true }) location!: string | null;
  @Field() isActive!: boolean;
  @Field(() => [DepartmentMemberType]) members!: DepartmentMemberType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class DepartmentSummaryType {
  @Field() id!: string;
  @Field() name!: string;
  @Field(() => DepartmentKindEnum) kind!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field() isActive!: boolean;
  @Field(() => Int) memberCount!: number;
  @Field(() => String, { nullable: true }) leaderMemberId!: string | null;
  @Field(() => String, { nullable: true }) leaderName!: string | null;
  @Field(() => String, { nullable: true }) meetingDay!: string | null;
  @Field(() => String, { nullable: true }) meetingTime!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class DepartmentPageType {
  @Field(() => [DepartmentSummaryType]) items!: DepartmentSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class VolunteerAssignmentType {
  @Field() id!: string;
  @Field() roleId!: string;
  @Field() memberId!: string;
  @Field() memberName!: string;
  @Field() memberStatus!: string;
  @Field(() => VolunteerAssignmentStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) startsAt!: string | null;
  @Field(() => String, { nullable: true }) endsAt!: string | null;
  @Field(() => String, { nullable: true }) backgroundCheckAt!: string | null;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class VolunteerRoleType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field(() => String, { nullable: true }) departmentId!: string | null;
  @Field(() => VolunteerCommitmentEnum) commitment!: string;
  @Field(() => Int) requiredCount!: number;
  @Field() requiresBackgroundCheck!: boolean;
  @Field() isActive!: boolean;
  @Field(() => [VolunteerAssignmentType]) assignments!: VolunteerAssignmentType[];
  @Field(() => Int) activeCount!: number;
  @Field(() => Int) openSlots!: number;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class VolunteerRoleSummaryType {
  @Field() id!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field(() => String, { nullable: true }) departmentId!: string | null;
  @Field(() => String, { nullable: true }) departmentName!: string | null;
  @Field(() => VolunteerCommitmentEnum) commitment!: string;
  @Field(() => Int) requiredCount!: number;
  @Field(() => Int) activeCount!: number;
  @Field(() => Int) openSlots!: number;
  @Field() requiresBackgroundCheck!: boolean;
  @Field() isActive!: boolean;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class VolunteerRolePageType {
  @Field(() => [VolunteerRoleSummaryType]) items!: VolunteerRoleSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class TimelineEntryType {
  @Field() id!: string;
  @Field() memberId!: string;
  @Field(() => TimelineEventTypeEnum) type!: string;
  @Field() occurredAt!: string;
  @Field() title!: string;
  @Field(() => String, { nullable: true }) summary!: string | null;
  @Field(() => String, { nullable: true }) sourceResourceType!: string | null;
  @Field(() => String, { nullable: true }) sourceResourceId!: string | null;
  @Field(() => String, { nullable: true }) createdByUserId!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class TimelinePageType {
  @Field(() => [TimelineEntryType]) items!: TimelineEntryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class DocumentType {
  @Field() id!: string;
  @Field() memberId!: string;
  @Field() title!: string;
  @Field(() => DocumentCategoryEnum) category!: string;
  @Field(() => DocumentStatusEnum) status!: string;
  @Field() fileName!: string;
  @Field() contentType!: string;
  @Field(() => Int) sizeBytes!: number;
  @Field(() => String, { nullable: true }) checksum!: string | null;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => String, { nullable: true }) expiresAt!: string | null;
  @Field(() => String, { nullable: true }) uploadedByUserId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

/**
 * A short-lived, signed download pointer. The bytes themselves are served by the
 * REST download route so that large payloads are streamed rather than embedded
 * in a GraphQL response.
 */
@ObjectType()
export class DocumentDownloadType {
  @Field() documentId!: string;
  @Field() url!: string;
  @Field(() => Int) expiresInSeconds!: number;
}

@ObjectType()
export class DocumentPageType {
  @Field(() => [DocumentType]) items!: DocumentType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class MemberAiSummaryFactsType {
  @Field(() => Int) tenureDays!: number;
  @Field(() => Float) attendanceRate!: number;
  @Field(() => Int) sessionsAttended!: number;
  @Field(() => Int) sessionsRecorded!: number;
  @Field(() => Int) currentStreak!: number;
  @Field(() => String, { nullable: true }) lastAttendedAt!: string | null;
  @Field(() => Int) familyCount!: number;
  @Field(() => Int) relationshipCount!: number;
  @Field(() => Int) departmentCount!: number;
  @Field(() => Int) volunteerRoleCount!: number;
  @Field(() => Int) documentCount!: number;
  @Field(() => Int) timelineEventCount!: number;
  @Field(() => Int) openFollowUps!: number;
  @Field(() => [String]) tags!: string[];
}

@ObjectType()
export class MemberAiSummaryType {
  @Field() memberId!: string;
  @Field(() => SummaryStatusEnum) status!: string;
  @Field(() => SummaryProviderKindEnum) provider!: string;
  @Field(() => String, { nullable: true }) model!: string | null;
  @Field(() => String, { nullable: true }) content!: string | null;
  @Field(() => [String]) highlights!: string[];
  @Field(() => MemberAiSummaryFactsType, { nullable: true }) facts!: MemberAiSummaryFactsType | null;
  @Field(() => String, { nullable: true }) generatedAt!: string | null;
  @Field(() => Int) sourceVersion!: number;
  @Field(() => String, { nullable: true }) error!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class ProfileFamilyType {
  @Field() familyId!: string;
  @Field() familyName!: string;
  @Field(() => FamilyStatusEnum) familyStatus!: string;
  @Field(() => FamilyRoleEnum) role!: string;
}

@ObjectType()
export class ProfileDepartmentType {
  @Field() departmentId!: string;
  @Field() name!: string;
  @Field(() => DepartmentKindEnum) kind!: string;
  @Field(() => DepartmentMemberRoleEnum) role!: string;
  @Field(() => DepartmentMemberStatusEnum) status!: string;
}

@ObjectType()
export class ProfileVolunteerRoleType {
  @Field() roleId!: string;
  @Field() name!: string;
  @Field(() => VolunteerCommitmentEnum) commitment!: string;
  @Field(() => VolunteerAssignmentStatusEnum) status!: string;
}

@ObjectType()
export class ProfileAttendanceSessionType {
  @Field() sessionId!: string;
  @Field() title!: string;
  @Field(() => AttendanceSessionKindEnum) kind!: string;
  @Field() occurredAt!: string;
  @Field() status!: string;
}

@ObjectType()
export class MemberProfileType {
  @Field(() => MemberType) member!: MemberType;
  @Field(() => MemberAttendanceStatsType) attendance!: MemberAttendanceStatsType;
  @Field(() => [ProfileFamilyType]) families!: ProfileFamilyType[];
  @Field(() => [ProfileDepartmentType]) departments!: ProfileDepartmentType[];
  @Field(() => [ProfileVolunteerRoleType]) volunteerRoles!: ProfileVolunteerRoleType[];
  @Field(() => [RelationshipTypeObject]) relationships!: RelationshipTypeObject[];
  @Field(() => [ProfileAttendanceSessionType]) recentAttendance!: ProfileAttendanceSessionType[];
  @Field(() => [DocumentType]) documents!: DocumentType[];
  @Field(() => [TimelineEntryType]) timeline!: TimelineEntryType[];
  @Field(() => MemberAiSummaryType, { nullable: true }) summary!: MemberAiSummaryType | null;
}
