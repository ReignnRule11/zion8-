# Notifications

The notifications context is Zion8's outbound and in-app messaging surface:
templates, audience segments, scheduled campaigns, per-recipient delivery,
retry, and analytics. It is a bounded context of its own,
`apps/api/src/modules/notifications`, exposed over REST at
`/api/v1/notifications`.

Auth already depends on a delivery **port** in the same module
(`NotificationService`: Resend email, Twilio SMS, logging fallback). That port
stays. Campaigns compose around it. They never call a provider inside a
domain transaction.

## Why a separate context

Membership is who belongs. Memory is the archive. Accounting is money that
must balance. Notifications are *messages that must be delivered or honestly
fail*. Those invariants do not belong on a member row or an auth mailer:

- A send is not a side effect of `POST`. It is a durable job.
- A missing provider is BLOCKED with a named reason, never a silent success.
- Audience membership is snapshotted at send time so later directory edits
  cannot rewrite who was addressed.
- In-app inbox, email, SMS, WhatsApp, and push share one delivery record.

Keeping the port and the campaign aggregate together means auth can still
`sendEmail` without knowing about campaigns, and a pastor can schedule a
SMS blast without knowing Resend.

## Channels

| Channel | Address | Provider | Missing provider |
| --- | --- | --- | --- |
| `EMAIL` | `Member.email` | Resend when `RESEND_API_KEY` is set, else logging adapter | BLOCKED `EMAIL_NOT_CONFIGURED` in production; logging adapter in development/test |
| `SMS` | `Member.phone` (E.164) | Twilio when SID+token+from are set, else logging | BLOCKED `SMS_NOT_CONFIGURED` in production |
| `WHATSAPP` | `Member.phone` | Twilio WhatsApp when `WHATSAPP_FROM_NUMBER` and Twilio are set | BLOCKED `WHATSAPP_NOT_CONFIGURED` |
| `PUSH` | `NotificationDevice.token` for the member's linked user | HTTP endpoint when `NOTIFICATION_PUSH_ENDPOINT` is set | BLOCKED `PUSH_NOT_CONFIGURED` or `NO_DEVICE_TOKEN` |
| `IN_APP` | the member row (and `userId` when linked) | PostgreSQL inbox | always available |

The logging adapter is a capture buffer for tests and local development. In
production it redacts the recipient and does not print bodies. A production
campaign on a channel whose provider is unset becomes BLOCKED, not logged-as-
sent: that is what keeps the inbox honest.

## Aggregates

| Aggregate | Tables | Role |
| --- | --- | --- |
| Template | `notification_templates` | Named body/subject per channel. Never hard-deleted; archived. |
| Audience | `notification_audiences` | Saved member filter (status, tags, department, family, volunteer role, explicit ids). |
| Campaign | `notification_campaigns` | A send: template or inline copy, channel, audience snapshot, schedule. |
| Message | `notification_messages` | One recipient on one channel. The delivery job. |
| Device | `notification_devices` | Push token for a linked user. |

All notification tables use `FORCE ROW LEVEL SECURITY`. Reads and writes go
through `withTenant` / `withScope`. Workers claim with `withoutScope` and
`FOR UPDATE SKIP LOCKED`, the same pattern as `OutboxEvent` and
`MemoryProcessingJob`. Domain events go through the transactional outbox
(`notification.campaign.scheduled`, `notification.campaign.sent`,
`notification.campaign.cancelled`, `notification.message.sent`).

## Queue and retry

There is no second queue. A message **is** the job.

1. `send` or `schedule` resolves the audience, writes one `notification_messages`
   row per recipient, and commits. `availableAt` is now or the schedule instant.
2. `NotificationJobRunner` claims `PENDING` rows due for delivery with
   `FOR UPDATE SKIP LOCKED`, bounded `maxAttempts` (default 5), exponential
   backoff (5s .. 5m).
3. A missing provider or missing address becomes `BLOCKED` with
   `blockedReason`. Exhausted retries become `FAILED` with `lastError`.
4. `IN_APP` is marked `SENT` as soon as the row exists in the inbox; there is
   no network hop.
5. When every message on a campaign is terminal (`SENT`, `DELIVERED`,
   `FAILED`, `BLOCKED`, `CANCELLED`), the campaign becomes `SENT` or `FAILED`.

Cancel writes `CANCELLED` on the campaign and on every still-pending message
in the same transaction. Already-sent rows are left alone.

```
Web / API                 PostgreSQL                    Worker
   |                          |                            |
   |  POST /campaigns/:id/send |                            |
   |------------------------->|  campaign + messages       |
   |                          |  + outbox (same tx)        |
   |                          |                            |
   |                          |  SKIP LOCKED claim         |
   |                          |<---------------------------|
   |                          |  NotificationService       |
   |                          |  email / sms / wa / push   |
   |                          |  SENT or BLOCKED/FAILED    |
```

Scheduled campaigns do not expand twice. Expansion happens once at
send/schedule time; the clock only gates `availableAt`.

## Templates

