'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  accountCreateSchema,
  accountUpdateSchema,
  bankAccountCreateSchema,
  bankTransactionCreateSchema,
  billCreateSchema,
  budgetCreateSchema,
  contributionCreateSchema,
  contributionRefundSchema,
  expenseCreateSchema,
  expenseDecisionSchema,
  fiscalPeriodCreateSchema,
  fundCreateSchema,
  fundUpdateSchema,
  journalCreateSchema,
  journalVoidSchema,
  payrollEmployeeCreateSchema,
  payrollEmployeeUpdateSchema,
  payrollRunCreateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  purchaseOrderCreateSchema,
  reconciliationCreateSchema,
  reconciliationMatchSchema,
  vendorCreateSchema,
  vendorUpdateSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import {
  checkbox,
  dollarsToMinor,
  optionalText,
  requireToken,
  submitForm,
  text,
} from '@/lib/form-utils';
import type { FormState } from '@/lib/form-state';

function revalidateAccounting(path?: string): void {
  revalidatePath('/accounting');
  revalidatePath('/accounting/journals');
  revalidatePath('/accounting/giving');
  revalidatePath('/accounting/payroll');
  revalidatePath('/accounting/budgets');
  revalidatePath('/accounting/projects');
  revalidatePath('/accounting/procurement');
  revalidatePath('/accounting/recon');
  revalidatePath('/accounting/reports');
  if (path) revalidatePath(path);
}

function optionalUuid(formData: FormData, key: string): string | undefined {
  return optionalText(formData, key);
}

function collectIndexed(formData: FormData, max: number, build: (index: number) => Record<string, unknown> | null) {
  const items: Record<string, unknown>[] = [];
  for (let index = 0; index < max; index += 1) {
    const item = build(index);
    if (item) items.push(item);
  }
  return items;
}

export async function createAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    code: text(formData, 'code').trim(),
    name: text(formData, 'name').trim(),
    type: text(formData, 'type'),
    isPostable: checkbox(formData, 'isPostable'),
  };
  const parentId = optionalUuid(formData, 'parentId');
  if (parentId) payload.parentId = parentId;
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;
  const normalBalance = optionalText(formData, 'normalBalance');
  if (normalBalance !== undefined) payload.normalBalance = normalBalance;

  return submitForm(accountCreateSchema, payload, async (input) => {
    await api.createAccount(token, input);
    revalidateAccounting();
    return { status: 'success', message: 'Account created.' };
  });
}

export async function updateAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const accountId = text(formData, 'accountId');
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    isPostable: checkbox(formData, 'isPostable'),
    status: optionalText(formData, 'status'),
  };
  const description = optionalText(formData, 'description');
  payload.description = description ?? null;
  const parentId = optionalUuid(formData, 'parentId');
  payload.parentId = parentId ?? null;

  return submitForm(accountUpdateSchema, payload, async (input) => {
    await api.updateAccount(token, accountId, input);
    revalidateAccounting();
    return { status: 'success', message: 'Account updated.' };
  });
}

export async function createPeriodAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload = {
    name: text(formData, 'name').trim(),
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
  };
  return submitForm(fiscalPeriodCreateSchema, payload, async (input) => {
    await api.createPeriod(token, input);
    revalidateAccounting();
    return { status: 'success', message: 'Fiscal period created.' };
  });
}

export async function closePeriodAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  await api.closePeriod(token, text(formData, 'periodId'));
  revalidateAccounting();
}

export async function createJournalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    memo: text(formData, 'memo').trim(),
    occurredOn: text(formData, 'occurredOn'),
    source: optionalText(formData, 'source') ?? 'MANUAL',
    lines: collectIndexed(formData, 8, (index) => {
      const accountId = optionalUuid(formData, `lineAccountId_${index}`);
      if (!accountId) return null;
      const description = optionalText(formData, `lineDescription_${index}`);
      return {
        accountId,
        debitMinor: dollarsToMinor(formData, `lineDebit_${index}`) ?? 0,
        creditMinor: dollarsToMinor(formData, `lineCredit_${index}`) ?? 0,
        ...(description ? { description } : {}),
      };
    }),
  };
  const reference = optionalText(formData, 'reference');
  if (reference !== undefined) payload.reference = reference;

  return submitForm(journalCreateSchema, payload, async (input) => {
    const created = await api.createJournal(token, input);
    revalidateAccounting(`/accounting/journals/${created.id}`);
    return redirect(`/accounting/journals/${created.id}`);
  });
}

