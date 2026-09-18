# Mobile application

The Flutter client in `apps/mobile` is a first-class consumer of the versioned
HTTP API. It is not a companion wrapper around the web app: it has its own
navigation, its own offline cache, and its own session lifecycle, but it never
invents a second contract. Every request and response is the same shape the
web application and the API already share.

This document is the design. The Dart tree under `apps/mobile/lib` is the
implementation.

## Why a separate client

Church staff work in parking lots, fellowship halls, and homes where the
network drops. A pastor recording attendance or a finance officer reviewing a
gift cannot wait for a round trip. The mobile client is therefore
**offline-first**: the screen reads Hive, mutations land in an outbox, and a
sync engine reconciles with `/api/v1` when the radio returns.

The client is also the only surface that can do three things the browser
cannot do honestly:

1. **Biometric unlock** of a stored refresh token, so a short-lived access
   token is never left sitting in a cookie jar on a shared device.
2. **Background sync**, so a contribution recorded on Sunday is posted before
   staff open the app on Monday.
3. **Push**, so a pastoral follow-up or a processing job does not require the
   app to be in the foreground.

## Guiding constraints

These are the same constraints as the rest of Zion8, applied to a device:

1. **API-first.** The mobile app does not talk to Postgres, Redis, or NATS.
   It talks to `/api/v1`. Generated OpenAPI clients replace hand-written DTOs
   as soon as `packages/contracts` emits `openapi.json`; until then the Dio
   adapters in `lib/core/network` mirror the Zod contracts 1:1.
2. **Production code only.** A route that exists is a route that works
   offline, under a revoked session, and with a tenant that has no data.
3. **Tenant isolation is a server guarantee.** The client still scopes every
   Hive key by `tenantId`, because a device can switch churches. A cache miss
   after a switch is required behaviour, not an optimisation.
4. **Secrets never touch Hive.** Access and refresh tokens live in
   `flutter_secure_storage`. Hive holds projections, outbox payloads, and
   preferences.
5. **Design tokens are shared.** Colour, spacing, and type come from the same
   palette as the web app (`zion` indigo, slate, sky). A tenant brand theme
   overlays primary/secondary/accent from `GET /onboarding/branding`.

## Architectural decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Feature layout | Feature-first folders | Bounded contexts on the server (`auth`, `membership`, `sermon`, `accounting`, `memory`) map 1:1 onto `lib/features/*`, so a stream-aligned team owns one folder. |
| State | Riverpod 2 (`Notifier`, `AsyncNotifier`) | No `BuildContext` in business logic; overrides make widget tests mechanical; no code generation required for the core graph. |
| Navigation | GoRouter | Deep links (`zion8://sermons/:id`, magic-link consume) and a single redirect table for session/MFA/lock/onboarding. |
| Local store | Hive | Fast key-value, isolate-friendly, no SQL schema to migrate on a phone. Boxes are named and versioned; values are JSON maps. |
| Offline | Cache-then-network + outbox | Reads never block on the radio. Writes are acknowledged locally and drained by `SyncEngine`. |
| Background | `connectivity_plus` + `workmanager` | Foreground: connectivity stream kicks the engine. Background: a 15-minute OS task drains the outbox. |
| Push | `firebase_messaging` + local notifications | A data message names the collections to invalidate; the engine then pulls. Token upload waits for the notifications bounded context. |
| Biometrics | `local_auth` | Unlocks the refresh token already on the device. It is not a new identity provider; the API still sees `REFRESH`. |
| Layout | Compact / medium / expanded | `NavigationBar` under 600dp, `NavigationRail` to 1024dp, `NavigationDrawer` above. One widget tree, three scaffolds. |

## Layers

Dependencies point inward. A feature may import `core/`. `core/` may not
import `features/`. Features do not import each other; they meet at Riverpod
providers and at GoRouter.

```
lib/
  main.dart
  bootstrap.dart                         # Hive, secure store, sync, push
  app.dart                               # ProviderScope + MaterialApp.router
  core/                                  # Cross-cutting. No feature imports.
    config/                              # Flavor, base URL, dart-defines
    theme/                               # Tokens, ThemeData, brand overlay
    network/                             # Dio, interceptors, error mapping
    storage/                             # Hive boxes, secure store, cache
    sync/                                # Outbox, engine, background task
    notifications/                       # FCM + local notifications
    biometrics/                          # local_auth port
    router/                              # GoRouter, redirects, shell
    widgets/                             # Design-system primitives
    accessibility/                       # Reduce-motion, tap targets, semantics
    errors/                              # ApiException, Result
  features/
    <context>/
      data/                              # API + Hive adapters
      domain/                            # Entities, ports
      presentation/                      # Providers, screens, feature widgets
```

Inside a feature the Clean Architecture rule is the same as the API: domain
knows nothing about Dio or Hive; data implements the port; presentation talks
to the port through Riverpod.

## Navigation

Named locations live in `core/router/routes.dart`. The redirect table is the
only place that interprets `AuthState`:

