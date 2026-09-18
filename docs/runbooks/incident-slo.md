# SLO page

Pages fire when the API burns 2% of monthly error budget in an hour, or
PostgreSQL is unreachable. Sunday morning is the same runbook with less
patience.

## First five minutes

1. Open Grafana `zion8-overview`. Is it 5xx, latency, or dependency down?
2. Check `/api/v1/health/ready` on the active Service, not the preview.
3. If migrate is running, wait. A Rollout will not promote until it exits 0.
4. If a Rollout is in progress, abort. Traffic returns to the last good set.

## Dependency down

- Postgres `down`: RDS console, failover if the AZ is gone. App role must
  stay `NOBYPASSRLS`.
- Redis `degraded`: API stays up; sessions may drop. Flush is allowed.
- S3 errors: memory uploads fail; membership does not. Check IRSA.

## Notification backlog

`zion8_notification_messages_pending{status="PENDING"}` high means workers
are stuck or a provider is BLOCKED. Check worker logs for
`EMAIL_NOT_CONFIGURED` / `SMS_NOT_CONFIGURED`. Missing provider keys are not
an infra outage.

## Close

Error budget consumption and customer-facing minutes go in the incident
ticket. A follow-up PR is required if a dashboard or probe was wrong.
