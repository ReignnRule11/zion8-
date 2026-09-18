import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/di.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/zion_api.dart';
import '../../../core/storage/cache_store.dart';
import '../../../core/storage/outbox_store.dart';
import '../../../core/sync/sync_engine.dart';

class MembershipRepository {
  MembershipRepository({
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

  Future<List<Map<String, dynamic>>> listMembers({String? search}) async {
    final tenant = _tenantId();
    final cached = _cache.get<List<dynamic>>(tenant, 'members');
    try {
      final payload = await _api.get(
        '/membership/members',
        query: {
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final items = (payload as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
      await _cache.put(tenant, 'members', items);
      return items.whereType<Map<String, dynamic>>().toList();
    } on ApiException {
      if (cached != null) {
        return cached.whereType<Map<String, dynamic>>().toList();
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getMember(String id) async {
    final tenant = _tenantId();
    final cached = _cache.get<Map>(tenant, 'members', id: id);
    try {
      final payload = await _api.get('/membership/members/$id');
      final map = payload as Map<String, dynamic>;
      await _cache.put(tenant, 'members', map, id: id);
      return map;
    } on ApiException {
      if (cached != null) return Map<String, dynamic>.from(cached);
      rethrow;
    }
  }

  Future<void> recordAttendance({
    required String sessionId,
    required String memberId,
    required String status,
  }) async {
    final tenant = _tenantId();
    final id = _uuid.v4();
    await _outbox.enqueue(
      OutboxItem(
        id: id,
        idempotencyKey: id,
        method: 'POST',
        path: '/membership/attendance/sessions/$sessionId/records',
        body: {'memberId': memberId, 'status': status},
        createdAt: DateTime.now().toUtc(),
        collection: 'attendance',
        resourceId: memberId,
      ),
    );
    await _cache.put(tenant, 'attendance', {
      'memberId': memberId,
      'status': status,
      'pending': true,
    }, id: memberId);
    await _sync.kick();
  }
}

final membershipRepositoryProvider = Provider<MembershipRepository>((ref) {
  return MembershipRepository(
    api: ref.watch(zionApiProvider),
    cache: ref.watch(cacheStoreProvider),
    outbox: ref.watch(outboxStoreProvider),
    sync: ref.watch(syncEngineProvider),
    tenantId: () => ref.read(activeTenantIdProvider),
  );
});
