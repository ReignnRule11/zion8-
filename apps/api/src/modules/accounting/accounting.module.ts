import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AccountingController } from './accounting.controller';
import { BudgetService } from './budget.service';
import { GivingService } from './giving.service';
import { BudgetResolver } from './graphql/budget.resolver';
import { GivingResolver } from './graphql/giving.resolver';
import { LedgerResolver } from './graphql/ledger.resolver';
import { PayrollResolver } from './graphql/payroll.resolver';
import { ProcurementResolver } from './graphql/procurement.resolver';
import { ReconResolver } from './graphql/recon.resolver';
import { ReportResolver } from './graphql/report.resolver';
import { LedgerService } from './ledger.service';
import { PayrollService } from './payroll.service';
import { ProcurementService } from './procurement.service';
import { ReconService } from './recon.service';
import { ReportService } from './report.service';

@Module({
  imports: [AuditModule],
  controllers: [AccountingController],
  providers: [
    LedgerService,
    GivingService,
    PayrollService,
    BudgetService,
    ProcurementService,
    ReconService,
    ReportService,
    LedgerResolver,
    GivingResolver,
    PayrollResolver,
    BudgetResolver,
    ProcurementResolver,
    ReconResolver,
    ReportResolver,
  ],
  exports: [
    LedgerService,
    GivingService,
    PayrollService,
    BudgetService,
    ProcurementService,
    ReconService,
    ReportService,
  ],
})
export class AccountingModule {}