Bodies are plain text (and optional HTML for email) with `{{placeholder}}`
tokens. The renderer substitutes a small, fixed dictionary per recipient:

`firstName`, `lastName`, `fullName`, `preferredName`, `email`, `phone`,
`churchName`.

Unknown tokens become empty strings. There is no expression language and no
HTML injection beyond the author-supplied `html` field, which is stored as
given and handed to Resend.

## Audience segmentation

An audience is the membership list query, not a new person store. Saved
audiences and inline campaign filters both accept:

`status`, `tag`, `departmentId`, `familyId`, `volunteerRoleId`, `gender`,
`maritalStatus`, `search`, `memberIds`.

Preview (`GET .../audiences/:id/preview`) runs the same filter and returns a
count plus a bounded sample. At send time the matching member ids are copied
onto the campaign as `audienceSnapshot`. Later joins, archives, or tag edits
do not change who was messaged.

Recipients without a usable address for the channel still get a message row,
already `BLOCKED` with `MISSING_CONTACT`, so analytics do not hide them.

## In-app inbox

`IN_APP` messages are the inbox. `GET /notifications/inbox` returns messages
addressed to the caller's linked member (`Member.userId = principal.userId`).
`POST /notifications/inbox/:messageId/read` sets `readAt`. Members hold
`notification:read` by default; they do not hold `notification:send`, so they
cannot blast the directory.

## Permissions

No new Permission keys. Existing IAM grants become real:

| Permission | Who (default) | What |
| --- | --- | --- |
| `notification:read` | MEMBER and above (not VISITOR) | Templates, campaigns, messages, inbox, analytics. |
| `notification:send` | MINISTRY_LEADER, ADMINISTRATOR, SENIOR_PASTOR, OWNER | Create/update templates and audiences, send/schedule/cancel, register is not required for devices. |

Device registration is the caller's own token and requires only an
authenticated tenant principal (`notification:read`).

`FINANCE_OFFICER` does not receive notification grants by default. That is
deliberate: finance is not a communications officer.

## REST map

Authenticated, tenant from the principal:

- `POST/GET /notifications/templates`
- `GET/PATCH /notifications/templates/:templateId`
- `POST/GET /notifications/audiences`
- `GET /notifications/audiences/:audienceId`
- `GET /notifications/audiences/:audienceId/preview`
- `POST/GET /notifications/campaigns`
- `GET /notifications/campaigns/:campaignId`
- `POST /notifications/campaigns/:campaignId/send`
- `POST /notifications/campaigns/:campaignId/schedule`
- `POST /notifications/campaigns/:campaignId/cancel`
- `GET /notifications/campaigns/:campaignId/messages`
- `GET /notifications/campaigns/:campaignId/analytics`
- `GET /notifications/analytics`
- `GET /notifications/inbox`
- `POST /notifications/inbox/:messageId/read`
- `POST /notifications/devices`

## Monitoring and recovery

| Signal | Where | Recovery |
| --- | --- | --- |
| Worker poll | structured log every interval; disabled under `NODE_ENV=test` | set `NOTIFICATION_WORKER_ENABLED=true` |
| Claimed batch size | `NOTIFICATION_WORKER_BATCH_SIZE` | raise bound; SKIP LOCKED stays safe across instances |
| BLOCKED messages | `blockedReason` on the row; campaign analytics counts | configure the provider, then `POST .../send` is not retried automatically — operator re-sends a new campaign or waits: a BLOCKED row is terminal until a future requeue is added |
| FAILED after max attempts | `lastError`, exponential backoff then park | inspect provider; create a new campaign for the failed slice |
| Outbox relay | same `OutboxRelay` as memory/sermon | existing `OUTBOX_*` flags |
| Provider HTTP errors | thrown from adapters, caught by the worker, retried | not in-transaction; the message returns to PENDING |

A blocked job is visible and actionable, never silently "done". That is the
same honesty rule as OCR-not-configured on the archive worker.

## Web

Dashboard CRUD lives under `/notifications` with a sub-nav for inbox,
campaigns, templates, audiences, and analytics. Middleware treats
`/notifications` as an authenticated matcher. The executive home widget
reads `GET /notifications/campaigns` when the principal holds
`notification:read`.

## Tests

- `packages/contracts/src/notifications/notification.schemas.test.ts` —
  channels, schedule vs send, audience filters, template placeholders.
- `apps/api/src/modules/notifications/notification.utils.test.ts` —
  rendering, backoff, terminal campaign status.

## Related

- `docs/architecture/ARCHITECTURE.md` — module and layering rules; notifications
  remain an extraction candidate.
- `docs/architecture/MEMBERSHIP.md` — people an audience may include.
- `docs/architecture/AUTHENTICATION.md` — the delivery port used by auth mail.
- `docs/architecture/MULTI_TENANCY.md` — row-level security and `withTenant`.
- `docs/architecture/DASHBOARD.md` — home widget composition.
- `docs/architecture/MEMORY_ENGINE.md` — SKIP LOCKED worker pattern this copies.
