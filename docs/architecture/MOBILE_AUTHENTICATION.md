# Mobile Authentication

The Flutter application in `apps/mobile` consumes the same versioned HTTP API as the web client.
No authentication logic is duplicated in the app: it calls the endpoints documented in
`docs/architecture/AUTHENTICATION.md` and mirrors the wire contracts in Dart.

## Layout

```
apps/mobile/
  lib/
    main.dart
    src/
      app.dart                       # Application shell and API configuration
      auth/
        models.dart                  # Dart mirrors of the auth contracts
        auth_api.dart                # Stateless, endpoint-per-method HTTP client
        auth_client.dart             # Session-aware flows and token refresh
        token_store.dart             # Token persistence (secure + in-memory)
      ui/
        sign_in_screen.dart          # Password sign-in with inline MFA step
        home_screen.dart             # Profile and device-session management
  test/
    auth_client_test.dart            # Unit tests over a mocked HTTP client
```

The split is deliberate:

- `AuthApi` maps one method to one endpoint. It is stateless and therefore trivial to reason about
  and to test.
- `AuthClient` owns the session: it persists tokens, refreshes them, retries once on a rejected
  token, and clears state on sign-out.
- The UI depends only on `AuthClient`, never on `AuthApi` or raw HTTP.

## API base URL

The base URL is a compile-time constant so a single build configuration cannot accidentally point
at the wrong environment:

```bash
# Development
flutter run --dart-define=ZION8_API_BASE_URL=http://localhost:4000/api/v1

# Production
flutter build apk --dart-define=ZION8_API_BASE_URL=https://api.zion8.example/api/v1
```

## Token storage

Tokens are stored with `flutter_secure_storage`, which uses the Android Keystore and the iOS
Keychain. The access token is a bearer credential and the refresh token is long-lived, so neither
is written to shared preferences, files, or logs.

`TokenStore` is an interface with two implementations: `SecureTokenStore` for the app and
`InMemoryTokenStore` for tests. This keeps the refresh and sign-out logic testable without a
platform channel.

## Session lifecycle

1. **Sign in.** `AuthClient.login` calls `POST /auth/login`. The response is either a session or an
   MFA challenge.
2. **Step up.** If a second factor is required, the screen asks for a code and calls
   `POST /auth/mfa/verify` with the `mfaToken` from the challenge. Recovery codes use
   `POST /auth/mfa/recovery`. Only when a full session is returned is it persisted.
3. **Use.** Callers go through `AuthClient`, which refreshes the access token proactively when it
   has expired and reactively (once) when the server rejects it with a 401.
4. **Sign out.** `AuthClient.signOut` clears local state first, then revokes the session server-side
   with `POST /auth/logout`. A network failure never leaves the user holding tokens they believe
   they discarded.

A refresh that itself fails means the session is gone: the client clears the store so the app can
route the user back to sign-in.

## Deep links

Magic links and email verification links are built from `WEB_BASE_URL` on the server, so they open
the web app by default. To handle them in the mobile app, register a deep link for the app and pass
the token to the relevant call:

- `/magic-link?token=...` maps to `AuthClient.consumeMagicLink(token)`.
- `/verify-email?token=...` maps to `POST /auth/email/verify/consume`.
- `/reset-password?token=...` maps to a reset screen that calls `POST /auth/password/reset/consume`.

Universal links and Android App Links should be configured for the production domain, and the
`WEBAUTHN_ORIGINS` on the server must include the app's associated domain for passkeys.

## Passkeys

Passkeys require a platform-specific WebAuthn implementation because the credential is created and
asserted by the operating system. The flow is:

1. `POST /auth/webauthn/registration/options` (authenticated) returns the creation options.
2. The app passes them to a WebAuthn platform package to create the credential.
3. `POST /auth/webauthn/registration/verify` registers it as a `WEBAUTHN` MFA factor.
4. For sign-in, `POST /auth/webauthn/authentication/options` returns the request options, and
   `POST /auth/webauthn/authentication/verify` returns a session or an MFA challenge.

`WEBAUTHN_RP_ID` must match the app's associated domain, and `WEBAUTHN_ORIGINS` must list the
origins the app presents.

## Testing

```bash
cd apps/mobile

# Resolve dependencies
flutter pub get

# Static analysis against the shared lint set
flutter analyze

# Unit tests (no platform channels required)
flutter test
```

The unit tests exercise session storage, the MFA branch, proactive and reactive refresh, refresh
failure cleanup, and sign-out under a failing API using `MockClient` from `package:http/testing.dart`.
