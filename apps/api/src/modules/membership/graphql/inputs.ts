import { Field, InputType, Int } from '@nestjs/graphql';
import {
  AttendanceMethodEnum,
  AttendanceSessionKindEnum,
  AttendanceSessionStatusEnum,
  AttendanceStatusEnum,
  DepartmentKindEnum,
  DepartmentMemberRoleEnum,
  DocumentCategoryEnum,
  DocumentStatusEnum,
  FamilyRoleEnum,
  FamilyStatusEnum,
  MaritalStatusEnum,
  MemberGenderEnum,
  MemberStatusEnum,
  RelationshipTypeEnum,
  TimelineEventTypeEnum,
  VisitorSourceEnum,
  VisitorStatusEnum,
  VolunteerAssignmentStatusEnum,
  VolunteerCommitmentEnum,
} from './enums';

/**
 * Input types stay permissive on purpose. Every resolver passes its arguments
 * through the same Zod contract the REST endpoints use, so defaults, transforms,
 * and validation are defined once and cannot drift between the two surfaces.
 */

@InputType()
export class MemberInput {
  @Field() firstName!: string;
  @Field() lastName!: string;
  @Field(() => String, { nullable: true }) middleName?: string;
  @Field(() => String, { nullable: true }) preferredName?: string;
  @Field(() => MemberStatusEnum, { nullable: true }) status?: string;
  @Field(() => MemberGenderEnum, { nullable: true }) gender?: string;
  @Field(() => MaritalStatusEnum, { nullable: true }) maritalStatus?: string;
  @Field(() => String, { nullable: true }) dateOfBirth?: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => String, { nullable: true }) photoUrl?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) addressLine2?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) region?: string;
  @Field(() => String, { nullable: true }) postalCode?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
  @Field(() => String, { nullable: true }) joinedAt?: string;
  @Field(() => String, { nullable: true }) baptizedAt?: string;
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => [String], { nullable: true }) tags?: string[];
}

@InputType()
export class MemberUpdateInput {
  @Field(() => String, { nullable: true }) firstName?: string;
  @Field(() => String, { nullable: true }) lastName?: string;
  @Field(() => String, { nullable: true }) middleName?: string;
  @Field(() => String, { nullable: true }) preferredName?: string;
  @Field(() => MemberStatusEnum, { nullable: true }) status?: string;
  @Field(() => MemberGenderEnum, { nullable: true }) gender?: string;
  @Field(() => MaritalStatusEnum, { nullable: true }) maritalStatus?: string;
  @Field(() => String, { nullable: true }) dateOfBirth?: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => String, { nullable: true }) photoUrl?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) addressLine2?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) region?: string;
  @Field(() => String, { nullable: true }) postalCode?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
  @Field(() => String, { nullable: true }) joinedAt?: string;
  @Field(() => String, { nullable: true }) baptizedAt?: string;
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => [String], { nullable: true }) tags?: string[];
  @Field(() => String, { nullable: true }) userId?: string;
}

@InputType()
export class MemberListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => MemberStatusEnum, { nullable: true }) status?: string;
  @Field(() => MemberGenderEnum, { nullable: true }) gender?: string;
  @Field(() => MaritalStatusEnum, { nullable: true }) maritalStatus?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => String, { nullable: true }) familyId?: string;
  @Field(() => String, { nullable: true }) volunteerRoleId?: string;
  @Field(() => String, { nullable: true }) tag?: string;
  @Field(() => String, { nullable: true }) joinedAfter?: string;
  @Field(() => String, { nullable: true }) joinedBefore?: string;
}

@InputType()
export class FamilyInput {
  @Field() name!: string;
  @Field(() => FamilyStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) addressLine2?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) region?: string;
  @Field(() => String, { nullable: true }) postalCode?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
  @Field(() => String, { nullable: true }) homePhone?: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class FamilyUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => FamilyStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) addressLine2?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) region?: string;
  @Field(() => String, { nullable: true }) postalCode?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
  @Field(() => String, { nullable: true }) homePhone?: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class FamilyListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => FamilyStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) memberId?: string;
}

@InputType()
export class FamilyMemberAddInput {
  @Field() memberId!: string;
  @Field(() => FamilyRoleEnum, { nullable: true }) role?: string;
}

@InputType()
export class RelationshipInput {
  @Field() fromMemberId!: string;
  @Field() toMemberId!: string;
  @Field(() => RelationshipTypeEnum) type!: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class RelationshipListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) memberId?: string;
  @Field(() => RelationshipTypeEnum, { nullable: true }) type?: string;
}

