import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/di.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/zion_api.dart';
import '../../../core/storage/cache_store.dart';
import '../../../core/storage/outbox_store.dart';
import '../../../core/sync/sync_engine.dart';

class GivingRepository {
  GivingRepository({
    required ZionApi api,
    required CacheStoreView cache,
    required OutboxPort outbox,
    required SyncEngine sync,
    required String Function() tenantId,
  })  : _api = api,
        _cache = cache,
        _outbox = outbox,
        _sync = sync,
        _tenantId = tenantId;

  final ZionApi _api;
  final CacheStoreView _cache;
  final OutboxPort _outbox;
  final SyncEngine _sync;
  final String Function() _tenantId;
  final _uuid = const Uuid();

  Future<List<Map<String, dynamic>>> funds() async {
    final tenant = _tenantId();
    final cached = _cache.get<List<dynamic>>(tenant, 'funds');
    try {
      final payload = await _api.get('/accounting/funds');
      final items = (payload as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
      await _cache.put(tenant, 'funds', items);
      return items.whereType<Map<String, dynamic>>().toList();
    } on ApiException {
      if (cached != null) return cached.whereType<Map<String, dynamic>>().toList();
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> contributions() async {
    final tenant = _tenantId();
    final cached = _cache.get<List<dynamic>>(tenant, 'contributions');
    try {
      final payload = await _api.get('/accounting/contributions');
      final items = (payload as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
      await _cache.put(tenant, 'contributions', items);
      return items.whereType<Map<String, dynamic>>().toList();
    } on ApiException {
      if (cached != null) return cached.whereType<Map<String, dynamic>>().toList();
      rethrow;
    }
  }

  Future<void> record({
    required String fundId,
    required int amountMinor,
    required String receivedOn,
    String method = 'CASH',
  }) async {
    final id = _uuid.v4();
    await _outbox.enqueue(
      OutboxItem(
        id: id,
        idempotencyKey: id,
        method: 'POST',
        path: '/accounting/contributions',
        body: {
          'fundId': fundId,
          'amountMinor': amountMinor,
          'receivedOn': receivedOn,
          'method': method,
          'currency': 'USD',
          'taxDeductible': true,
        },
        createdAt: DateTime.now().toUtc(),
        collection: 'contributions',
        resourceId: id,
      ),
    );
    await _sync.kick();
  }
}

final givingRepositoryProvider = Provider<GivingRepository>((ref) {
  return GivingRepository(
    api: ref.watch(zionApiProvider),
    cache: ref.watch(cacheStoreProvider),
    outbox: ref.watch(outboxStoreProvider),
    sync: ref.watch(syncEngineProvider),
    tenantId: () => ref.read(activeTenantIdProvider),
  );
});
