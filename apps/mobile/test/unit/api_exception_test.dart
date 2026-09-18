import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/errors/api_exception.dart';

void main() {
  test('maps the contract envelope', () {
    final error = ApiException.fromBody(401, {
      'error': {
        'code': 'TOKEN_REVOKED',
        'message': 'That session is no longer valid.',
        'timestamp': '2026-09-18T00:00:00.000Z',
      },
    });
    expect(error.isRevoked, isTrue);
    expect(error.isUnauthenticated, isTrue);
    expect(error.isRetryable, isFalse);
  });

  test('network failures are retryable', () {
    expect(ApiException.network('offline').isRetryable, isTrue);
  });
}
