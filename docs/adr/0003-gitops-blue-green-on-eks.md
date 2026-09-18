# 3. GitOps blue-green on EKS, not in-cluster CI deploys

- **Status:** Accepted
- **Date:** 2026-09-18
- **Context:** Zion8 is a multi-tenant church operating system. A bad deploy
  can take Sunday check-in, giving, and the archive offline together, because
  the product is still a modular monolith. The repository already committed to
  GitOps (`docs/architecture/REPOSITORY_STRUCTURE.md`) and to production-only
  code. The remaining choice is how images reach a cluster and how traffic
  moves from the previous replica set to the next.

## Decision

- **AWS is the reference cloud.** EKS, RDS PostgreSQL with `pgvector`,
  ElastiCache Redis, S3, Secrets Manager, and CloudFront. Other clouds can
  map the same topology; they are not a second source of truth.
- **Images are built in GitHub Actions, signed, and pushed.** The cluster
  never builds. Argo CD reconciles `infrastructure/kubernetes` from `main`
  (staging) and from a release tag (production).
- **Production traffic shifts with Argo Rollouts blue-green**, not a rolling
  update and not a second cluster. Analysis probes `/api/v1/health/ready`
  and error-rate SLOs before the Service selector moves.
- **The API image is the worker image.** In-process pollers (outbox, memory,
  AI, sermon, notifications) run in a dedicated Deployment of that image with
  worker flags on. API replicas keep those flags off so N pods do not claim
  the same `SKIP LOCKED` jobs.
- **Secrets live in AWS Secrets Manager** and reach pods through the External
  Secrets Operator. Nothing secret is committed, baked into an image, or
  typed into a GitHub environment by hand as a long-lived value.

## Rationale

- A modular monolith fails as one process. Blue-green keeps a full, ready
  replica set on the previous image until the new one has passed the same
  readiness contract the load balancer already uses.
- GitOps makes the live cluster a function of a reviewed git ref. A
  `kubectl apply` from a laptop cannot be the production path.
- Reusing the API image for workers avoids a second Dockerfile drifting from
  the domain that already owns the pollers.
- Row-Level Security, the transactional outbox, and object storage already
  assume PostgreSQL and S3-compatible blobs. Choosing a cloud that has those
  as managed services is cheaper than operating them.

## Trade-offs accepted

- Blue-green briefly doubles API and web capacity during a production
  rollout. Staging may use rolling updates to save cost.
- AWS lock-in at the managed-service layer. Compute and config stay portable
  (OCI images, Kubernetes manifests, Terraform modules with a documented
  mapping).
- Workers are still in-process pollers, not NATS consumers. Extraction of
  `workers` remains an architecture milestone, not a prerequisite for going
  live.

## Consequences

- `docs/architecture/DEVOPS.md` is the operational design.
- Production promotion is a signed git tag, never a merge.
- A failed analysis automatically returns traffic to the previous ReplicaSet.
  There is no manual "cut back" as the happy path.
