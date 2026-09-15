# Enterprise Authentication

Zion8 authentication is built so that a church can meet enterprise security expectations without
running an identity server: multiple first-class identity providers, step-up multi-factor
authentication, passkeys, provable session revocation, and a complete audit trail. This document
explains the model and the decisions behind it.

## Model

Authentication is separated from identity, and identity is separated from credentials.

| Concept | Table | Responsibility |
| --- | --- | --- |
| User | `users` | The person. Owns nothing security-sensitive beyond a stable id. |
| Identity | `user_identities` | A way to identify the user: `EMAIL`, `PHONE`, `GOOGLE`, `APPLE`, `MICROSOFT`. Authoritative record of whether a contact is verified. |
| Password credential | `password_credentials` | An Argon2id hash. Exists only if the user chose a password. |
| Passkey | `webauthn_credentials` | A WebAuthn credential with its own counter and transports. |
| MFA factor | `mfa_factors` | A TOTP factor, or a WebAuthn factor used as a second step. |
| Recovery codes | `mfa_recovery_codes` | Single-use codes, hashed at rest. |
| Session | `auth_sessions` | The first-class unit of access. All refresh tokens belong to a session. |
| Verification challenge | `verification_challenges` | Short-lived proof of contact ownership: OTP, magic link, password reset, email/phone verification. |

Two design consequences are worth calling out:

1. **The identity table, not the user row, is the source of truth for login.** A user can sign in
   with any method that resolves to one of their identities. Losing a password or an OAuth account
   never locks a user out as long as another verified identity remains.
2. **Sessions are first-class, not token families.** Refresh tokens carry a `session_id`. Rotating
   a refresh token keeps the same session; revoking a session is one write that invalidates the
   refresh token *and* causes every access token minted for it to be rejected at the guard. This is
   how "sign out this device" becomes truthful instead of best-effort.

Secrets are never stored in the clear. Refresh tokens, recovery codes, and challenge secrets are
stored as SHA-256 hashes; TOTP secrets are encrypted with AES-256-GCM using a dedicated
`ENCRYPTION_KEY` so that a database read alone cannot mint codes.

## Assurance levels

Every session carries an assurance level that is copied into the access token as the `aal` claim.

| Level | Meaning | Typical methods |
| --- | --- | --- |
| `AAL1` | Single factor. | Password, magic link, OTP, OAuth. |
| `AAL2` | Two factors in this session. | Password + TOTP, password + passkey, magic link + TOTP. |
| `AAL3` | Hardware-backed or phishing-resistant second factor. | Passkey used as the second step. |

A login that would otherwise be single-factor but for a user who has an active second factor
returns an MFA challenge instead of a session. The client completes the challenge with a short-lived
`mfaToken` that is bound to the attempt, not a full session. Higher-assurance endpoints can require
`AAL2` or `AAL3` by inspecting the principal rather than trusting the client to ask for it.

## Flows

### Password login

```
POST /api/v1/auth/login { email | phone, password, tenantSlug? }
  ├─ no second factor  -> 200 Session
  └─ second factor set -> 200 { mfaRequired, mfaToken, factors[] }

POST /api/v1/auth/mfa/verify   { mfaToken, code }      -> 200 Session (AAL2)
POST /api/v1/auth/mfa/recovery { mfaToken, recoveryCode } -> 200 Session (AAL2)
```

Login responses are deliberately uniform whether the account exists or not: a failed password and
an unknown account both return `INVALID_CREDENTIALS` with the same shape, so the endpoint cannot be
used to enumerate users. Neither the login nor the MFA-verify path reveals whether a factor exists
until the password is correct.

### Magic link

```
POST /api/v1/auth/magic-link          { email, tenantSlug? }  -> 202 (always)
POST /api/v1/auth/magic-link/consume  { token, tenantSlug? }  -> 200 Session | MFA challenge
```

Requesting a link always returns `202`, even for an address with no account; the email is only
dispatched when an identity exists. Links are 256-bit random tokens, single-use, and expire after
`MAGIC_LINK_TTL_SECONDS`.

### One-time codes

```
POST /api/v1/auth/otp        { email } | { phone }            -> 202 (always)
POST /api/v1/auth/otp/verify { email | phone, code }          -> 200 Session | MFA challenge
```

Codes are six digits, hashed at rest, and limited to five attempts each. Issuance is rate-limited
per identifier per purpose in Redis so a code cannot be farmed.

### Contact verification

```
POST /api/v1/auth/email/verify          (authenticated)        -> 202, sends token
POST /api/v1/auth/email/verify/consume  { token }              -> 204
POST /api/v1/auth/phone/verify          (authenticated) { phone } -> 202, sends SMS code
POST /api/v1/auth/phone/verify/consume  { phone, code }        -> 204
```

Verification marks the identity verified; it does not create a new user.

### Password reset and change

```
POST /api/v1/auth/password/reset         { email }             -> 202 (always)
POST /api/v1/auth/password/reset/consume { token, newPassword } -> 204
POST /api/v1/auth/password/change        (authenticated) { currentPassword, newPassword } -> 204
```

Consuming a reset token rotates the password and revokes every other session for that user, which
is the expected behaviour after a suspected compromise.

### Passkeys (WebAuthn)

