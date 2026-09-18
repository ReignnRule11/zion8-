# Church Onboarding

A new church workspace moves through a fixed sequence of steps after registration. The backend
owns the journey; every client renders it.

```
Church Registration -> Email Verification -> Tenant Provisioning -> Workspace Creation
  -> Administrator Invitation -> Subscription Selection -> Brand Customization
  -> First Member Import -> Dashboard Ready
```

`REGISTRATION`, `EMAIL_VERIFICATION`, `TENANT_PROVISIONING`, and `WORKSPACE_CREATION` are required;
the dashboard does not unlock until they are complete. The remaining steps are optional and can be
finished later from settings, so a church can start using Zion8 without filling every form first.

## The journey is a projection, not a script

The client is never trusted to drive the sequence. Each step's status is recomputed from facts that
already exist in the database:

| Step | Fact that completes it |
|------|------------------------|
| Registration | The workspace has a `CHURCH_OWNER` membership |
| Email verification | The owner's `users.email_verified_at` is set |
| Tenant provisioning | A `tenant_subscriptions` row exists (auto-seeded to FREE) |
| Workspace creation | A `church_profiles` row exists |
| Administrator invitation | At least one `tenant_invitations` row exists |
| Subscription selection | A `tenant_subscriptions` row exists |
| Brand customization | A `brand_themes` row exists |
| First member import | A completed `member_import_jobs` row, or more than one active member |
| Dashboard ready | Marked explicitly by the owner via `POST /onboarding/complete` |

`OnboardingService.reconcile` reads those facts inside one transaction, repairs any step whose
status drifted, advances `current_step`, and returns the state. It runs on every read, so a closed
tab, a crash, or a failed request can never leave the journey stuck or ahead of reality. Because the
side effects are derived from persisted facts, reconciliation is idempotent.

Optional steps only ever move forward. Skipping a step writes `SKIPPED` and reconciliation will not
undo it, so a deliberate choice survives later reads.

Registration and email verification also call `OnboardingService.reconcileForUser`, which finds the
tenant the user owns and reconciles immediately. That is what makes a freshly registered owner land
on a journey that already shows registration and verification as complete.

## Enforcing order

`OnboardingService.assertReachable` refreshes the state and refuses an operation when an earlier
*required* step is not complete. Optional steps are not prerequisites for each other, so an owner can
customise branding before inviting anyone, but they cannot import members before the workspace
exists. An out-of-order call returns `ONBOARDING_STEP_OUT_OF_ORDER` (HTTP 409) with the missing steps.

## Provisioning

Provisioning is a side effect of reaching a verified workspace, not a button. When reconciliation
observes registration and email verification complete but no subscription, it seeds the FREE plan so
the workspace is immediately usable; the owner can change the plan during onboarding or later. A
failure is caught, recorded on the step as `FAILED` with `last_error`, and retried on the next
reconcile, so a transient failure does not corrupt the journey.

## Administrator invitations

Invitations reuse the shared `VerificationChallenge` primitive with a new `INVITATION` purpose
rather than introducing a second token scheme. The `tenant_invitations` row is the business record
(who, which role, accepted or revoked, how many times it was sent); it points at the live challenge
through `challenge_id`, so a re-send supersedes the previous token instead of leaving two valid
tokens in circulation.

- Only roles strictly below the inviter can be assigned (`outranks`), and ministry-level roles are
  not offered during onboarding.
- `preview` resolves a token to a public projection (church, role, inviter, whether the invitee
  already has an account) without consuming it, so the accept page can render before the bearer
  decides.
- `accept` consumes the token, provisions the account if needed, upserts the membership, marks the
  email verified (possession of the link proves ownership), and returns a session.
- Invitees who already have a Zion8 account are linked, not duplicated, which makes it safe to
  invite an existing user from another church.

## First member import

The import is two-phase so a large file is never half-applied.

1. `POST /onboarding/member-imports/preview` parses CSV (RFC 4180, hand-written and unit tested in
   `csv.ts`) or structured rows, validates every row, and persists a `READY` job holding the valid
   rows and a precise, per-row list of issues. Validation is total: a problem in one row is reported
   and never blocks the others.
2. `POST /onboarding/member-imports/commit` applies the valid rows in bounded chunks, persisting
   `resume_index` after each chunk. A failure part-way through leaves a resumable `PARTIAL` job; a
   retry continues from where it stopped instead of re-importing or losing the remainder.

Re-importing an email that already has an account links the existing user (counted as a duplicate)
rather than failing. Rows whose membership already exists are skipped.

## API surface

Tenant-scoped routes require an authenticated session with an active workspace and are guarded by
permissions (`TENANT_READ`, `TENANT_UPDATE`, `USER_INVITE`, `WEBSITE_MANAGE`, `MEMBER_CREATE`).

