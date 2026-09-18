import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  Permission,
  accountCreateSchema,
  accountListQuerySchema,
  accountUpdateSchema,
  bankAccountCreateSchema,
  bankAccountListQuerySchema,
  bankTransactionCreateSchema,
  bankTransactionListQuerySchema,
  billCreateSchema,
  billListQuerySchema,
  budgetCreateSchema,
  budgetListQuerySchema,
  contributionCreateSchema,
  contributionListQuerySchema,
  contributionRefundSchema,
  expenseCreateSchema,
  expenseDecisionSchema,
  expenseListQuerySchema,
  fiscalPeriodCreateSchema,
  fiscalPeriodListQuerySchema,
  fundCreateSchema,
  fundListQuerySchema,
  fundUpdateSchema,
  journalCreateSchema,
  journalListQuerySchema,
  journalVoidSchema,
  payrollEmployeeCreateSchema,
  payrollEmployeeListQuerySchema,
  payrollEmployeeUpdateSchema,
  payrollRunCreateSchema,
  payrollRunListQuerySchema,
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderListQuerySchema,
  reconciliationCreateSchema,
  reconciliationListQuerySchema,
  reconciliationMatchSchema,
  reportQuerySchema,
  vendorCreateSchema,
  vendorListQuerySchema,
  vendorUpdateSchema,
  type Account,
  type AccountCreateRequest,
  type AccountListQuery,
  type AccountPage,
  type AccountUpdateRequest,
  type BankAccount,
  type BankAccountCreateRequest,
  type BankAccountListQuery,
  type BankAccountPage,
  type BankTransaction,
  type BankTransactionCreateRequest,
  type BankTransactionListQuery,
  type BankTransactionPage,
  type Bill,
  type BillCreateRequest,
  type BillListQuery,
  type BillPage,
  type Budget,
  type BudgetCreateRequest,
  type BudgetListQuery,
  type BudgetPage,
  type Contribution,
  type ContributionCreateRequest,
  type ContributionListQuery,
  type ContributionPage,
  type ContributionRefundRequest,
  type Expense,
  type ExpenseCreateRequest,
  type ExpenseDecisionRequest,
  type ExpenseListQuery,
  type ExpensePage,
  type FiscalPeriod,
  type FiscalPeriodCreateRequest,
  type FiscalPeriodListQuery,
  type FiscalPeriodPage,
  type Fund,
  type FundCreateRequest,
  type FundListQuery,
  type FundPage,
  type FundUpdateRequest,
  type Journal,
  type JournalCreateRequest,
  type JournalListQuery,
  type JournalPage,
  type JournalVoidRequest,
  type PayrollEmployee,
  type PayrollEmployeeCreateRequest,
  type PayrollEmployeeListQuery,
  type PayrollEmployeePage,
  type PayrollEmployeeUpdateRequest,
  type PayrollRun,
  type PayrollRunCreateRequest,
  type PayrollRunListQuery,
  type PayrollRunPage,
  type Project,
  type ProjectCreateRequest,
  type ProjectListQuery,
  type ProjectPage,
  type ProjectUpdateRequest,
  type PurchaseOrder,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderListQuery,
  type PurchaseOrderPage,
  type Reconciliation,
  type ReconciliationCreateRequest,
  type ReconciliationListQuery,
  type ReconciliationMatchRequest,
  type ReconciliationPage,
  type Report,
  type ReportQuery,
  type Vendor,
  type VendorCreateRequest,
  type VendorListQuery,
  type VendorPage,
  type VendorUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../common/security/principal';
import { BudgetService } from './budget.service';
import { GivingService } from './giving.service';
import { LedgerService } from './ledger.service';
import { PayrollService } from './payroll.service';
import { ProcurementService } from './procurement.service';
import { ReconService } from './recon.service';
import { ReportService } from './report.service';