| Auth state | Allowed locations | Redirect |
| --- | --- | --- |
| `unknown` | `/splash` | stay |
| `unauthenticated` | `/sign-in`, `/sign-up`, `/forgot-password`, `/otp`, `/magic-link` | else `/sign-in` |
| `mfaRequired` | `/mfa` | else `/mfa` |
| `locked` | `/lock` | else `/lock` |
| `authenticated`, onboarding incomplete | `/onboarding` | else `/onboarding` |
| `authenticated` | `/app/**` | else `/app/home` |

The authenticated shell destinations:

| Location | Feature | Permission gate |
| --- | --- | --- |
| `/app/home` | Today: attendance shortcut, latest sermon, giving snapshot | any authenticated membership |
| `/app/people` | Members, families, visitors, attendance | `member:read` |
| `/app/sermons` | Library, series, player, notes | `sermon:read` |
| `/app/give` | Funds, record a gift, recents | `giving:read` |
| `/app/more` | Memory, settings, sessions, tenant switch | any |

Finance-heavy accounting screens (journals, payroll, bank rec) stay on the
web application. The phone is for recording and reviewing, not for closing a
period.

Deep links:

- `https://<web>/magic-link?token=` and `zion8://auth/magic-link?token=` consume
  a magic link.
- `zion8://sermons/:sermonId` opens a sermon.
- `zion8://people/:memberId` opens a member.

## Authentication

The mobile session is the same `Session` object the API returns
(`accessToken`, `refreshToken`, `sessionId`, `assuranceLevel`,
`mfaSatisfied`). Persistence:

| Secret | Store |
| --- | --- |
| Access token, refresh token, session id | `flutter_secure_storage` |
| `mfaToken` (in-flight only) | memory |
| Biometric-unlock flag, last tenant slug | Hive `prefs` |
| Principal / me projection | Hive `cache`, keyed by user id |

Flows, identical to `docs/architecture/AUTHENTICATION.md`:

1. **Password.** `POST /auth/login`. Either a `Session` or
   `{ mfaRequired, mfaToken, factors[] }`.
2. **MFA.** `POST /auth/mfa/verify` with the in-memory `mfaToken`.
3. **Magic link / OTP.** Request always looks successful; consume yields a
   session or an MFA challenge.
4. **Register church.** `POST /auth/register-church` then the onboarding
   journey, which the backend owns.
5. **Refresh.** The Dio interceptor retries once on `401` /
   `TOKEN_EXPIRED`. A rotated-token reuse (`TOKEN_REVOKED`) clears the
   secure store and sends the user to sign-in.
6. **Biometric unlock.** On cold start, if the flag is on and a refresh
   token exists, `local_auth` runs before `POST /auth/refresh`. Failure
   stays on `/lock`; there is no password fallback on that screen other
   than "sign in another way", which clears the device session.
7. **Tenant switch.** `POST /auth/switch-tenant` with the refresh token.
   Hive cache keys include `tenantId`, so a switch does not leak the
   previous church's projections onto the next screen.

Biometrics are not an `AuthenticationMethod`. The API records `REFRESH`.
The device records that a user proved presence before that refresh was
allowed to leave the phone.

## State management

Riverpod is the only state container. The graph is deliberate:

```
appConfigProvider
secureStoreProvider
hiveBoxesProvider
apiClientProvider  ──uses──> sessionStoreProvider  (reads tokens)
syncEngineProvider ──uses──> outboxProvider, apiClientProvider, cacheStoreProvider
authControllerProvider     ──uses──> authRepository, biometricService, sessionStore
meControllerProvider       ──uses──> apiClient, cacheStore
brandThemeControllerProvider
```

Rules:

- A `Notifier` owns a single aggregate or a single screen's form.
- Network calls return `Result<T, ApiException>` in data sources; presentation
  maps that onto `AsyncValue`.
- Feature providers may watch `authControllerProvider` for the token and
  tenant; they may not call Dio themselves.
- `ref.invalidate(listProvider)` is how push and sync tell the UI to rebuild.
  There is no event bus.

## Offline-first and sync

```
UI  -->  repository.list()  -->  Hive (immediate)
                            \->  GET /api/v1/...  -->  Hive  -->  UI

UI  -->  repository.write() -->  Hive (optimistic)
                            \->  outbox.enqueue(method, path, body, idempotencyKey)
                            \->  syncEngine.kick()
```

Outbox item:

| Field | Purpose |
| --- | --- |
| `id` | Hive key |
| `idempotencyKey` | Sent as `Idempotency-Key`; the API's timeline already dedupes |
| `method`, `path`, `body` | The HTTP call to replay |
| `createdAt` | Drain order |
| `attempts`, `nextAttemptAt` | Exponential backoff |
| `collection`, `resourceId` | So a successful drain can patch the cache |

Drain rules:

