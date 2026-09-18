/// Mirrors the API error envelope in `packages/contracts/src/common/api-error.ts`.
class FieldIssue {
  const FieldIssue({required this.path, required this.message, this.code});

  final String path;
  final String message;
  final String? code;

  factory FieldIssue.fromJson(Map<String, dynamic> json) {
    return FieldIssue(
      path: json['path'] as String? ?? '',
      message: json['message'] as String? ?? '',
      code: json['code'] as String?,
    );
  }
}

class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    required this.status,
    this.details = const [],
    this.requestId,
  });

  final String code;
  final String message;
  final int status;
  final List<FieldIssue> details;
  final String? requestId;

  bool get isUnauthenticated =>
      status == 401 ||
      code == 'UNAUTHENTICATED' ||
      code == 'TOKEN_EXPIRED' ||
      code == 'TOKEN_REVOKED' ||
      code == 'INVALID_CREDENTIALS';

  bool get isRetryable =>
      status == 0 ||
      status == 408 ||
      status == 429 ||
      status >= 500 ||
      code == 'SERVICE_UNAVAILABLE' ||
      code == 'RATE_LIMITED';

  bool get isRevoked => code == 'TOKEN_REVOKED';

  factory ApiException.fromBody(int status, Map<String, dynamic>? body) {
    final error = body?['error'];
    if (error is Map<String, dynamic>) {
      final details = error['details'];
      return ApiException(
        code: error['code'] as String? ?? 'INTERNAL_ERROR',
        message: error['message'] as String? ?? 'The service is unavailable.',
        status: status,
        details: details is List
            ? details
                .whereType<Map<String, dynamic>>()
                .map(FieldIssue.fromJson)
                .toList()
            : const [],
        requestId: error['requestId'] as String?,
      );
    }
    return ApiException(
      code: 'INTERNAL_ERROR',
      message: 'The service is unavailable.',
      status: status,
    );
  }

  factory ApiException.network(String reason) {
    return ApiException(
      code: 'SERVICE_UNAVAILABLE',
      message: reason,
      status: 0,
    );
  }

  @override
  String toString() => 'ApiException($code, $status): $message';
}