@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly giving: GivingService,
    private readonly payroll: PayrollService,
    private readonly budgets: BudgetService,
    private readonly procurement: ProcurementService,
    private readonly recon: ReconService,
    private readonly reports: ReportService,
  ) {}

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createAccount(
    @Body(new ZodValidationPipe(accountCreateSchema)) body: AccountCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Account> {
    return this.ledger.createAccount(tenantOf(principal), principal.userId, body);
  }

  @Get('accounts')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listAccounts(
    @Query(new ZodValidationPipe(accountListQuerySchema)) query: AccountListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AccountPage> {
    return this.ledger.listAccounts(tenantOf(principal), query);
  }

  @Get('accounts/:accountId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getAccount(
    @Param('accountId') accountId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Account> {
    return this.ledger.getAccount(tenantOf(principal), accountId);
  }

  @Patch('accounts/:accountId')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateAccount(
    @Param('accountId') accountId: string,
    @Body(new ZodValidationPipe(accountUpdateSchema)) body: AccountUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Account> {
    return this.ledger.updateAccount(tenantOf(principal), principal.userId, accountId, body);
  }

  @Post('periods')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createPeriod(
    @Body(new ZodValidationPipe(fiscalPeriodCreateSchema)) body: FiscalPeriodCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FiscalPeriod> {
    return this.ledger.createPeriod(tenantOf(principal), principal.userId, body);
  }

  @Get('periods')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listPeriods(
    @Query(new ZodValidationPipe(fiscalPeriodListQuerySchema)) query: FiscalPeriodListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FiscalPeriodPage> {
    return this.ledger.listPeriods(tenantOf(principal), query);
  }

  @Post('periods/:periodId/close')
  @RequirePermissions(Permission.ACCOUNTING_CLOSE_PERIOD)
  closePeriod(
    @Param('periodId') periodId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FiscalPeriod> {
    return this.ledger.closePeriod(tenantOf(principal), principal.userId, periodId);
  }

  @Post('journals')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createJournal(
    @Body(new ZodValidationPipe(journalCreateSchema)) body: JournalCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.createJournal(tenantOf(principal), principal.userId, body);
  }

  @Get('journals')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listJournals(
    @Query(new ZodValidationPipe(journalListQuerySchema)) query: JournalListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<JournalPage> {
    return this.ledger.listJournals(tenantOf(principal), query);
  }

  @Get('journals/:journalId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getJournal(
    @Param('journalId') journalId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.getJournal(tenantOf(principal), journalId);
  }

  @Post('journals/:journalId/post')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postJournal(
    @Param('journalId') journalId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.postJournal(tenantOf(principal), principal.userId, journalId);
  }

  @Post('journals/:journalId/void')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  voidJournal(
    @Param('journalId') journalId: string,
    @Body(new ZodValidationPipe(journalVoidSchema)) body: JournalVoidRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.voidJournal(tenantOf(principal), principal.userId, journalId, body);
  }

  @Post('funds')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.GIVING_RECORD)
  createFund(
    @Body(new ZodValidationPipe(fundCreateSchema)) body: FundCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Fund> {
    return this.giving.createFund(tenantOf(principal), principal.userId, body);
  }

  @Get('funds')
  @RequirePermissions(Permission.GIVING_READ)
  listFunds(
    @Query(new ZodValidationPipe(fundListQuerySchema)) query: FundListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FundPage> {
    return this.giving.listFunds(tenantOf(principal), query);
  }

  @Get('funds/:fundId')
  @RequirePermissions(Permission.GIVING_READ)
  getFund(
    @Param('fundId') fundId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Fund> {
    return this.giving.getFund(tenantOf(principal), fundId);
  }

  @Patch('funds/:fundId')
  @RequirePermissions(Permission.GIVING_RECORD)
  updateFund(
    @Param('fundId') fundId: string,
    @Body(new ZodValidationPipe(fundUpdateSchema)) body: FundUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Fund> {
    return this.giving.updateFund(tenantOf(principal), principal.userId, fundId, body);
  }

  @Post('contributions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.GIVING_RECORD)
  recordContribution(
    @Body(new ZodValidationPipe(contributionCreateSchema)) body: ContributionCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Contribution> {
    return this.giving.recordContribution(tenantOf(principal), principal.userId, body);
  }

  @Get('contributions')
  @RequirePermissions(Permission.GIVING_READ)
  listContributions(
    @Query(new ZodValidationPipe(contributionListQuerySchema)) query: ContributionListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ContributionPage> {
    return this.giving.listContributions(tenantOf(principal), query);
  }

  @Get('contributions/:contributionId')
  @RequirePermissions(Permission.GIVING_READ)
  getContribution(
    @Param('contributionId') contributionId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Contribution> {
    return this.giving.getContribution(tenantOf(principal), contributionId);
  }

  @Post('contributions/:contributionId/refund')
  @RequirePermissions(Permission.GIVING_REFUND)
  refundContribution(
    @Param('contributionId') contributionId: string,
    @Body(new ZodValidationPipe(contributionRefundSchema)) body: ContributionRefundRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Contribution> {
    return this.giving.refundContribution(tenantOf(principal), principal.userId, contributionId, body);
  }

  @Post('payroll/employees')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createEmployee(
    @Body(new ZodValidationPipe(payrollEmployeeCreateSchema)) body: PayrollEmployeeCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployee> {
    return this.payroll.createEmployee(tenantOf(principal), principal.userId, body);
  }

  @Get('payroll/employees')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listEmployees(
    @Query(new ZodValidationPipe(payrollEmployeeListQuerySchema)) query: PayrollEmployeeListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployeePage> {
    return this.payroll.listEmployees(tenantOf(principal), query);
  }

  @Get('payroll/employees/:employeeId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployee> {
    return this.payroll.getEmployee(tenantOf(principal), employeeId);
  }

  @Patch('payroll/employees/:employeeId')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateEmployee(
    @Param('employeeId') employeeId: string,
    @Body(new ZodValidationPipe(payrollEmployeeUpdateSchema)) body: PayrollEmployeeUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployee> {
    return this.payroll.updateEmployee(tenantOf(principal), principal.userId, employeeId, body);
  }

  @Post('payroll/runs')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createPayrollRun(
    @Body(new ZodValidationPipe(payrollRunCreateSchema)) body: PayrollRunCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.createRun(tenantOf(principal), principal.userId, body);
  }

  @Get('payroll/runs')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listPayrollRuns(
    @Query(new ZodValidationPipe(payrollRunListQuerySchema)) query: PayrollRunListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRunPage> {
    return this.payroll.listRuns(tenantOf(principal), query);
  }

  @Get('payroll/runs/:runId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getPayrollRun(
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.getRun(tenantOf(principal), runId);
  }

  @Post('payroll/runs/:runId/approve')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  approvePayrollRun(
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.approveRun(tenantOf(principal), principal.userId, runId);
  }

  @Post('payroll/runs/:runId/post')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postPayrollRun(
    @Param('runId') runId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.postRun(tenantOf(principal), principal.userId, runId);
  }

  @Post('budgets')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createBudget(
    @Body(new ZodValidationPipe(budgetCreateSchema)) body: BudgetCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Budget> {
    return this.budgets.createBudget(tenantOf(principal), principal.userId, body);
  }

  @Get('budgets')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBudgets(
    @Query(new ZodValidationPipe(budgetListQuerySchema)) query: BudgetListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BudgetPage> {
    return this.budgets.listBudgets(tenantOf(principal), query);
  }

  @Get('budgets/:budgetId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getBudget(
    @Param('budgetId') budgetId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Budget> {
    return this.budgets.getBudget(tenantOf(principal), budgetId);
  }

  @Post('budgets/:budgetId/activate')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  activateBudget(
    @Param('budgetId') budgetId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Budget> {
    return this.budgets.activateBudget(tenantOf(principal), principal.userId, budgetId);
  }

  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createProject(
    @Body(new ZodValidationPipe(projectCreateSchema)) body: ProjectCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Project> {
    return this.budgets.createProject(tenantOf(principal), principal.userId, body);
  }

  @Get('projects')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listProjects(
    @Query(new ZodValidationPipe(projectListQuerySchema)) query: ProjectListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ProjectPage> {
    return this.budgets.listProjects(tenantOf(principal), query);
  }

  @Get('projects/:projectId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getProject(
    @Param('projectId') projectId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Project> {
    return this.budgets.getProject(tenantOf(principal), projectId);
  }

  @Patch('projects/:projectId')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateProject(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(projectUpdateSchema)) body: ProjectUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Project> {
    return this.budgets.updateProject(tenantOf(principal), principal.userId, projectId, body);
  }

  @Post('vendors')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createVendor(
    @Body(new ZodValidationPipe(vendorCreateSchema)) body: VendorCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Vendor> {
    return this.procurement.createVendor(tenantOf(principal), principal.userId, body);
  }

  @Get('vendors')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listVendors(
    @Query(new ZodValidationPipe(vendorListQuerySchema)) query: VendorListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VendorPage> {
    return this.procurement.listVendors(tenantOf(principal), query);
  }

  @Get('vendors/:vendorId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getVendor(
    @Param('vendorId') vendorId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Vendor> {
    return this.procurement.getVendor(tenantOf(principal), vendorId);
  }

  @Patch('vendors/:vendorId')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateVendor(
    @Param('vendorId') vendorId: string,
    @Body(new ZodValidationPipe(vendorUpdateSchema)) body: VendorUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Vendor> {
    return this.procurement.updateVendor(tenantOf(principal), principal.userId, vendorId, body);
  }

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createPurchaseOrder(
    @Body(new ZodValidationPipe(purchaseOrderCreateSchema)) body: PurchaseOrderCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.createPurchaseOrder(tenantOf(principal), principal.userId, body);
  }

  @Get('purchase-orders')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listPurchaseOrders(
    @Query(new ZodValidationPipe(purchaseOrderListQuerySchema)) query: PurchaseOrderListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrderPage> {
    return this.procurement.listPurchaseOrders(tenantOf(principal), query);
  }

  @Get('purchase-orders/:purchaseOrderId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getPurchaseOrder(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.getPurchaseOrder(tenantOf(principal), purchaseOrderId);
  }

  @Post('purchase-orders/:purchaseOrderId/submit')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  submitPurchaseOrder(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.submitPurchaseOrder(tenantOf(principal), principal.userId, purchaseOrderId);
  }

  @Post('purchase-orders/:purchaseOrderId/approve')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  approvePurchaseOrder(
    @Param('purchaseOrderId') purchaseOrderId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PurchaseOrder> {
    return this.procurement.approvePurchaseOrder(tenantOf(principal), principal.userId, purchaseOrderId);
  }

  @Post('bills')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createBill(
    @Body(new ZodValidationPipe(billCreateSchema)) body: BillCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.createBill(tenantOf(principal), principal.userId, body);
  }

  @Get('bills')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBills(
    @Query(new ZodValidationPipe(billListQuerySchema)) query: BillListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BillPage> {
    return this.procurement.listBills(tenantOf(principal), query);
  }

  @Get('bills/:billId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getBill(
    @Param('billId') billId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.getBill(tenantOf(principal), billId);
  }

  @Post('bills/:billId/approve')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  approveBill(
    @Param('billId') billId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.approveBill(tenantOf(principal), principal.userId, billId);
  }

  @Post('bills/:billId/post')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postBill(
    @Param('billId') billId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Bill> {
    return this.procurement.postBill(tenantOf(principal), principal.userId, billId);
  }

  @Post('expenses')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createExpense(
    @Body(new ZodValidationPipe(expenseCreateSchema)) body: ExpenseCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.createExpense(tenantOf(principal), principal.userId, body);
  }

  @Get('expenses')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listExpenses(
    @Query(new ZodValidationPipe(expenseListQuerySchema)) query: ExpenseListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ExpensePage> {
    return this.procurement.listExpenses(tenantOf(principal), query);
  }

  @Get('expenses/:expenseId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getExpense(
    @Param('expenseId') expenseId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.getExpense(tenantOf(principal), expenseId);
  }

  @Post('expenses/:expenseId/submit')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  submitExpense(
    @Param('expenseId') expenseId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.submitExpense(tenantOf(principal), principal.userId, expenseId);
  }

  @Post('expenses/:expenseId/decide')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  decideExpense(
    @Param('expenseId') expenseId: string,
    @Body(new ZodValidationPipe(expenseDecisionSchema)) body: ExpenseDecisionRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.decideExpense(tenantOf(principal), principal.userId, expenseId, body);
  }

  @Post('expenses/:expenseId/post')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postExpense(
    @Param('expenseId') expenseId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Expense> {
    return this.procurement.postExpense(tenantOf(principal), principal.userId, expenseId);
  }

  @Post('banks')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createBankAccount(
    @Body(new ZodValidationPipe(bankAccountCreateSchema)) body: BankAccountCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankAccount> {
    return this.recon.createBankAccount(tenantOf(principal), principal.userId, body);
  }

  @Get('banks')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBankAccounts(
    @Query(new ZodValidationPipe(bankAccountListQuerySchema)) query: BankAccountListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankAccountPage> {
    return this.recon.listBankAccounts(tenantOf(principal), query);
  }

  @Get('banks/:bankAccountId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getBankAccount(
    @Param('bankAccountId') bankAccountId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankAccount> {
    return this.recon.getBankAccount(tenantOf(principal), bankAccountId);
  }

  @Post('banks/:bankAccountId/transactions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  addBankTransaction(
    @Param('bankAccountId') bankAccountId: string,
    @Body(new ZodValidationPipe(bankTransactionCreateSchema)) body: BankTransactionCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankTransaction> {
    return this.recon.addTransaction(tenantOf(principal), principal.userId, bankAccountId, body);
  }

  @Get('banks/:bankAccountId/transactions')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBankTransactions(
    @Param('bankAccountId') bankAccountId: string,
    @Query(new ZodValidationPipe(bankTransactionListQuerySchema)) query: BankTransactionListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankTransactionPage> {
    return this.recon.listTransactions(tenantOf(principal), bankAccountId, query);
  }

  @Post('banks/:bankAccountId/reconciliations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createReconciliation(
    @Param('bankAccountId') bankAccountId: string,
    @Body(new ZodValidationPipe(reconciliationCreateSchema)) body: ReconciliationCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.createReconciliation(tenantOf(principal), principal.userId, bankAccountId, body);
  }

  @Get('banks/:bankAccountId/reconciliations')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listReconciliations(
    @Param('bankAccountId') bankAccountId: string,
    @Query(new ZodValidationPipe(reconciliationListQuerySchema)) query: ReconciliationListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ReconciliationPage> {
    return this.recon.listReconciliations(tenantOf(principal), bankAccountId, query);
  }

  @Get('reconciliations/:reconciliationId')
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getReconciliation(
    @Param('reconciliationId') reconciliationId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.getReconciliation(tenantOf(principal), reconciliationId);
  }

  @Post('reconciliations/:reconciliationId/match')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  matchReconciliation(
    @Param('reconciliationId') reconciliationId: string,
    @Body(new ZodValidationPipe(reconciliationMatchSchema)) body: ReconciliationMatchRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.match(tenantOf(principal), principal.userId, reconciliationId, body);
  }

  @Post('reconciliations/:reconciliationId/complete')
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  completeReconciliation(
    @Param('reconciliationId') reconciliationId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.complete(tenantOf(principal), principal.userId, reconciliationId);
  }

  @Get('reports')
  @RequirePermissions(Permission.REPORT_READ)
  report(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Report> {
    return this.reports.generate(tenantOf(principal), query);
  }
}
