import 'hive_boxes.dart';

/// Tenant-scoped Hive key. A church switch changes [tenantId] and therefore
/// every key, so the previous church cannot leak onto the next screen.
String cacheKey(String tenantId, String collection, [String? id]) {
  final suffix = id == null ? collection : '$collection/$id';
  return '$tenantId::$suffix';
}

/// The methods [CacheStore] exposes. Hive and memory implementations share it.
abstract class CacheStoreView {
  Future<void> put(String tenantId, String collection, Object value, {String? id});
  T? get<T>(String tenantId, String collection, {String? id});
  Future<void> invalidate(String tenantId, String collection);
  Future<void> clearTenant(String tenantId);
  bool get biometricUnlockEnabled;
  Future<void> setBiometricUnlock(bool value);
  String? get lastTenantSlug;
  Future<void> setLastTenantSlug(String? slug);
  String? get fcmToken;
  Future<void> setFcmToken(String token);
}

/// Tenant-scoped projections. A church switch changes [tenantId] and therefore
/// every key, so the previous church cannot leak onto the next screen.
class CacheStore implements CacheStoreView {
  CacheStore({required HiveBoxes boxes}) : _boxes = boxes;

  final HiveBoxes _boxes;

  String _key(String tenantId, String collection, [String? id]) {
    return cacheKey(tenantId, collection, id);
  }

  Future<void> put(
    String tenantId,
    String collection,
    Object value, {
    String? id,
  }) {
    return _boxes.cache.put(_key(tenantId, collection, id), value);
  }

  T? get<T>(String tenantId, String collection, {String? id}) {
    final value = _boxes.cache.get(_key(tenantId, collection, id));
    if (value is T) return value;
    return null;
  }

  Future<void> invalidate(String tenantId, String collection) async {
    final prefix = '$tenantId::$collection';
    final keys = _boxes.cache.keys
        .where((key) => key is String && key.startsWith(prefix))
        .toList();
    await _boxes.cache.deleteAll(keys);
  }

  Future<void> clearTenant(String tenantId) async {
    final prefix = '$tenantId::';
    final keys = _boxes.cache.keys
        .where((key) => key is String && key.startsWith(prefix))
        .toList();
    await _boxes.cache.deleteAll(keys);
  }

  bool get biometricUnlockEnabled =>
      _boxes.prefs.get('biometricUnlock', defaultValue: false) == true;

  Future<void> setBiometricUnlock(bool value) {
    return _boxes.prefs.put('biometricUnlock', value);
  }

  String? get lastTenantSlug => _boxes.prefs.get('lastTenantSlug') as String?;

  Future<void> setLastTenantSlug(String? slug) {
    if (slug == null) return _boxes.prefs.delete('lastTenantSlug');
    return _boxes.prefs.put('lastTenantSlug', slug);
  }

  String? get fcmToken => _boxes.prefs.get('fcmToken') as String?;

  Future<void> setFcmToken(String token) {
    return _boxes.prefs.put('fcmToken', token);
  }
}
