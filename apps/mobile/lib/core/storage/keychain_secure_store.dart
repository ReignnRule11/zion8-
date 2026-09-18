import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../features/auth/domain/session.dart';
import 'secure_store.dart';

/// Production keychain adapter. Widget tests never construct this type.
class KeychainSecureStore implements SecureStore {
  KeychainSecureStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _access = 'zion8.access';
  static const _refresh = 'zion8.refresh';
  static const _sessionId = 'zion8.sessionId';
  static const _assurance = 'zion8.aal';
  static const _expiresIn = 'zion8.expiresIn';
  static const _refreshExpiresIn = 'zion8.refreshExpiresIn';
  static const _mfaSatisfied = 'zion8.mfaSatisfied';

  final FlutterSecureStorage _storage;
  Session? _cached;

  @override
  Session? get session => _cached;

  @override
  Future<void> hydrate() async {
    final access = await _storage.read(key: _access);
    final refresh = await _storage.read(key: _refresh);
    final sessionId = await _storage.read(key: _sessionId);
    if (access == null || refresh == null || sessionId == null) {
      _cached = null;
      return;
    }
    _cached = Session(
      accessToken: access,
      refreshToken: refresh,
      sessionId: sessionId,
      tokenType: 'Bearer',
      expiresIn: int.tryParse(await _storage.read(key: _expiresIn) ?? '') ?? 900,
      refreshExpiresIn:
          int.tryParse(await _storage.read(key: _refreshExpiresIn) ?? '') ?? 2592000,
      assuranceLevel: await _storage.read(key: _assurance) ?? 'AAL1',
      mfaSatisfied: (await _storage.read(key: _mfaSatisfied)) == 'true',
    );
  }

  @override
  Future<void> write(Session session) async {
    _cached = session;
    await _storage.write(key: _access, value: session.accessToken);
    await _storage.write(key: _refresh, value: session.refreshToken);
    await _storage.write(key: _sessionId, value: session.sessionId);
    await _storage.write(key: _assurance, value: session.assuranceLevel);
    await _storage.write(key: _expiresIn, value: '${session.expiresIn}');
    await _storage.write(
      key: _refreshExpiresIn,
      value: '${session.refreshExpiresIn}',
    );
    await _storage.write(
      key: _mfaSatisfied,
      value: session.mfaSatisfied ? 'true' : 'false',
    );
  }

  @override
  Future<void> clear() async {
    _cached = null;
    await _storage.deleteAll();
  }
}