```
POST /api/v1/auth/webauthn/registration/options   (authenticated) -> PublicKeyCredentialCreationOptions
POST /api/v1/auth/webauthn/registration/verify    (authenticated) -> MFA factor created
POST /api/v1/auth/webauthn/authentication/options { email }       -> PublicKeyCredentialRequestOptions
POST /api/v1/auth/webauthn/authentication/verify  { challengeId, response } -> Session | MFA challenge
```

Passkeys are implemented as WebAuthn credentials and register as `WEBAUTHN` MFA factors. A passkey
can be the first factor or the second; when used as the second it yields `AAL3`. The relying-party
id, name, and origins come from `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, and `WEBAUTHN_ORIGINS`.

### Federated sign-in (OIDC)

```
GET  /api/v1/auth/oauth/:provider/start?redirectPath=&tenantSlug=   -> { authorizationUrl, state }
POST /api/v1/auth/oauth/:provider/callback { code, state, codeVerifier, redirectUri } -> Session
```

`provider` is one of `GOOGLE`, `APPLE`, `MICROSOFT`. The flow is authorization-code with PKCE,
`state` binding, and `nonce` validation; provider signing keys are discovered from the issuer's
JWKS and cached. Apple's signed client-secret JWT is generated on demand from the team/key ids and
private key. OAuth identities are linked to an existing user by verified email when possible; a
provider account already linked to a different user produces `IDENTITY_ALREADY_LINKED`.

### Sessions

```
GET    /api/v1/auth/sessions          -> list, each with current: boolean
DELETE /api/v1/auth/sessions/:id      -> 204
POST   /api/v1/auth/refresh { refreshToken } -> Session (rotates refresh token)
POST   /api/v1/auth/logout  { refreshToken } -> 204 (revokes the session)
POST   /api/v1/auth/switch-tenant { tenantId, refreshToken } -> Session
GET    /api/v1/auth/me                -> principal, active tenant, role, permissions, memberships
```

Refresh tokens rotate on every use. Presenting a token that was already rotated is treated as
theft and revokes the session. The guard validates the session on every authenticated request, so a
revoked session is rejected immediately rather than at access-token expiry.

### MFA management

```
GET    /api/v1/auth/mfa/factors                      -> factors + recovery codes remaining
POST   /api/v1/auth/mfa/totp { name }                -> { factorId, secret, otpauthUri }
POST   /api/v1/auth/mfa/totp/confirm { factorId, code } -> { factor, recoveryCodes }
POST   /api/v1/auth/mfa/recovery-codes { password }  -> { recoveryCodes }
DELETE /api/v1/auth/mfa/factors/:factorId            -> 204
```

Recovery codes are shown exactly once, at confirmation or regeneration. A factor is `PENDING` until
a valid code proves the user can actually generate codes, which prevents a user from locking
themselves out with a mistyped secret.

## Delivery

All out-of-band messages go through the `NotificationService` port. The `logging` adapter is used
unless a provider is configured, which means development and test environments never send real
mail or SMS but still exercise the full flow. Configuring `RESEND_API_KEY` enables email through
Resend; `TWILIO_ACCOUNT_SID` plus `TWILIO_AUTH_TOKEN` enables SMS through Twilio.

## Configuration

| Variable | Purpose |
| --- | --- |
| `WEB_BASE_URL` | Base URL used to build links in emails. |
| `ENCRYPTION_KEY` | Base64-encoded 32-byte key for AES-256-GCM at-rest encryption of TOTP secrets. |
| `VERIFICATION_TTL_SECONDS` | Lifetime of contact-verification and OTP challenges. |
| `MAGIC_LINK_TTL_SECONDS` | Lifetime of magic-link tokens. |
| `MFA_CHALLENGE_TTL_SECONDS` | Lifetime of the `mfaToken` between password success and step-up. |
| `TOTP_ISSUER` | Issuer label shown in authenticator apps. |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGINS` | WebAuthn relying party. |
| `GOOGLE_*`, `APPLE_*`, `MICROSOFT_*` | OIDC client credentials. A provider is unavailable until configured. |
| `EMAIL_FROM_ADDRESS`, `RESEND_API_KEY`, `SMS_FROM_NUMBER`, `TWILIO_*` | Delivery providers. |

## Audit trail

Every security-relevant event is written to `audit_logs` with the actor, action, resource, IP
address, and user agent: logins (including failures), magic-link and OTP issuance and consumption,
password resets and changes, MFA enrolment and disabling, session revocation, tenant switches, and
OAuth linking. Audit rows are written in the same tenant scope as the action they describe.

## Why these choices

- **Identity separate from credentials** keeps account recovery and account linking tractable. A
  user is never "a password"; they are a person with several verified ways to prove it.
- **Sessions separate from refresh tokens** makes revocation honest. The alternative, deleting a
  token family, still leaves already-issued access tokens valid until they expire.
- **One challenge table for every short-lived proof** gives one rate-limiting, attempt-counting, and
  hashing implementation instead of five subtly different ones.
- **Generic OIDC instead of per-provider code** means adding a provider is configuration plus one
  enum value, and the security-critical part (JWKS, PKCE, state, nonce) is written once.
- **Ports for delivery and persistence** are what let the whole flow run deterministically in tests
  without mocking HTTP or talking to a mail provider.
