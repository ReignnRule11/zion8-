import 'cache_store.dart';
import 'outbox_store.dart';

class MemoryCacheStore implements CacheStoreView {
  final Map<String, Object> _cache = {};
  final Map<String, Object?> _prefs = {};

  @override
  Future<void> put(String tenantId, String collection, Object value, {String? id}) async {
    _cache[cacheKey(tenantId, collection, id)] = value;
  }

  @override
  T? get<T>(String tenantId, String collection, {String? id}) {
    final value = _cache[cacheKey(tenantId, collection, id)];
    if (value is T) return value;
    return null;
  }

  @override
  Future<void> invalidate(String tenantId, String collection) async {
    final prefix = '$tenantId::$collection';
    _cache.removeWhere((key, _) => key.startsWith(prefix));
  }

  @override
  Future<void> clearTenant(String tenantId) async {
    final prefix = '$tenantId::';
    _cache.removeWhere((key, _) => key.startsWith(prefix));
  }

  @override
  bool get biometricUnlockEnabled => _prefs['biometricUnlock'] == true;

  @override
  Future<void> setBiometricUnlock(bool value) async {
    _prefs['biometricUnlock'] = value;
  }

  @override
  String? get lastTenantSlug => _prefs['lastTenantSlug'] as String?;

  @override
  Future<void> setLastTenantSlug(String? slug) async {
    if (slug == null) {
      _prefs.remove('lastTenantSlug');
    } else {
      _prefs['lastTenantSlug'] = slug;
    }
  }

  @override
  String? get fcmToken => _prefs['fcmToken'] as String?;

  @override
  Future<void> setFcmToken(String token) async {
    _prefs['fcmToken'] = token;
  }
}

class MemoryOutboxStore implements OutboxPort {
  final Map<String, OutboxItem> _items = {};

  List<OutboxItem> pending({DateTime? now}) {
    final moment = now ?? DateTime.now().toUtc();
    final items = _items.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return items
        .where((item) =>
            item.nextAttemptAt == null || !item.nextAttemptAt!.isAfter(moment))
        .toList();
  }

  List<OutboxItem> all() {
    return _items.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  Future<void> enqueue(OutboxItem item) async {
    _items[item.id] = item;
  }

  Future<void> remove(String id) async {
    _items.remove(id);
  }

  Future<void> update(OutboxItem item) async {
    _items[item.id] = item;
  }
}
