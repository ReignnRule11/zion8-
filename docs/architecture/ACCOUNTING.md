# Accounting

The accounting context is Zion8's books of record for a church: chart of accounts,
general ledger, giving, payroll, budgets, projects, procurement, expense approval,
bank reconciliation, and financial reports. It is a bounded context of its own,
`apps/api/src/modules/accounting`, exposed over two transports that share the
same contracts, services, and permissions:

- **REST** at `/api/v1/accounting` for CRUD and posting.
- **GraphQL** at `/graphql` (Apollo, code-first) mirroring the REST surface.

Giving lives here, not as a separate module. A contribution is a journal source,
not a second cash book. Membership remains the person of record; accounting never
owns pastoral identity.

## Why a separate context

Membership is who belongs. Memory is the archive. Sermon is publication.
Accounting is *money that must balance*. Those invariants do not belong on a
member row or a gift form:

- Journals must debit equal credit, in integer minor units, inside an open period.
- Posted journals are immutable; voiding writes a reversing entry.
- Restricted funds cannot silently become operating cash.
- Bank rec completes only when `differenceMinor === 0`.

Keeping them apart means a pastor can record a gift without knowing GL codes,
and a finance officer can close a period without touching membership.

## Money

Amounts are integer minor units (cents, kobo, pence). Prisma stores `bigint`;
contracts expose `number`. Currency travels beside the amount as a 3-letter ISO
code so a church can keep books in NGN without floating point. The web UI
converts major units on submit via `dollarsToMinor`.

## Default chart

On first tenant use `LedgerService.ensureChart` seeds `DEFAULT_CHART_ACCOUNTS`:

| Code | Name | Type |
|------|------|------|
| 1000 | Operating Cash | ASSET |
| 1100 | Undeposited Funds | ASSET |
| 1200 | Accounts Receivable | ASSET |
| 2000 | Accounts Payable | LIABILITY |
| 2100 | Payroll Liabilities | LIABILITY |
| 3000 | Net Assets | EQUITY |
| 3100 | Restricted Net Assets | EQUITY |
| 4000 | Tithes and Offerings | REVENUE |
| 4100 | Designated Giving | REVENUE |
| 5000 | Ministry Expenses | EXPENSE |
| 5100 | Payroll Expense | EXPENSE |
| 5200 | Facilities Expense | EXPENSE |

Normal balance follows type (debit for asset/expense, credit otherwise) unless
the create payload overrides it. Header accounts may set `isPostable=false`.

## Aggregates

| Aggregate | Tables | Role |
|-----------|--------|------|
| Account | `gl_accounts` | Chart of accounts. Never hard-deleted; archived. |
| Fiscal period | `fiscal_periods` | Open / closed / locked window journals must land in. |
| Journal | `journals` + `journal_lines` | Double-entry document. Draft, posted, or void. |
| Fund | `giving_funds` | Restricted or unrestricted envelope for gifts. |
| Contribution | `contributions` | A gift; posting writes cash and revenue. |
| Payroll employee | `payroll_employees` | Staff pay configuration. |
| Payroll run | `payroll_runs` + `payroll_items` | Period batch; posting writes expense and liability. |
| Budget | `budgets` + `budget_lines` | Named plan vs actual on GL accounts. |
| Project | `finance_projects` | Capital/ministry envelope with spend to date. |
| Vendor | `vendors` | Payee. |
| Purchase order | `purchase_orders` + `purchase_order_lines` | Commitment before the bill. |
| Bill | `bills` | Vendor invoice; posting writes expense and AP. |
| Expense | `expenses` | Staff claim with submit / decide / post. |
| Bank account | `bank_accounts` | Statement identity linked to a cash GL account. |
| Bank transaction | `bank_transactions` | Statement line. |
| Reconciliation | `bank_reconciliations` + matches | Completes only when difference is zero. |

All accounting tables use `FORCE ROW LEVEL SECURITY`. Reads and writes go
through `withTenant` / `withScope`. Audit rows are written in the same
transaction via `AuditService.record`. Domain events go through the
transactional outbox (`accounting.journal.posted`, `accounting.journal.voided`,
`accounting.period.closed`).

## Invariants

- `journalCreateSchema.superRefine` refuses unbalanced or zero journals and
  mixed debit/credit on one line.
- Posting and voiding refuse a closed or locked period (`PERIOD_CLOSED`).
- Voiding a posted journal writes a reversing journal; the original stays
  `VOID` with `voidReason`.
- Giving, payroll, bills, and expenses post through `LedgerService.writeJournal`
  so every automatic entry is a real journal with a source (`GIVING`,
  `PAYROLL`, `PROCUREMENT`, `EXPENSE`).
- Refunds reverse revenue to cash and create a `REFUNDED` contribution linked
  by `refundOfId`.
