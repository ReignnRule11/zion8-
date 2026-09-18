import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/errors/api_exception.dart';
import 'package:zion8/core/network/fake_zion_api.dart';
import 'package:zion8/core/storage/memory_stores.dart';
import 'package:zion8/core/storage/outbox_store.dart';
import 'package:zion8/core/sync/sync_engine.dart';

void main() {
  test('a 4xx other than 401 is dropped and recorded on the cache row', () async {
    final outbox = MemoryOutboxStore();
    final cache = MemoryCacheStore();
    final api = FakeZionApi(handlers: {
      'POST /accounting/contributions': (path, body) {
        throw const ApiException(
          code: 'VALIDATION_FAILED',
          message: 'That gift could not be recorded.',
          status: 400,
        );
      },
    });
    final engine = SyncEngine(
      outbox: outbox,
      cache: cache,
      api: api,
      tenantId: () => 'tenant-1',
    );
    await outbox.enqueue(
      OutboxItem(
        id: 'gift-1',
        idempotencyKey: 'gift-1',
        method: 'POST',
        path: '/accounting/contributions',
        body: const {'amountMinor': 100},
        createdAt: DateTime.utc(2026, 9, 18),
        collection: 'contributions',
        resourceId: 'gift-1',
      ),
    );

    await engine.drain(now: DateTime.utc(2026, 9, 18));

    expect(outbox.all(), isEmpty);
    final rejected = cache.get<Map>('tenant-1', 'contributions', id: 'gift-1');
    expect(rejected?['code'], 'VALIDATION_FAILED');
  });

  test('retryable failures stay in the outbox with backoff', () async {
    final outbox = MemoryOutboxStore();
    final cache = MemoryCacheStore();
    final api = FakeZionApi(handlers: {
      'POST /accounting/contributions': (path, body) {
        throw ApiException.network('offline');
      },
    });
    final engine = SyncEngine(
      outbox: outbox,
      cache: cache,
      api: api,
      tenantId: () => 'tenant-1',
    );
    final now = DateTime.utc(2026, 9, 18);
    await outbox.enqueue(
      OutboxItem(
        id: 'gift-2',
        idempotencyKey: 'gift-2',
        method: 'POST',
        path: '/accounting/contributions',
        body: const {},
        createdAt: now,
        collection: 'contributions',
        resourceId: 'gift-2',
      ),
    );

    await engine.drain(now: now);

    final remaining = outbox.all();
    expect(remaining, hasLength(1));
    expect(remaining.first.attempts, 1);
    expect(remaining.first.nextAttemptAt, now.add(outboxBackoff(0)));
  });
}
