import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/storage/memory_stores.dart';
import 'package:zion8/core/storage/outbox_store.dart';

void main() {
  test('pending skips items whose next attempt is in the future', () async {
    final store = MemoryOutboxStore();
    final now = DateTime.utc(2026, 9, 18);
    await store.enqueue(
      OutboxItem(
        id: 'ready',
        idempotencyKey: 'ready',
        method: 'POST',
        path: '/accounting/contributions',
        body: const {},
        createdAt: now,
        collection: 'contributions',
      ),
    );
    await store.enqueue(
      OutboxItem(
        id: 'later',
        idempotencyKey: 'later',
        method: 'POST',
        path: '/accounting/contributions',
        body: const {},
        createdAt: now,
        collection: 'contributions',
        nextAttemptAt: now.add(const Duration(minutes: 5)),
      ),
    );

    final pending = store.pending(now: now);
    expect(pending.map((item) => item.id), ['ready']);
  });
}