- Stop on `UNAUTHENTICATED` / `TOKEN_REVOKED`; the auth controller signs out.
- Retry on network failure and on `5xx`.
- Drop on `4xx` other than 401/408/429, and surface the `error.code` on the
  cached row so the UI can show that the optimistic write was rejected.
- Never reorder items that share a `resourceId`.

`Workmanager` registers `zion8-sync` at 15 minutes. The callback opens Hive
(already isolate-safe), constructs a headless `ProviderContainer`, and runs
one drain + pull of the collections the user actually uses (members,
attendance sessions, sermons, funds). It does not pull accounting journals.

## Push notifications

Until the `notifications` bounded context ships a device-token endpoint, the
client still:

1. Requests permission.
2. Displays foreground messages with `flutter_local_notifications`.
3. On a data payload `{ "invalidate": ["sermons", "members"] }`, invalidates
   those cache collections and kicks `SyncEngine`.
4. Stores the FCM token in Hive `prefs` so the notifications module can
   register it later without asking the user again.

The app does not call an endpoint that does not exist.

## Reusable components

`lib/core/widgets` is the design system. A feature screen does not build a
raw `ElevatedButton` or a raw `TextField`.

| Widget | Role |
| --- | --- |
| `ZionButton` | Primary, secondary, destructive, loading, min 48dp |
| `ZionTextField` | Label, error, obscure, semantics |
| `ZionCard` | Surface for lists and summaries |
| `ZionAppBar` | Title + actions, large-title on expanded |
| `StatusBadge` | Same tones as the web `Badge` (`POSTED`, `DRAFT`, `REFUNDED`, ...) |
| `EmptyState` / `ErrorState` / `LoadingState` | Honest empty, mapped `error.code`, not a spinner forever |
| `ResponsiveScaffold` | Bottom bar / rail / drawer switch |
| `MoneyText` | Integer minor units -> currency, matching `formatMoney` on web |

## Theme

Default palette matches `apps/web/tailwind.config.ts` and
`DEFAULT_BRAND_THEME`:

| Token | Dark (default) | Light |
| --- | --- | --- |
| `primary` | `#6366f1` (`zion.500`) | `#4f46e5` (`zion.600`) |
| `secondary` | `#0f172a` | `#0f172a` |
| `accent` | `#38bdf8` | `#0284c7` |
| `surface` | `#020617` (slate-950) | `#f8fafc` |
| `onSurface` | `#e2e8f0` | `#0f172a` |

A tenant brand theme replaces `primary` / `secondary` / `accent` only. Spacing
is an 8dp grid. Type uses the platform sans, with a documented scale
(display 32, title 22, body 16, label 12). Dark is the default, as on web.

## Accessibility

Enforced in `core/accessibility` and in the widget primitives:

- Every interactive widget has a `Semantics` label and a 48dp minimum tap
  target (`kMinInteractiveDimension`).
- `TextField`s expose `textInputAction` and error text to the semantics tree.
- `MediaQuery.disableAnimations` / a user "reduce motion" pref disables
  hero and outbox-drain animations.
- Contrast: primary-on-dark and primary-on-light both meet WCAG AA against
  the surface tokens above.
- Dynamic type: `TextScaler` is clamped to 1.4 so layout does not clip
  credentials on the sign-in screen.
- Focus order on forms is top to bottom; the sign-in submit button is the
  last focusable control in the form.

## Testing

| Tier | Location | Proves |
| --- | --- | --- |
| Unit | `apps/mobile/test/unit` | Outbox backoff, cache keying, error mapping, auth redirect table, money formatting |
| Widget | `apps/mobile/test/widget` | Sign-in, MFA, lock, responsive shell, semantics labels |
| Integration | `apps/mobile/integration_test` | Cold start -> biometric/login -> home, against a fake `ZionApi` |

Riverpod `ProviderScope` overrides replace `ZionApi`, `BiometricService`,
and `SecureStore` in every widget test. Widget tests do not open a real
Hive box; they use an in-memory `CacheStore`.

```bash
cd apps/mobile
flutter test
flutter test integration_test
```

## What this client does not do

- It does not implement GraphQL. The phone uses REST, which is the HTTP
  source of truth.
- It does not close fiscal periods, post payroll, or complete bank
  reconciliation. Those stay on web.
- It does not embed a second AI runtime. `AI_ASK` is a future screen that
  will call `/api/v1/ai/ask` like everyone else.

## Related documents

- `docs/architecture/ARCHITECTURE.md` — system shape
- `docs/architecture/AUTHENTICATION.md` — session, MFA, refresh rotation
- `docs/architecture/MULTI_TENANCY.md` — RLS; the client still keys cache by tenant
- `docs/architecture/CHURCH_ONBOARDING.md` — the journey the app renders
- `docs/architecture/MEMBERSHIP.md` — people, attendance
- `docs/architecture/SERMON.md` — library and study
- `docs/architecture/ACCOUNTING.md` — giving lives here on the server
- `docs/architecture/REPOSITORY_STRUCTURE.md` — `apps/mobile` conventions
- `docs/TESTING.md` — repository-wide test tiers
