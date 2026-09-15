# Testing

Zion8 treats tests as part of the definition of done, not as an afterthought. The suite is split by
what each layer can prove, and the split is enforced by configuration so a test cannot silently
drift into the wrong tier.

## Tiers

| Tier | Location | Runtime | Proves |
| --- | --- | --- | --- |
| Unit | `apps/api/src/**/*.test.ts` | in-process, no I/O | Pure logic: token signing and verification, password hashing, guard decisions, policy evaluation, environment parsing. |
| End-to-end | `apps/api/test/**/*.e2e.test.ts` | real Postgres and Redis | Whole HTTP request lifecycles against real infrastructure, including RLS, migrations, rotation, and revocation. |
| Web | `apps/web` build | Next.js build | Types, linting, and that every route compiles and renders. |

## Commands

```bash
# Unit tests for the API
pnpm --filter @zion8/api test

# End-to-end tests (requires PostgreSQL and Redis)
pnpm --filter @zion8/api test:e2e

# Everything at the repository level
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## End-to-end harness

The end-to-end suite boots the real `AppModule` in-process with `Test.createTestingModule` and
drives it with `supertest`. Two properties make it deterministic and still honest:

1. **Real infrastructure.** It connects to the development PostgreSQL and Redis, so the tests
   exercise the same RLS policies, constraints, and migrations that production uses. A policy
   mistake fails a test rather than shipping.
2. **Captured delivery, not mocked delivery.** Out-of-band messages go through the
   `NotificationService` port. In tests the `logging` adapter captures them in memory, so a test
   can assert on the exact magic-link token or OTP code a user would receive without ever talking to
   a mail or SMS provider.

`LoggingNotificationService` exposes `recent()`, `lastFor(recipient, channel?)`, and `clear()` for
assertions. Tests parse the token or code out of the captured body, then present it to the API like
a user would, which means the assertions cover the real end-to-end path including hashing and
single-use semantics.

Every end-to-end run generates a unique `runId` and derives its workspace slug and email addresses
from it, so runs do not collide and history is retained for inspection.

## What the authentication suite covers

The end-to-end suite (`apps/api/test/auth.e2e.test.ts`) is the specification for the auth flows:

- Church registration, duplicate-slug rejection, and payload validation.
- Login success and failure, with uniform errors that do not leak account existence.
- Refresh rotation, reuse detection, and session revocation on logout.
- Magic-link request and single-use consumption.
- Email OTP request, verification, replay rejection, and wrong-code rejection.
- TOTP enrolment, confirmation, step-up on login, wrong-code rejection, and `AAL2` assurance.
- Session listing, the `current` marker, and immediate rejection of a revoked session's access
  token.
- Password reset as a single-use token, old-password rejection, and retention of MFA on the new
  password.

Unit tests cover the security-critical primitives in isolation: access-token signing and
tamper/expiry handling, refresh-token uniqueness and hashing, and the guard's decision table.

## Conventions

- Tests use `vitest` directly; there is no global setup that hides state.
- A test must not depend on execution order. Each end-to-end feature group registers its own
  workspace and users.
- Assertions target behaviour and stable error codes (`error.code`), not incidental status codes
  where a domain error is the real contract.
- New security behaviour arrives with a test that fails without the change.
