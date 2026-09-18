import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  reportQuerySchema,
  type Report,
  type ReportQuery,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { ReportService } from '../report.service';
import { ReportQueryInput } from './inputs';
import { AccountingReportType } from './types';

@Resolver(() => AccountingReportType)
export class ReportResolver {
  constructor(private readonly reports: ReportService) {}

  @Query(() => AccountingReportType, { name: 'accountingReport' })
  @RequirePermissions(Permission.REPORT_READ)
  generate(
    @Args('query', { type: () => ReportQueryInput }, new ZodValidationPipe(reportQuerySchema))
    query: ReportQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Report> {
    return this.reports.generate(tenantOf(principal), query);
  }
}
