import '../../features/auth/domain/session.dart';
import '../errors/api_exception.dart';
import '../storage/secure_store.dart';
import 'zion_api.dart';

/// In-memory API used by widget and integration tests. No sockets.
class FakeZionApi extends ZionApi {
  FakeZionApi({
    Map<String, dynamic Function(String path, Object? body)>? handlers,
    SecureStore? secureStore,
  })  : _handlers = handlers ?? {},
        super(
          baseUrl: 'http://fake.invalid/api/v1',
          secureStore: secureStore ?? MemorySecureStore(),
          refresh: () async => null,
          onRevoked: () async {},
        );

  final Map<String, dynamic Function(String path, Object? body)> _handlers;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) {
    return _dispatch('GET', path, null);
  }

  @override
  Future<dynamic> post(String path, {Object? body, String? idempotencyKey}) {
    return _dispatch('POST', path, body);
  }

  Future<dynamic> _dispatch(String method, String path, Object? body) async {
    final handler = _handlers['$method $path'];
    if (handler == null) {
      throw ApiException(
        code: 'RESOURCE_NOT_FOUND',
        message: 'No fake handler for $method $path',
        status: 404,
      );
    }
    return handler(path, body);
  }
}

Session fakeSession() {
  return const Session(
    accessToken: 'access-token',
    refreshToken: 'refresh-token-value-32-chars-min',
    sessionId: '00000000-0000-0000-0000-000000000001',
    expiresIn: 900,
    refreshExpiresIn: 2592000,
    assuranceLevel: 'AAL1',
    mfaSatisfied: false,
  );
}