@InputType()
export class RelationshipGraphInput {
  @Field() memberId!: string;
  @Field(() => Int, { nullable: true }) depth?: number;
  @Field(() => Boolean, { nullable: true }) includeFamilies?: boolean;
  @Field(() => Boolean, { nullable: true }) includeDepartments?: boolean;
  @Field(() => Boolean, { nullable: true }) includeVolunteerRoles?: boolean;
  @Field(() => [RelationshipTypeEnum], { nullable: true }) types?: string[];
}

@InputType()
export class VisitorInput {
  @Field() firstName!: string;
  @Field() lastName!: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => VisitorStatusEnum, { nullable: true }) status?: string;
  @Field(() => VisitorSourceEnum, { nullable: true }) source?: string;
  @Field(() => String, { nullable: true }) firstVisitAt?: string;
  @Field(() => String, { nullable: true }) invitedByMemberId?: string;
  @Field(() => String, { nullable: true }) assignedToUserId?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
  @Field(() => [String], { nullable: true }) interests?: string[];
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => String, { nullable: true }) followUpAt?: string;
}

@InputType()
export class VisitorUpdateInput {
  @Field(() => String, { nullable: true }) firstName?: string;
  @Field(() => String, { nullable: true }) lastName?: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => VisitorStatusEnum, { nullable: true }) status?: string;
  @Field(() => VisitorSourceEnum, { nullable: true }) source?: string;
  @Field(() => String, { nullable: true }) firstVisitAt?: string;
  @Field(() => String, { nullable: true }) invitedByMemberId?: string;
  @Field(() => String, { nullable: true }) assignedToUserId?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
  @Field(() => [String], { nullable: true }) interests?: string[];
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => String, { nullable: true }) followUpAt?: string;
}

@InputType()
export class VisitorListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => VisitorStatusEnum, { nullable: true }) status?: string;
  @Field(() => VisitorSourceEnum, { nullable: true }) source?: string;
  @Field(() => String, { nullable: true }) assignedToUserId?: string;
  @Field(() => String, { nullable: true }) followUpBefore?: string;
}

@InputType()
export class VisitorVisitInput {
  @Field() occurredAt!: string;
  @Field(() => String, { nullable: true }) serviceName?: string;
  @Field(() => Boolean, { nullable: true }) attended?: boolean;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class VisitorConvertMemberInput {
  @Field(() => String, { nullable: true }) firstName?: string;
  @Field(() => String, { nullable: true }) lastName?: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => String, { nullable: true }) addressLine1?: string;
  @Field(() => String, { nullable: true }) city?: string;
  @Field(() => String, { nullable: true }) countryCode?: string;
}

@InputType()
export class VisitorConvertInput {
  @Field(() => VisitorConvertMemberInput, { nullable: true }) member?: VisitorConvertMemberInput;
  @Field(() => String, { nullable: true }) joinedAt?: string;
}

@InputType()
export class AttendanceSessionInput {
  @Field() title!: string;
  @Field(() => AttendanceSessionKindEnum, { nullable: true }) kind?: string;
  @Field() occurredAt!: string;
  @Field(() => String, { nullable: true }) endedAt?: string;
  @Field(() => String, { nullable: true }) location?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => Int, { nullable: true }) expectedCount?: number;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class AttendanceSessionUpdateInput {
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => AttendanceSessionKindEnum, { nullable: true }) kind?: string;
  @Field(() => String, { nullable: true }) occurredAt?: string;
  @Field(() => String, { nullable: true }) endedAt?: string;
  @Field(() => String, { nullable: true }) location?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => Int, { nullable: true }) expectedCount?: number;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class AttendanceSessionListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => AttendanceSessionKindEnum, { nullable: true }) kind?: string;
  @Field(() => AttendanceSessionStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => String, { nullable: true }) from?: string;
  @Field(() => String, { nullable: true }) to?: string;
}

