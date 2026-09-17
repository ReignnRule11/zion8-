import { registerEnumType } from '@nestjs/graphql';
import {
  AttendanceMethod,
  AttendanceSessionKind,
  AttendanceSessionStatus,
  AttendanceStatus,
  DepartmentKind,
  DepartmentMemberRole,
  DepartmentMemberStatus,
  DocumentCategory,
  DocumentStatus,
  FamilyRole,
  FamilyStatus,
  GraphEdgeType,
  GraphNodeType,
  MaritalStatus,
  MemberGender,
  MemberStatus,
  RelationshipType,
  SummaryProviderKind,
  SummaryStatus,
  TimelineEventType,
  VisitorSource,
  VisitorStatus,
  VolunteerAssignmentStatus,
  VolunteerCommitment,
} from '@zion8/contracts';

/**
 * The GraphQL enum space is the contract enum space. Registering the same
 * objects the REST validation uses means a value that is legal over REST is
 * legal over GraphQL, and introspection documents exactly the domain language.
 */
const enums: Array<[object, string]> = [
  [MemberStatus, 'MemberStatus'],
  [MemberGender, 'MemberGender'],
  [MaritalStatus, 'MaritalStatus'],
  [FamilyRole, 'FamilyRole'],
  [FamilyStatus, 'FamilyStatus'],
  [RelationshipType, 'RelationshipType'],
  [GraphNodeType, 'GraphNodeType'],
  [GraphEdgeType, 'GraphEdgeType'],
  [VisitorStatus, 'VisitorStatus'],
  [VisitorSource, 'VisitorSource'],
  [AttendanceSessionKind, 'AttendanceSessionKind'],
  [AttendanceSessionStatus, 'AttendanceSessionStatus'],
  [AttendanceStatus, 'AttendanceStatus'],
  [AttendanceMethod, 'AttendanceMethod'],
  [DepartmentKind, 'DepartmentKind'],
  [DepartmentMemberRole, 'DepartmentMemberRole'],
  [DepartmentMemberStatus, 'DepartmentMemberStatus'],
  [VolunteerCommitment, 'VolunteerCommitment'],
  [VolunteerAssignmentStatus, 'VolunteerAssignmentStatus'],
  [TimelineEventType, 'TimelineEventType'],
  [DocumentCategory, 'DocumentCategory'],
  [DocumentStatus, 'DocumentStatus'],
  [SummaryStatus, 'SummaryStatus'],
  [SummaryProviderKind, 'SummaryProviderKind'],
];

for (const [ref, name] of enums) {
  registerEnumType(ref, { name });
}

export const MemberStatusEnum = MemberStatus;
export const MemberGenderEnum = MemberGender;
export const MaritalStatusEnum = MaritalStatus;
export const FamilyRoleEnum = FamilyRole;
export const FamilyStatusEnum = FamilyStatus;
export const RelationshipTypeEnum = RelationshipType;
export const GraphNodeTypeEnum = GraphNodeType;
export const GraphEdgeTypeEnum = GraphEdgeType;
export const VisitorStatusEnum = VisitorStatus;
export const VisitorSourceEnum = VisitorSource;
export const AttendanceSessionKindEnum = AttendanceSessionKind;
export const AttendanceSessionStatusEnum = AttendanceSessionStatus;
export const AttendanceStatusEnum = AttendanceStatus;
export const AttendanceMethodEnum = AttendanceMethod;
export const DepartmentKindEnum = DepartmentKind;
export const DepartmentMemberRoleEnum = DepartmentMemberRole;
export const DepartmentMemberStatusEnum = DepartmentMemberStatus;
export const VolunteerCommitmentEnum = VolunteerCommitment;
export const VolunteerAssignmentStatusEnum = VolunteerAssignmentStatus;
export const TimelineEventTypeEnum = TimelineEventType;
export const DocumentCategoryEnum = DocumentCategory;
export const DocumentStatusEnum = DocumentStatus;
export const SummaryStatusEnum = SummaryStatus;
export const SummaryProviderKindEnum = SummaryProviderKind;