export async function postJournalAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const journalId = text(formData, 'journalId');
  await api.postJournal(token, journalId);
  revalidateAccounting(`/accounting/journals/${journalId}`);
}

export async function voidJournalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const journalId = text(formData, 'journalId');
  const payload = { reason: text(formData, 'reason').trim() };
  return submitForm(journalVoidSchema, payload, async (input) => {
    await api.voidJournal(token, journalId, input);
    revalidateAccounting(`/accounting/journals/${journalId}`);
    return { status: 'success', message: 'Journal voided.' };
  });
}

export async function createFundAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    restricted: checkbox(formData, 'restricted'),
  };
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;
  const revenueAccountId = optionalUuid(formData, 'revenueAccountId');
  if (revenueAccountId) payload.revenueAccountId = revenueAccountId;
  const assetAccountId = optionalUuid(formData, 'assetAccountId');
  if (assetAccountId) payload.assetAccountId = assetAccountId;

  return submitForm(fundCreateSchema, payload, async (input) => {
    await api.createFund(token, input);
    revalidateAccounting('/accounting/giving');
    return { status: 'success', message: 'Fund created.' };
  });
}

export async function updateFundAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const fundId = text(formData, 'fundId');
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    restricted: checkbox(formData, 'restricted'),
    status: optionalText(formData, 'status'),
  };
  payload.description = optionalText(formData, 'description') ?? null;
  payload.revenueAccountId = optionalUuid(formData, 'revenueAccountId') ?? null;
  payload.assetAccountId = optionalUuid(formData, 'assetAccountId') ?? null;

  return submitForm(fundUpdateSchema, payload, async (input) => {
    await api.updateFund(token, fundId, input);
    revalidateAccounting('/accounting/giving');
    return { status: 'success', message: 'Fund updated.' };
  });
}

export async function recordContributionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    fundId: text(formData, 'fundId'),
    amountMinor: dollarsToMinor(formData, 'amount'),
    currency: optionalText(formData, 'currency') ?? 'USD',
    method: optionalText(formData, 'method') ?? 'CASH',
    receivedOn: text(formData, 'receivedOn'),
    taxDeductible: checkbox(formData, 'taxDeductible'),
  };
  const memberId = optionalUuid(formData, 'memberId');
  if (memberId) payload.memberId = memberId;
  const donorName = optionalText(formData, 'donorName');
  if (donorName !== undefined) payload.donorName = donorName;
  const externalRef = optionalText(formData, 'externalRef');
  if (externalRef !== undefined) payload.externalRef = externalRef;
  const note = optionalText(formData, 'note');
  if (note !== undefined) payload.note = note;

  return submitForm(contributionCreateSchema, payload, async (input) => {
    await api.recordContribution(token, input);
    revalidateAccounting('/accounting/giving');
    revalidateAccounting('/accounting/journals');
    return { status: 'success', message: 'Contribution recorded and posted.' };
  });
}

export async function refundContributionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const contributionId = text(formData, 'contributionId');
  const payload = { reason: text(formData, 'reason').trim() };
  return submitForm(contributionRefundSchema, payload, async (input) => {
    await api.refundContribution(token, contributionId, input);
    revalidateAccounting('/accounting/giving');
    return { status: 'success', message: 'Contribution refunded.' };
  });
}

export async function createPayrollEmployeeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    displayName: text(formData, 'displayName').trim(),
    payFrequency: optionalText(formData, 'payFrequency') ?? 'MONTHLY',
    grossMinor: dollarsToMinor(formData, 'gross'),
  };
  const memberId = optionalUuid(formData, 'memberId');
  if (memberId) payload.memberId = memberId;
  const title = optionalText(formData, 'title');
  if (title !== undefined) payload.title = title;
  const expenseAccountId = optionalUuid(formData, 'expenseAccountId');
  if (expenseAccountId) payload.expenseAccountId = expenseAccountId;
  const liabilityAccountId = optionalUuid(formData, 'liabilityAccountId');
  if (liabilityAccountId) payload.liabilityAccountId = liabilityAccountId;

  return submitForm(payrollEmployeeCreateSchema, payload, async (input) => {
    await api.createPayrollEmployee(token, input);
    revalidateAccounting('/accounting/payroll');
    return { status: 'success', message: 'Employee added.' };
  });
}