@InputType()
export class AttendanceMarkInput {
  @Field(() => String, { nullable: true }) memberId?: string;
  @Field(() => String, { nullable: true }) visitorId?: string;
  @Field(() => AttendanceStatusEnum, { nullable: true }) status?: string;
  @Field(() => AttendanceMethodEnum, { nullable: true }) method?: string;
  @Field(() => String, { nullable: true }) checkedInAt?: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class AttendanceBulkMarkInput {
  @Field(() => [AttendanceMarkInput]) records!: AttendanceMarkInput[];
}

@InputType()
export class DepartmentInput {
  @Field() name!: string;
  @Field(() => DepartmentKindEnum, { nullable: true }) kind?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) leaderMemberId?: string;
  @Field(() => String, { nullable: true }) meetingDay?: string;
  @Field(() => String, { nullable: true }) meetingTime?: string;
  @Field(() => String, { nullable: true }) location?: string;
  @Field(() => Boolean, { nullable: true }) isActive?: boolean;
}

@InputType()
export class DepartmentUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => DepartmentKindEnum, { nullable: true }) kind?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) leaderMemberId?: string;
  @Field(() => String, { nullable: true }) meetingDay?: string;
  @Field(() => String, { nullable: true }) meetingTime?: string;
  @Field(() => String, { nullable: true }) location?: string;
  @Field(() => Boolean, { nullable: true }) isActive?: boolean;
}

@InputType()
export class DepartmentListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => DepartmentKindEnum, { nullable: true }) kind?: string;
  @Field(() => Boolean, { nullable: true }) isActive?: boolean;
  @Field(() => String, { nullable: true }) memberId?: string;
}

@InputType()
export class DepartmentMemberAddInput {
  @Field() memberId!: string;
  @Field(() => DepartmentMemberRoleEnum, { nullable: true }) role?: string;
  @Field(() => String, { nullable: true }) joinedAt?: string;
}

@InputType()
export class DepartmentMemberUpdateInput {
  @Field(() => DepartmentMemberRoleEnum, { nullable: true }) role?: string;
  @Field(() => String, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) leftAt?: string;
}

@InputType()
export class VolunteerRoleInput {
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => VolunteerCommitmentEnum, { nullable: true }) commitment?: string;
  @Field(() => Int, { nullable: true }) requiredCount?: number;
  @Field(() => Boolean, { nullable: true }) requiresBackgroundCheck?: boolean;
  @Field(() => Boolean, { nullable: true }) isActive?: boolean;
}

@InputType()
export class VolunteerRoleUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => VolunteerCommitmentEnum, { nullable: true }) commitment?: string;
  @Field(() => Int, { nullable: true }) requiredCount?: number;
  @Field(() => Boolean, { nullable: true }) requiresBackgroundCheck?: boolean;
  @Field(() => Boolean, { nullable: true }) isActive?: boolean;
}

@InputType()
export class VolunteerRoleListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
  @Field(() => VolunteerCommitmentEnum, { nullable: true }) commitment?: string;
  @Field(() => Boolean, { nullable: true }) isActive?: boolean;
  @Field(() => Boolean, { nullable: true }) withOpenSlotsOnly?: boolean;
}

@InputType()
export class VolunteerAssignmentInput {
  @Field() memberId!: string;
  @Field(() => VolunteerAssignmentStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) startsAt?: string;
  @Field(() => String, { nullable: true }) endsAt?: string;
  @Field(() => String, { nullable: true }) backgroundCheckAt?: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class VolunteerAssignmentUpdateInput {
  @Field(() => VolunteerAssignmentStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) startsAt?: string;
  @Field(() => String, { nullable: true }) endsAt?: string;
  @Field(() => String, { nullable: true }) backgroundCheckAt?: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class TimelineNoteInput {
  @Field() title!: string;
  @Field(() => String, { nullable: true }) summary?: string;
  @Field(() => String, { nullable: true }) occurredAt?: string;
}

@InputType()
export class TimelineListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => [TimelineEventTypeEnum], { nullable: true }) types?: string[];
  @Field(() => String, { nullable: true }) from?: string;
  @Field(() => String, { nullable: true }) to?: string;
  @Field(() => String, { nullable: true }) search?: string;
}

/**
 * Document bytes are deliberately absent. Binary upload and download stay on
 * the REST surface, where the payload can be streamed; GraphQL only carries the
 * document metadata that a client renders in a list or a detail panel.
 */
@InputType()
export class DocumentUpdateInput {
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => DocumentCategoryEnum, { nullable: true }) category?: string;
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => String, { nullable: true }) expiresAt?: string;
}

@InputType()
export class DocumentListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => DocumentCategoryEnum, { nullable: true }) category?: string;
  @Field(() => DocumentStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) search?: string;
}

@InputType()
export class GenerateSummaryInput {
  @Field(() => Boolean, { nullable: true }) force?: boolean;
  @Field(() => String, { nullable: true }) focus?: string;
}
