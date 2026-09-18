# Production deploy

Zion8 production ships from a signed git tag. Merge to `main` only updates
staging. Do not `kubectl apply` from a laptop.

## Preconditions

- CI `verify` and `security` are green on the commit.
- Docker workflow pushed and signed `zion8-api`, `zion8-web`, `zion8-migrate`.
- Staging has run the same digest for at least one hour with no SLO burn page.
- Change window is outside Sunday 07:00–13:00 in the majority tenant timezone,
  unless this is a severity-1 hotfix.

## Cut a release

```bash
# From main, after Changesets or an explicit version bump
git tag -s v0.1.0
git push origin v0.1.0
```

`deploy-production.yml` pins `infrastructure/kubernetes/overlays/production`
to that tag and pushes the overlay. Argo CD then:

1. Runs the `migrate` Job with `MIGRATION_DATABASE_URL` (owner role).
2. Creates the preview ReplicaSet for `api` and `web`.
3. Analyzes `/api/v1/health/ready` five times.
4. Moves the Service selector.
5. Keeps the previous ReplicaSet for 15 minutes.

## Abort

Argo Rollouts aborts on failed analysis. Traffic returns to the previous
set. Do not delete the old ReplicaSet by hand.

```bash
kubectl argo rollouts get rollout api -n zion8
kubectl argo rollouts abort api -n zion8
```

## Hotfix

Branch `hotfix/<ticket>` from the production tag, PR with expedited review,
tag `vX.Y.Z+hotfix.N`, same pipeline. Do not patch live containers.

## After

- Confirm Grafana `zion8-overview` and notification queue gauges.
- Confirm migrate Job logs show `All migrations have been successfully applied`.
- Record the tag in the release notes.