export async function updatePayrollEmployeeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const employeeId = text(formData, 'employeeId');
  const payload: Record<string, unknown> = {
    displayName: text(formData, 'displayName').trim(),
    payFrequency: optionalText(formData, 'payFrequency'),
    status: optionalText(formData, 'status'),
  };
  const title = optionalText(formData, 'title');
  payload.title = title ?? null;
  const gross = dollarsToMinor(formData, 'gross');
  if (gross !== undefined) payload.grossMinor = gross;
  payload.expenseAccountId = optionalUuid(formData, 'expenseAccountId') ?? null;
  payload.liabilityAccountId = optionalUuid(formData, 'liabilityAccountId') ?? null;

  return submitForm(payrollEmployeeUpdateSchema, payload, async (input) => {
    await api.updatePayrollEmployee(token, employeeId, input);
    revalidateAccounting('/accounting/payroll');
    return { status: 'success', message: 'Employee updated.' };
  });
}

export async function createPayrollRunAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    periodStart: text(formData, 'periodStart'),
    periodEnd: text(formData, 'periodEnd'),
    payOn: text(formData, 'payOn'),
  };
  const memo = optionalText(formData, 'memo');
  if (memo !== undefined) payload.memo = memo;

  return submitForm(payrollRunCreateSchema, payload, async (input) => {
    const created = await api.createPayrollRun(token, input);
    revalidateAccounting(`/accounting/payroll/${created.id}`);
    return redirect(`/accounting/payroll/${created.id}`);
  });
}

export async function approvePayrollRunAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const runId = text(formData, 'runId');
  await api.approvePayrollRun(token, runId);
  revalidateAccounting(`/accounting/payroll/${runId}`);
}

export async function postPayrollRunAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const runId = text(formData, 'runId');
  await api.postPayrollRun(token, runId);
  revalidateAccounting(`/accounting/payroll/${runId}`);
}

export async function createBudgetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
    lines: collectIndexed(formData, 8, (index) => {
      const accountId = optionalUuid(formData, `lineAccountId_${index}`);
      if (!accountId) return null;
      const notes = optionalText(formData, `lineNotes_${index}`);
      return {
        accountId,
        amountMinor: dollarsToMinor(formData, `lineAmount_${index}`) ?? 0,
        ...(notes ? { notes } : {}),
      };
    }),
  };
  const notes = optionalText(formData, 'notes');
  if (notes !== undefined) payload.notes = notes;

  return submitForm(budgetCreateSchema, payload, async (input) => {
    const created = await api.createBudget(token, input);
    revalidateAccounting(`/accounting/budgets/${created.id}`);
    return redirect(`/accounting/budgets/${created.id}`);
  });
}

export async function activateBudgetAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const budgetId = text(formData, 'budgetId');
  await api.activateBudget(token, budgetId);
  revalidateAccounting(`/accounting/budgets/${budgetId}`);
}

export async function createProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    budgetMinor: dollarsToMinor(formData, 'budget') ?? 0,
  };
  const description = optionalText(formData, 'description');
  if (description !== undefined) payload.description = description;
  const startsOn = optionalText(formData, 'startsOn');
  if (startsOn !== undefined) payload.startsOn = startsOn;
  const endsOn = optionalText(formData, 'endsOn');
  if (endsOn !== undefined) payload.endsOn = endsOn;
  const expenseAccountId = optionalUuid(formData, 'expenseAccountId');
  if (expenseAccountId) payload.expenseAccountId = expenseAccountId;

  return submitForm(projectCreateSchema, payload, async (input) => {
    await api.createProject(token, input);
    revalidateAccounting('/accounting/projects');
    return { status: 'success', message: 'Project created.' };
  });
}

export async function updateProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const projectId = text(formData, 'projectId');
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    status: optionalText(formData, 'status'),
  };
  payload.description = optionalText(formData, 'description') ?? null;
  payload.startsOn = optionalText(formData, 'startsOn') ?? null;
  payload.endsOn = optionalText(formData, 'endsOn') ?? null;
  const budget = dollarsToMinor(formData, 'budget');
  if (budget !== undefined) payload.budgetMinor = budget;
  payload.expenseAccountId = optionalUuid(formData, 'expenseAccountId') ?? null;

  return submitForm(projectUpdateSchema, payload, async (input) => {
    await api.updateProject(token, projectId, input);
    revalidateAccounting('/accounting/projects');
    return { status: 'success', message: 'Project updated.' };
  });
}

export async function createVendorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = { name: text(formData, 'name').trim() };
  for (const key of ['contactName', 'email', 'phone', 'notes'] as const) {
    const value = optionalText(formData, key);
    if (value !== undefined) payload[key] = value;
  }
  return submitForm(vendorCreateSchema, payload, async (input) => {
    await api.createVendor(token, input);
    revalidateAccounting('/accounting/procurement');
    return { status: 'success', message: 'Vendor created.' };
  });
}