```
GET    /onboarding                         journey state (reconciled)
GET    /onboarding/summary                 lightweight status for redirects
POST   /onboarding/complete                finalise once required steps are done
POST   /onboarding/steps/:step/skip        skip an optional step
POST   /onboarding/steps/:step/retry       clear an error and re-run
GET    /onboarding/workspace               church profile
PUT    /onboarding/workspace               create or update the profile
GET    /onboarding/branding                brand theme
PUT    /onboarding/branding                create or update the theme
GET    /onboarding/subscription/catalog    plan catalogue (source of truth)
GET    /onboarding/subscription            current plan
PUT    /onboarding/subscription            select a plan
GET    /onboarding/invitations             list invitations
POST   /onboarding/invitations             invite administrators
POST   /onboarding/invitations/:id/resend  re-send an invitation
DELETE /onboarding/invitations/:id         revoke an invitation
GET    /onboarding/member-imports          list import jobs
GET    /onboarding/member-imports/:jobId   one import job
POST   /onboarding/member-imports/preview  parse and validate
POST   /onboarding/member-imports/commit   apply a validated job
```

Public (no session) routes support the invitee before they have an account:

```
GET  /onboarding/invitations/preview?token=...
POST /onboarding/invitations/accept
POST /onboarding/invitations/decline
```

## Persistence and isolation

All onboarding tables (`tenant_onboardings`, `tenant_onboarding_steps`, `church_profiles`,
`tenant_invitations`, `tenant_subscriptions`, `brand_themes`, `member_import_jobs`) carry
`tenant_id` and are protected by PostgreSQL row-level security with `FORCE ROW LEVEL SECURITY`. Reads
and writes go through `PrismaService.withTenant(tenantId, ...)`, which sets the transaction-local
`app.current_tenant`; the application role is `NOBYPASSRLS`. Cross-tenant identity lookups during an
import use an explicit platform-admin scope, which is the documented escape hatch for provisioning
operations that touch the global `users` and `user_identities` tables.

## Error handling

| Code | Meaning |
|------|---------|
| `ONBOARDING_STEP_OUT_OF_ORDER` | An earlier required step is incomplete, or a required step was skipped |
| `ONBOARDING_INCOMPLETE` | `complete` was called while required steps remain |
| `ONBOARDING_ALREADY_COMPLETED` | The journey is already finalised |
| `INVITATION_NOT_FOUND` / `INVITATION_EXPIRED` / `INVITATION_ALREADY_ACCEPTED` / `INVITATION_ALREADY_EXISTS` | Invitation lifecycle conflicts |
| `SUBSCRIPTION_PLAN_UNAVAILABLE` | The requested plan is not in the catalogue |
| `MEMBER_IMPORT_INVALID` / `MEMBER_IMPORT_NOT_READY` | The import file is unreadable, or the job cannot be applied |

## Web client

The owner-facing wizard lives at `apps/web/src/app/onboarding`. The server component reads
`GET /onboarding`, resolves the active step from `?step=` (falling back to the reconciled
`currentStep`), and renders a stepper beside a single step panel. Each panel loads only the data it
needs (`workspace`, `branding`, `subscription` + `catalog`, `invitations`, `member-imports`).

Client components hold only ephemeral UI state (a draft service schedule, invitee rows, pasted CSV)
and post to server actions in `apps/web/src/app/onboarding/actions.ts`. Actions re-validate every
payload with the shared Zod contracts before calling the API, so the browser is never the authority
on shape or order. A step whose earlier required steps are incomplete renders a locked panel that
links to the first outstanding step, mirroring the API's `assertReachable` check rather than
duplicating it.

Steps that are informational (`REGISTRATION`, `EMAIL_VERIFICATION`, `TENANT_PROVISIONING`) are
reported from reconciled status and expose a retry control when the step is `FAILED`. Optional steps
expose **Skip for now**; the dashboard step exposes **Open the dashboard**, which calls
`POST /onboarding/complete`. New registrations redirect to `/onboarding`, and the workspace dashboard
shows a resume banner while the journey is unfinished.

Invitees land on the public `apps/web/src/app/invitations/[token]` page, which previews the
invitation through the public endpoint and either links an existing account or collects a name and
password before accepting.

## Tests

- `src/modules/onboarding/csv.test.ts` - RFC 4180 parsing, quoting, BOM, blank lines.
- `src/modules/onboarding/member-import.parser.test.ts` - row validation, duplicate detection,
  existing-member warnings, partial success.
- `test/onboarding.e2e.test.ts` - the full journey over real Postgres and Redis, plus recovery paths:
  out-of-order rejection, skipping and retrying optional steps, invitation acceptance and replay,
  and an import that reports invalid rows without blocking valid ones.