- Payroll tax is a deterministic 10% withholding until a tax engine exists.
- Bank rec `complete` returns `RECONCILIATION_UNBALANCED` unless
  `differenceMinor === 0`.

## Permissions

No new Permission keys. Existing IAM grants become real:

| Permission | Who (default) | What |
|------------|---------------|------|
| `accounting:read` | FINANCE_OFFICER and above | Chart, journals, payroll, budgets, procurement, recon. |
| `accounting:manage` | FINANCE_OFFICER, OWNER | Create/update, post, approve, match. |
| `accounting:close-period` | FINANCE_OFFICER | Close an open fiscal period. |
| `giving:read` | FINANCE_OFFICER and roles granted it | Funds and contributions. |
| `giving:record` | FINANCE_OFFICER | Create funds, record gifts. |
| `giving:refund` | FINANCE_OFFICER | Reverse a contribution. |
| `report:read` | FINANCE_OFFICER, SENIOR_PASTOR, ADMINISTRATOR, OWNER | Financial reports. |

`ADMINISTRATOR` does not receive giving or period-close by default. That is
deliberate: pastoral administration is not a finance officer.

## REST map

Authenticated, tenant from the principal:

- `POST/GET /accounting/accounts`, `GET/PATCH /accounting/accounts/:accountId`
- `POST/GET /accounting/periods`, `POST /accounting/periods/:periodId/close`
- `POST/GET /accounting/journals`, `GET /accounting/journals/:journalId`
- `POST /accounting/journals/:journalId/post`
- `POST /accounting/journals/:journalId/void`
- `POST/GET /accounting/funds`, `GET/PATCH /accounting/funds/:fundId`
- `POST/GET /accounting/contributions`, `GET /accounting/contributions/:contributionId`
- `POST /accounting/contributions/:contributionId/refund`
- `POST/GET /accounting/payroll/employees`, `GET/PATCH /accounting/payroll/employees/:employeeId`
- `POST/GET /accounting/payroll/runs`, `GET /accounting/payroll/runs/:runId`
- `POST /accounting/payroll/runs/:runId/approve`
- `POST /accounting/payroll/runs/:runId/post`
- `POST/GET /accounting/budgets`, `GET /accounting/budgets/:budgetId`
- `POST /accounting/budgets/:budgetId/activate`
- `POST/GET /accounting/projects`, `GET/PATCH /accounting/projects/:projectId`
- `POST/GET /accounting/vendors`, `GET/PATCH /accounting/vendors/:vendorId`
- `POST/GET /accounting/purchase-orders`, `GET /accounting/purchase-orders/:purchaseOrderId`
- `POST /accounting/purchase-orders/:purchaseOrderId/submit`
- `POST /accounting/purchase-orders/:purchaseOrderId/approve`
- `POST/GET /accounting/bills`, `GET /accounting/bills/:billId`
- `POST /accounting/bills/:billId/approve`
- `POST /accounting/bills/:billId/post`
- `POST/GET /accounting/expenses`, `GET /accounting/expenses/:expenseId`
- `POST /accounting/expenses/:expenseId/submit`
- `POST /accounting/expenses/:expenseId/decide`
- `POST /accounting/expenses/:expenseId/post`
- `POST/GET /accounting/banks`, `GET /accounting/banks/:bankAccountId`
- `POST/GET /accounting/banks/:bankAccountId/transactions`
- `POST/GET /accounting/banks/:bankAccountId/reconciliations`
- `GET /accounting/reconciliations/:reconciliationId`
- `POST /accounting/reconciliations/:reconciliationId/match`
- `POST /accounting/reconciliations/:reconciliationId/complete`
- `GET /accounting/reports`

GraphQL names follow the same verbs: `glAccounts` / `createGlAccount`,
`givingFunds` / `recordContribution`, `financeProjects`, `accountingReport`
(`REPORT_READ`), `closeFiscalPeriod` (`ACCOUNTING_CLOSE_PERIOD`). Resolvers
pass args through the same Zod contracts via `ZodValidationPipe`.

## Web

Dashboard CRUD lives under `/accounting` with a sub-nav for ledger, journals,
giving, payroll, budgets, projects, procurement, bank rec, and reports.
Middleware treats `/accounting` as an authenticated matcher.

## Tests

- `packages/contracts/src/accounting/accounting.schemas.test.ts` — money,
  journal balance, refunds, recon difference, report kinds.
- `apps/api/test/accounting.e2e.test.ts` — chart seed, journal post/void,
  giving auto-post, payroll 10% tax, recon complete, tenant isolation.

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module and layering rules.
- [MEMBERSHIP.md](./MEMBERSHIP.md) — people gifts may attach to.
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) — row-level security and `withTenant`.
- [AUTHENTICATION.md](./AUTHENTICATION.md) — principals and permissions.