export async function updateVendorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const vendorId = text(formData, 'vendorId');
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    status: optionalText(formData, 'status'),
  };
  payload.contactName = optionalText(formData, 'contactName') ?? null;
  payload.email = optionalText(formData, 'email') ?? null;
  payload.phone = optionalText(formData, 'phone') ?? null;
  payload.notes = optionalText(formData, 'notes') ?? null;
  return submitForm(vendorUpdateSchema, payload, async (input) => {
    await api.updateVendor(token, vendorId, input);
    revalidateAccounting('/accounting/procurement');
    return { status: 'success', message: 'Vendor updated.' };
  });
}

export async function createPurchaseOrderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    vendorId: text(formData, 'vendorId'),
    orderedOn: text(formData, 'orderedOn'),
    lines: collectIndexed(formData, 6, (index) => {
      const description = optionalText(formData, `lineDescription_${index}`);
      if (!description) return null;
      const quantity = Number(optionalText(formData, `lineQuantity_${index}`) ?? '1');
      const accountId = optionalUuid(formData, `lineAccountId_${index}`);
      return {
        description,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unitCostMinor: dollarsToMinor(formData, `lineUnitCost_${index}`) ?? 0,
        ...(accountId ? { accountId } : {}),
      };
    }),
  };
  const expectedOn = optionalText(formData, 'expectedOn');
  if (expectedOn !== undefined) payload.expectedOn = expectedOn;
  const memo = optionalText(formData, 'memo');
  if (memo !== undefined) payload.memo = memo;
  const projectId = optionalUuid(formData, 'projectId');
  if (projectId) payload.projectId = projectId;

  return submitForm(purchaseOrderCreateSchema, payload, async (input) => {
    const created = await api.createPurchaseOrder(token, input);
    revalidateAccounting(`/accounting/procurement/purchase-orders/${created.id}`);
    return redirect(`/accounting/procurement/purchase-orders/${created.id}`);
  });
}

export async function submitPurchaseOrderAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const purchaseOrderId = text(formData, 'purchaseOrderId');
  await api.submitPurchaseOrder(token, purchaseOrderId);
  revalidateAccounting(`/accounting/procurement/purchase-orders/${purchaseOrderId}`);
}

export async function approvePurchaseOrderAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const purchaseOrderId = text(formData, 'purchaseOrderId');
  await api.approvePurchaseOrder(token, purchaseOrderId);
  revalidateAccounting(`/accounting/procurement/purchase-orders/${purchaseOrderId}`);
}

export async function createBillAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    vendorId: text(formData, 'vendorId'),
    billedOn: text(formData, 'billedOn'),
    expenseAccountId: text(formData, 'expenseAccountId'),
    amountMinor: dollarsToMinor(formData, 'amount'),
  };
  const purchaseOrderId = optionalUuid(formData, 'purchaseOrderId');
  if (purchaseOrderId) payload.purchaseOrderId = purchaseOrderId;
  const dueOn = optionalText(formData, 'dueOn');
  if (dueOn !== undefined) payload.dueOn = dueOn;
  const memo = optionalText(formData, 'memo');
  if (memo !== undefined) payload.memo = memo;
  const projectId = optionalUuid(formData, 'projectId');
  if (projectId) payload.projectId = projectId;

  return submitForm(billCreateSchema, payload, async (input) => {
    const created = await api.createBill(token, input);
    revalidateAccounting(`/accounting/procurement/bills/${created.id}`);
    return redirect(`/accounting/procurement/bills/${created.id}`);
  });
}

export async function approveBillAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const billId = text(formData, 'billId');
  await api.approveBill(token, billId);
  revalidateAccounting(`/accounting/procurement/bills/${billId}`);
}

export async function postBillAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const billId = text(formData, 'billId');
  await api.postBill(token, billId);
  revalidateAccounting(`/accounting/procurement/bills/${billId}`);
}

