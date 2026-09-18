# Restore PostgreSQL from PITR

PostgreSQL is the system of record. Redis, OpenSearch, and object indexes
rebuild. This runbook restores RDS, not a Kubernetes volume.

## RPO / RTO

Production: RPO 5 minutes (WAL), RTO 4 hours for a region event, 30 minutes
for a bad migration that has not been followed by a blue-green promote.

## Decide

1. Is the primary still accepting writes? If yes, prefer a clone, not a
   promote, so the ledger is not forked.
2. Identify the restore time: last known-good migrate Job completion, or the
   minute before the incident.
3. Page the incident commander. Cross-region failover is a human decision.

## Restore in the same region (bad migration)

```bash
# Clone to a new instance at a point in time. Names are examples.
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier zion8-production-pg \
  --target-db-instance-identifier zion8-production-pg-restore \
  --restore-time 2026-09-18T11:00:00Z \
  --db-subnet-group-name zion8-production-pg \
  --vpc-security-group-ids sg-placeholder
```

Point a preview namespace `ExternalSecret` at the clone. Run API e2e against
it. Only then change `DATABASE_URL` in Secrets Manager and restart pods.

## Restore across regions

1. Promote the cross-region replica only after confirming the primary cannot
   recover.
2. Update Secrets Manager in the surviving region.
3. Apply Terraform for a warm EKS if the cluster is gone.
4. Argo CD sync production overlay to that cluster.
5. Redis is empty: users sign in again. That is accepted.

## After

- Re-run `migrate` only if the restored schema is behind the image. Never
  run migrate "to be sure" on a restore that is already at HEAD.
- Rebuild OpenSearch from Postgres jobs.
- Record the restore time and the snapshot identifier in the incident ticket.

## What not to do

- Do not restore Redis snapshots that contain sessions into a new cluster
  without rotating `JWT_ACCESS_SECRET`.
- Do not replay the outbox from a clone that also stayed primary; events
  would double-send mail.
