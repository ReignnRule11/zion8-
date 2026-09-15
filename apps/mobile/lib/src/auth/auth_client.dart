import 'auth_api.dart';
import 'models.dart';
import 'token_store.dart';

/// Session-aware authentication client.
///
/// Owns the current session, persists it through a [TokenStore], and refreshes
/// it transparently. Application code should depend on this class rather than
/// calling [AuthApi] directly.
final class AuthClient {
  /// Creates a client.
  AuthClient({required this._api, required this._store});

  final AuthApi _api;
  final TokenStore _store;

  Session? _session;

  /// The current session, or `null` when signed out.
  Session? get session => _session;

  /// Whether a session is currently held.
  bool get isAuthenticated => _session != null;

  /// Loads any persisted session. Call once during application start-up.
  Future<Session?> restore() async {
    _session = await _store.read();
    return _session;
  }

  /// Signs in with a password and stores the session if it is complete.
  Future<LoginResult> login({
    String? email,
    String? phone,
    required String password,
    String? tenantSlug,
  }) async {
    final LoginResult result = await _api.login(
      email: email,
      phone: phone,
      password: password,
      tenantSlug: tenantSlug,
    );
    if (result is LoginSuccess) {
      await _persist(result.session);
    }
    return result;
  }

  /// Completes an MFA challenge with a code and stores the session.
  Future<Session> completeMfa({
    required String mfaToken,
    required String code,
  }) async {
    final Session session = await _api.verifyMfa(mfaToken: mfaToken, code: code);
    await _persist(session);
    return session;
  }

  /// Completes an MFA challenge with a recovery code and stores the session.
  Future<Session> completeMfaWithRecoveryCode({
    required String mfaToken,
    required String recoveryCode,
  }) async {
    final Session session = await _api.verifyRecoveryCode(
      mfaToken: mfaToken,
      recoveryCode: recoveryCode,
    );
    await _persist(session);
    return session;
  }

  /// Consumes a magic link and stores the session if the login is complete.
  Future<LoginResult> consumeMagicLink(String token) async {
    final LoginResult result = await _api.consumeMagicLink(token: token);
    if (result is LoginSuccess) {
      await _persist(result.session);
    }
    return result;
  }

  /// Signs out, revoking the session server-side when possible.
  ///
  /// Local state is always cleared: a network failure must not leave the user
  /// holding tokens they believe they have discarded.
  Future<void> signOut() async {
    final Session? current = _session;
    _session = null;
    await _store.clear();
    if (current != null) {
      try {
        await _api.logout(current.refreshToken);
      } on AuthApiException {
        // Already revoked or unreachable; the local sign-out has succeeded.
      }
    }
  }

  /// Loads the current user's profile.
  Future<MeResponse> me() => _withAccessToken((String token) => _api.me(token));

  /// Lists the user's device sessions.
  Future<List<AuthSessionSummary>> sessions() =>
      _withAccessToken((String token) => _api.listSessions(token));

  /// Revokes another device session.
  Future<void> revokeSession(String sessionId) => _withAccessToken<void>(
        (String token) => _api.revokeSession(accessToken: token, sessionId: sessionId),
      );

  /// Changes the active tenant and stores the new session.
  Future<Session> switchTenant(String tenantId) async {
    final Session? current = _session;
    if (current == null) throw StateError('Not authenticated');
    final Session session = await _api.switchTenant(
      accessToken: current.accessToken,
      tenantId: tenantId,
      refreshToken: current.refreshToken,
    );
    await _persist(session);
    return session;
  }

  /// Runs [action] with a valid access token, refreshing when necessary.
  ///
  /// Refreshes proactively if the access token has expired, and reactively once
  /// if the server rejects the token. A failed refresh clears the session so the
  /// application can route the user back to sign-in.
  Future<T> _withAccessToken<T>(Future<T> Function(String token) action) async {
    Session? current = _session;
    if (current == null) throw StateError('Not authenticated');

    if (current.isAccessTokenExpired) {
      current = await _refresh(current);
    }

    try {
      return await action(current.accessToken);
    } on AuthApiException catch (error) {
      if (!error.isUnauthenticated) rethrow;
      final Session refreshed = await _refresh(current);
      return action(refreshed.accessToken);
    }
  }

  Future<Session> _refresh(Session current) async {
    try {
      final Session refreshed = await _api.refresh(current.refreshToken);
      await _persist(refreshed);
      return refreshed;
    } on AuthApiException {
      _session = null;
      await _store.clear();
      rethrow;
    }
  }

  Future<void> _persist(Session session) async {
    _session = session;
    await _store.write(session);
  }
}