export async function createExpenseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    incurredOn: text(formData, 'incurredOn'),
    amountMinor: dollarsToMinor(formData, 'amount'),
    memo: text(formData, 'memo').trim(),
    expenseAccountId: text(formData, 'expenseAccountId'),
  };
  const memberId = optionalUuid(formData, 'memberId');
  if (memberId) payload.memberId = memberId;
  const submitterName = optionalText(formData, 'submitterName');
  if (submitterName !== undefined) payload.submitterName = submitterName;
  const merchant = optionalText(formData, 'merchant');
  if (merchant !== undefined) payload.merchant = merchant;
  const projectId = optionalUuid(formData, 'projectId');
  if (projectId) payload.projectId = projectId;
  const departmentId = optionalUuid(formData, 'departmentId');
  if (departmentId) payload.departmentId = departmentId;

  return submitForm(expenseCreateSchema, payload, async (input) => {
    const created = await api.createExpense(token, input);
    revalidateAccounting(`/accounting/procurement/expenses/${created.id}`);
    return redirect(`/accounting/procurement/expenses/${created.id}`);
  });
}

export async function submitExpenseAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const expenseId = text(formData, 'expenseId');
  await api.submitExpense(token, expenseId);
  revalidateAccounting(`/accounting/procurement/expenses/${expenseId}`);
}

export async function decideExpenseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const expenseId = text(formData, 'expenseId');
  const payload: Record<string, unknown> = { decision: text(formData, 'decision') };
  const note = optionalText(formData, 'note');
  if (note !== undefined) payload.note = note;
  return submitForm(expenseDecisionSchema, payload, async (input) => {
    await api.decideExpense(token, expenseId, input);
    revalidateAccounting(`/accounting/procurement/expenses/${expenseId}`);
    return { status: 'success', message: `Expense ${input.decision.toLowerCase()}.` };
  });
}

export async function postExpenseAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const expenseId = text(formData, 'expenseId');
  await api.postExpense(token, expenseId);
  revalidateAccounting(`/accounting/procurement/expenses/${expenseId}`);
}

export async function createBankAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const payload: Record<string, unknown> = {
    name: text(formData, 'name').trim(),
    glAccountId: text(formData, 'glAccountId'),
  };
  const institution = optionalText(formData, 'institution');
  if (institution !== undefined) payload.institution = institution;
  const accountNumberMasked = optionalText(formData, 'accountNumberMasked');
  if (accountNumberMasked !== undefined) payload.accountNumberMasked = accountNumberMasked;

  return submitForm(bankAccountCreateSchema, payload, async (input) => {
    const created = await api.createBankAccount(token, input);
    revalidateAccounting(`/accounting/recon/${created.id}`);
    return redirect(`/accounting/recon/${created.id}`);
  });
}

export async function addBankTransactionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const bankAccountId = text(formData, 'bankAccountId');
  const payload: Record<string, unknown> = {
    occurredOn: text(formData, 'occurredOn'),
    amountMinor: dollarsToMinor(formData, 'amount'),
    kind: text(formData, 'kind'),
    description: text(formData, 'description').trim(),
  };
  const externalRef = optionalText(formData, 'externalRef');
  if (externalRef !== undefined) payload.externalRef = externalRef;

  return submitForm(bankTransactionCreateSchema, payload, async (input) => {
    await api.addBankTransaction(token, bankAccountId, input);
    revalidateAccounting(`/accounting/recon/${bankAccountId}`);
    return { status: 'success', message: 'Bank transaction added.' };
  });
}

export async function createReconciliationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const bankAccountId = text(formData, 'bankAccountId');
  const payload = {
    statementOn: text(formData, 'statementOn'),
    statementBalanceMinor: dollarsToMinor(formData, 'statementBalance') ?? 0,
  };
  return submitForm(reconciliationCreateSchema, payload, async (input) => {
    const created = await api.createReconciliation(token, bankAccountId, input);
    revalidateAccounting(`/accounting/recon/reconciliations/${created.id}`);
    return redirect(`/accounting/recon/reconciliations/${created.id}`);
  });
}

export async function matchReconciliationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireToken();
  const reconciliationId = text(formData, 'reconciliationId');
  const payload = {
    bankTransactionId: text(formData, 'bankTransactionId'),
    journalId: text(formData, 'journalId'),
  };
  return submitForm(reconciliationMatchSchema, payload, async (input) => {
    await api.matchReconciliation(token, reconciliationId, input);
    revalidateAccounting(`/accounting/recon/reconciliations/${reconciliationId}`);
    return { status: 'success', message: 'Transaction matched.' };
  });
}

export async function completeReconciliationAction(formData: FormData): Promise<void> {
  const token = await requireToken();
  const reconciliationId = text(formData, 'reconciliationId');
  await api.completeReconciliation(token, reconciliationId);
  revalidateAccounting(`/accounting/recon/reconciliations/${reconciliationId}`);
}
