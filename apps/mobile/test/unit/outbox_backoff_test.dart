import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/storage/outbox_store.dart';

void main() {
  test('backoff doubles and caps at five minutes', () {
    expect(outboxBackoff(0), const Duration(seconds: 2));
    expect(outboxBackoff(1), const Duration(seconds: 4));
    expect(outboxBackoff(2), const Duration(seconds: 8));
    expect(outboxBackoff(20), const Duration(seconds: 300));
  });
}
