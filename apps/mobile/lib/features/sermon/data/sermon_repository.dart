import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/zion_api.dart';
import '../../../core/storage/cache_store.dart';

class SermonRepository {
  SermonRepository({required ZionApi api, required CacheStoreView cache, required String Function() tenantId})
      : _api = api,
        _cache = cache,
        _tenantId = tenantId;

  final ZionApi _api;
  final CacheStoreView _cache;
  final String Function() _tenantId;

  Future<List<Map<String, dynamic>>> list() async {
    final tenant = _tenantId();
    final cached = _cache.get<List<dynamic>>(tenant, 'sermons');
    try {
      final payload = await _api.get('/sermons');
      final items = (payload as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
      await _cache.put(tenant, 'sermons', items);
      return items.whereType<Map<String, dynamic>>().toList();
    } on ApiException {
      if (cached != null) return cached.whereType<Map<String, dynamic>>().toList();
      rethrow;
    }
  }

  Future<Map<String, dynamic>> get(String id) async {
    final tenant = _tenantId();
    final cached = _cache.get<Map>(tenant, 'sermons', id: id);
    try {
      final payload = await _api.get('/sermons/$id');
      final map = payload as Map<String, dynamic>;
      await _cache.put(tenant, 'sermons', map, id: id);
      return map;
    } on ApiException {
      if (cached != null) return Map<String, dynamic>.from(cached);
      rethrow;
    }
  }
}

final sermonRepositoryProvider = Provider<SermonRepository>((ref) {
  return SermonRepository(
    api: ref.watch(zionApiProvider),
    cache: ref.watch(cacheStoreProvider),
    tenantId: () => ref.read(activeTenantIdProvider),
  );
});
