import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:workmanager/workmanager.dart';

import '../di.dart';
import '../errors/api_exception.dart';
import '../network/zion_api.dart';
import '../storage/cache_store.dart';
import '../storage/outbox_store.dart';

const syncTaskName = 'zion8-sync';

/// Drains the outbox and pulls collections the user actually uses.
///
/// A successful drain patches Hive. A 4xx other than 401/408/429 is dropped
/// and the error code is written onto the cached row so the UI can show that
/// the optimistic write was rejected.
class SyncEngine {
  SyncEngine({
    required OutboxPort outbox,
    required CacheStoreView cache,
    required ZionApi api,
    required String Function() tenantId,
    Connectivity? connectivity,
  })  : _outbox = outbox,
        _cache = cache,
        _api = api,
        _tenantId = tenantId,
        _connectivity = connectivity ?? Connectivity();

  final OutboxPort _outbox;
  final CacheStoreView _cache;
  final ZionApi _api;
  final String Function() _tenantId;
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _draining = false;

  void attach() {
    _sub ??= _connectivity.onConnectivityChanged.listen((results) {
      if (results.any((result) => result != ConnectivityResult.none)) {
        unawaited(kick());
      }
    });
  }

  Future<void> registerBackgroundTask() async {
    try {
      await Workmanager().initialize(syncBackgroundDispatcher);
      await Workmanager().registerPeriodicTask(
        syncTaskName,
        syncTaskName,
        frequency: const Duration(minutes: 15),
        constraints: Constraints(networkType: NetworkType.connected),
      );
    } catch (_) {
      // Plugin channels are absent in widget tests and on unsupported platforms.
    }
  }

  Future<void> kick() async {
    if (_draining) return;
    _draining = true;
    try {
      await drain();
    } finally {
      _draining = false;
    }
  }

  void invalidate(List<String> collections) {
    final tenant = _tenantId();
    if (tenant.isEmpty) return;
    for (final collection in collections) {
      unawaited(_cache.invalidate(tenant, collection));
    }
    unawaited(kick());
  }

  Future<void> drain({DateTime? now}) async {
    final pending = _outbox.pending(now: now);
    final blocked = <String>{};
    for (final item in pending) {
      if (item.resourceId != null && blocked.contains(item.resourceId)) {
        continue;
      }
      try {
        await _replay(item);
        await _outbox.remove(item.id);
      } on ApiException catch (error) {
        if (error.isUnauthenticated) rethrow;
        if (error.isRetryable) {
          await _outbox.update(
            item.copyWith(
              attempts: item.attempts + 1,
              nextAttemptAt: (now ?? DateTime.now().toUtc())
                  .add(outboxBackoff(item.attempts)),
              lastError: error.code,
            ),
          );
          if (item.resourceId != null) blocked.add(item.resourceId!);
          continue;
        }
        await _outbox.remove(item.id);
        final tenant = _tenantId();
        if (tenant.isNotEmpty) {
          await _cache.put(
            tenant,
            item.collection,
            {'rejected': true, 'code': error.code, 'message': error.message},
            id: item.resourceId ?? item.id,
          );
        }
      }
    }
  }

  Future<void> _replay(OutboxItem item) async {
    switch (item.method) {
      case 'POST':
        await _api.post(
          item.path,
          body: item.body,
          idempotencyKey: item.idempotencyKey,
        );
      case 'PATCH':
        await _api.patch(item.path, body: item.body);
      case 'PUT':
        await _api.put(item.path, body: item.body);
      case 'DELETE':
        await _api.delete(item.path);
      default:
        throw ApiException(
          code: 'INTERNAL_ERROR',
          message: 'Unknown outbox method ${item.method}',
          status: 0,
        );
    }
  }

  Future<void> dispose() async {
    await _sub?.cancel();
  }
}

@pragma('vm:entry-point')
void syncBackgroundDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    return true;
  });
}

final syncEngineProvider = Provider<SyncEngine>((ref) {
  final engine = SyncEngine(
    outbox: ref.watch(outboxStoreProvider),
    cache: ref.watch(cacheStoreProvider),
    api: ref.watch(zionApiProvider),
    tenantId: () => ref.read(activeTenantIdProvider),
  );
  ref.onDispose(engine.dispose);
  return engine;
});
