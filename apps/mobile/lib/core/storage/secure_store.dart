import '../../features/auth/domain/session.dart';

/// Tokens never enter Hive. Implementations talk to the OS keychain or, in
/// tests, to memory.
abstract class SecureStore {
  Session? get session;
  Future<void> hydrate();
  Future<void> write(Session session);
  Future<void> clear();
}

class MemorySecureStore implements SecureStore {
  Session? _memory;

  @override
  Session? get session => _memory;

  @override
  Future<void> hydrate() async {}

  @override
  Future<void> write(Session session) async {
    _memory = session;
  }

  @override
  Future<void> clear() async {
    _memory = null;
  }
}
