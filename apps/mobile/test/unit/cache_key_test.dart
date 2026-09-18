import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/storage/cache_store.dart';

void main() {
  test('cache keys are tenant scoped', () {
    expect(
      cacheKey('church-a', 'members'),
      isNot(cacheKey('church-b', 'members')),
    );
    expect(
      cacheKey('church-a', 'members', 'm1'),
      'church-a::members/m1',
    );
  });
}
