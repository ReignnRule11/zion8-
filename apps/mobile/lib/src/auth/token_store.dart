import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// Persistence for the current session's tokens.
///
/// The interface exists so the auth client can be tested without a platform
/// channel, and so a future implementation can move to a different secure store
/// without touching the client.
abstract interface class TokenStore {
  /// Loads the stored session, or `null` when the user is signed out.
  Future<Session?> read();

  /// Persists the session.
  Future<void> write(Session session);

  /// Removes the stored session.
  Future<void> clear();
}

/// In-memory store used by tests and short-lived processes.
final class InMemoryTokenStore implements TokenStore {
  Session? _session;

  @override
  Future<Session?> read() async => _session;

  @override
  Future<void> write(Session session) async {
    _session = session;
  }

  @override
  Future<void> clear() async {
    _session = null;
  }
}

/// Stores the session in the platform keychain or keystore.
///
/// Tokens never touch shared preferences or plain files: the access token is a
/// bearer credential and the refresh token is long-lived, so both are kept in
/// the OS-provided secure enclave.
final class SecureTokenStore implements TokenStore {
  /// Creates a secure store backed by [FlutterSecureStorage].
  const SecureTokenStore({
    this._storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  });

  static const String _key = 'zion8.session';

  final FlutterSecureStorage _storage;

  @override
  Future<Session?> read() async {
    final String? raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return Session.fromJson(decoded);
      }
      return null;
    } on FormatException {
      // A corrupt or legacy entry must not wedge the app; treat it as signed out.
      await _storage.delete(key: _key);
      return null;
    }
  }

  @override
  Future<void> write(Session session) =>
      _storage.write(key: _key, value: jsonEncode(session.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}
