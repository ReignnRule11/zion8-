import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { AuditModule } from '../audit/audit.module';
import { AttendanceService } from './attendance.service';
import { DepartmentService } from './department.service';
import { DocumentService } from './documents/document.service';
import { DOCUMENT_STORAGE, LocalDocumentStorage } from './documents/storage.port';
import { FamilyService } from './family.service';
import { AttendanceResolver } from './graphql/attendance.resolver';
import { DepartmentsResolver } from './graphql/departments.resolver';
import { DocumentsResolver } from './graphql/documents.resolver';
import { FamiliesResolver } from './graphql/families.resolver';
import { MembersResolver } from './graphql/members.resolver';
import { RelationshipsResolver } from './graphql/relationships.resolver';
import { SummariesResolver } from './graphql/summaries.resolver';
import { TimelineResolver } from './graphql/timeline.resolver';
import { VisitorsResolver } from './graphql/visitors.resolver';
import { VolunteersResolver } from './graphql/volunteers.resolver';
import { MemberProfileService } from './member-profile.service';
import { MemberService } from './member.service';
import { MembershipController } from './membership.controller';
import { RelationshipService } from './relationship.service';
import { DeterministicSummaryProvider } from './summaries/deterministic-summary.provider';
import { LlmSummaryProvider } from './summaries/llm-summary.provider';
import { SUMMARY_PROVIDER, type SummaryProvider } from './summaries/summary.provider';
import { SummaryService } from './summaries/summary.service';
import { TimelineService } from './timeline.service';
import { VisitorService } from './visitor.service';
import { VolunteerService } from './volunteer.service';

@Module({
  imports: [AuditModule],
  controllers: [MembershipController],
  providers: [
    MemberService,
    FamilyService,
    RelationshipService,
    VisitorService,
    AttendanceService,
    DepartmentService,
    VolunteerService,
    TimelineService,
    DocumentService,
    MemberProfileService,
    LocalDocumentStorage,
    { provide: DOCUMENT_STORAGE, useExisting: LocalDocumentStorage },
    DeterministicSummaryProvider,
    LlmSummaryProvider,
    {
      provide: SUMMARY_PROVIDER,
      useFactory: (
        config: AppConfigService,
        deterministic: DeterministicSummaryProvider,
        llm: LlmSummaryProvider,
      ): SummaryProvider => (config.llmSummary.configured ? llm : deterministic),
      inject: [AppConfigService, DeterministicSummaryProvider, LlmSummaryProvider],
    },
    SummaryService,
    MembersResolver,
    FamiliesResolver,
    RelationshipsResolver,
    VisitorsResolver,
    AttendanceResolver,
    DepartmentsResolver,
    VolunteersResolver,
    TimelineResolver,
    DocumentsResolver,
    SummariesResolver,
  ],
  exports: [
    MemberService,
    FamilyService,
    RelationshipService,
    VisitorService,
    AttendanceService,
    DepartmentService,
    VolunteerService,
    TimelineService,
    DocumentService,
    SummaryService,
    MemberProfileService,
  ],
})
export class MembershipModule {}
