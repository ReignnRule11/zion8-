'use client';

import { useActionState } from 'react';
import { ApprovalDecision, type Account, type Project, type Vendor } from '@zion8/contracts';
import {
  createBillAction,
  createExpenseAction,
  createPurchaseOrderAction,
  createVendorAction,
  decideExpenseAction,
} from '@/app/(dashboard)/accounting/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

export function VendorForm() {
  const [state, formAction] = useActionState(createVendorAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor name" htmlFor="vendor-name">
          <input id="vendor-name" name="name" required placeholder="City Electric" className={inputClass} />
        </Field>
        <Field label="Contact" htmlFor="vendor-contact">
          <input id="vendor-contact" name="contactName" className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="vendor-email">
          <input id="vendor-email" name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="vendor-phone">
          <input id="vendor-phone" name="phone" className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Creating vendor">Create vendor</SubmitButton>
    </form>
  );
}

export function PurchaseOrderForm({
  vendors,
  accounts,
  projects,
}: {
  vendors: Vendor[];
  accounts: Account[];
  projects: Project[];
}) {
  const [state, formAction] = useActionState(createPurchaseOrderAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor" htmlFor="po-vendor">
          <select id="po-vendor" name="vendorId" required className={inputClass}>
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ordered on" htmlFor="po-date">
          <input id="po-date" name="orderedOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Expected on" htmlFor="po-expected">
          <input id="po-expected" name="expectedOn" type="date" className={inputClass} />
        </Field>
        <Field label="Project" htmlFor="po-project">
          <select id="po-project" name="projectId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-200">Lines</p>
        {[0, 1, 2].map((index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-4">
            <input name={`lineDescription_${index}`} placeholder="Description" className={inputClass} />
            <input name={`lineQuantity_${index}`} type="number" min="1" step="1" placeholder="Qty" className={inputClass} />
            <input name={`lineUnitCost_${index}`} type="number" min="0" step="0.01" placeholder="Unit cost" className={inputClass} />
            <select name={`lineAccountId_${index}`} defaultValue="" className={inputClass}>
              <option value="">Account</option>
              {accounts
                .filter((account) => account.type === 'EXPENSE')
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} {account.name}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </div>
      <SubmitButton pendingLabel="Creating PO">Create purchase order</SubmitButton>
    </form>
  );
}

export function BillForm({
  vendors,
  accounts,
  projects,
}: {
  vendors: Vendor[];
  accounts: Account[];
  projects: Project[];
}) {
  const [state, formAction] = useActionState(createBillAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor" htmlFor="bill-vendor">
          <select id="bill-vendor" name="vendorId" required className={inputClass}>
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" htmlFor="bill-amount">
          <input id="bill-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
        </Field>
        <Field label="Billed on" htmlFor="bill-date">
          <input id="bill-date" name="billedOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Due on" htmlFor="bill-due">
          <input id="bill-due" name="dueOn" type="date" className={inputClass} />
        </Field>
        <Field label="Expense account" htmlFor="bill-account">
          <select id="bill-account" name="expenseAccountId" required className={inputClass}>
            <option value="">Select account</option>
            {accounts
              .filter((account) => account.type === 'EXPENSE')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Project" htmlFor="bill-project">
          <select id="bill-project" name="projectId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Memo" htmlFor="bill-memo">
        <input id="bill-memo" name="memo" className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Creating bill">Create bill</SubmitButton>
    </form>
  );
}

export function ExpenseForm({ accounts, projects }: { accounts: Account[]; projects: Project[] }) {
  const [state, formAction] = useActionState(createExpenseAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Submitter" htmlFor="exp-name">
          <input id="exp-name" name="submitterName" placeholder="Staff name" className={inputClass} />
        </Field>
        <Field label="Merchant" htmlFor="exp-merchant">
          <input id="exp-merchant" name="merchant" className={inputClass} />
        </Field>
        <Field label="Amount" htmlFor="exp-amount">
          <input id="exp-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
        </Field>
        <Field label="Incurred on" htmlFor="exp-date">
          <input id="exp-date" name="incurredOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Expense account" htmlFor="exp-account">
          <select id="exp-account" name="expenseAccountId" required className={inputClass}>
            <option value="">Select account</option>
            {accounts
              .filter((account) => account.type === 'EXPENSE')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Project" htmlFor="exp-project">
          <select id="exp-project" name="projectId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Memo" htmlFor="exp-memo">
        <input id="exp-memo" name="memo" required className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Creating expense">Create expense</SubmitButton>
    </form>
  );
}

export function ExpenseDecisionForm({ expenseId }: { expenseId: string }) {
  const [state, formAction] = useActionState(decideExpenseAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <Field label="Decision" htmlFor="exp-decision">
        <select id="exp-decision" name="decision" defaultValue={ApprovalDecision.APPROVED} className={inputClass}>
          <option value={ApprovalDecision.APPROVED}>Approve</option>
          <option value={ApprovalDecision.REJECTED}>Reject</option>
        </select>
      </Field>
      <Field label="Note" htmlFor="exp-note">
        <input id="exp-note" name="note" className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Saving decision">Record decision</SubmitButton>
    </form>
  );
}
