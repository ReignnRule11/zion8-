import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../features/auth/domain/session.dart';
import '../di.dart';
import '../errors/api_exception.dart';
import '../storage/secure_store.dart';

/// Thin Dio wrapper. Feature repositories never construct Dio themselves.
///
/// Refresh is attempted once on 401 / TOKEN_EXPIRED. TOKEN_REVOKED clears the
/// session and is rethrown so the auth controller can send the user to sign-in.
class ZionApi {
  ZionApi({
    required this.baseUrl,
    required SecureStore secureStore,
    required Future<Session?> Function() refresh,
    required Future<void> Function() onRevoked,
    Dio? dio,
  })  : _secureStore = secureStore,
        _refresh = refresh,
        _onRevoked = onRevoked,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 20),
                headers: const {
                  'content-type': 'application/json',
                  'accept': 'application/json',
                },
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _secureStore.session?.accessToken;
          if (token != null) {
            options.headers['authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final exception = _map(error);
          final alreadyRetried = error.requestOptions.extra['retried'] == true;
          if (exception.isUnauthenticated &&
              !exception.isRevoked &&
              !alreadyRetried &&
              _secureStore.session?.refreshToken != null) {
            try {
              final session = await _refresh();
              if (session == null) {
                handler.reject(error);
                return;
              }
              final req = error.requestOptions;
              req.extra['retried'] = true;
              req.headers['authorization'] = 'Bearer ${session.accessToken}';
              final response = await _dio.fetch<dynamic>(req);
              handler.resolve(response);
              return;
            } catch (_) {
              await _onRevoked();
              handler.reject(error);
              return;
            }
          }
          if (exception.isRevoked) {
            await _onRevoked();
          }
          handler.next(error);
        },
      ),
    );
  }

  final String baseUrl;
  final SecureStore _secureStore;
  final Future<Session?> Function() _refresh;
  final Future<void> Function() _onRevoked;
  final Dio _dio;
  final _uuid = const Uuid();

  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? query,
  }) {
    return _send(
      () => _dio.get<dynamic>(path, queryParameters: query),
    );
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    String? idempotencyKey,
  }) {
    return _send(
      () => _dio.post<dynamic>(
        path,
        data: body,
        options: Options(
          headers: {
            if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
          },
        ),
      ),
    );
  }

  Future<dynamic> patch(String path, {Object? body}) {
    return _send(() => _dio.patch<dynamic>(path, data: body));
  }

  Future<dynamic> put(String path, {Object? body}) {
    return _send(() => _dio.put<dynamic>(path, data: body));
  }

  Future<dynamic> delete(String path) {
    return _send(() => _dio.delete<dynamic>(path));
  }

  String newIdempotencyKey() => _uuid.v4();

  Future<dynamic> _send(Future<Response<dynamic>> Function() run) async {
    try {
      final response = await run();
      if (response.statusCode == 204) return null;
      return response.data;
    } on DioException catch (error) {
      throw _map(error);
    }
  }

  ApiException _map(DioException error) {
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return ApiException.network('The network is unavailable.');
    }
    final status = error.response?.statusCode ?? 0;
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      return ApiException.fromBody(status, data);
    }
    return ApiException.fromBody(status, null);
  }
}

final zionApiProvider = Provider<ZionApi>((ref) {
  final config = ref.watch(appConfigProvider);
  final store = ref.watch(secureStoreProvider);
  return ZionApi(
    baseUrl: config.apiRoot,
    secureStore: store,
    refresh: () async {
      final current = store.session;
      if (current == null) return null;
      final client = Dio(
        BaseOptions(
          baseUrl: config.apiRoot,
          headers: const {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        ),
      );
      try {
        final response = await client.post<dynamic>(
          '/auth/refresh',
          data: {'refreshToken': current.refreshToken},
        );
        final session = Session.fromJson(response.data as Map<String, dynamic>);
        await store.write(session);
        return session;
      } on DioException catch (error) {
        final mapped = ApiException.fromBody(
          error.response?.statusCode ?? 0,
          error.response?.data is Map<String, dynamic>
              ? error.response!.data as Map<String, dynamic>
              : null,
        );
        if (mapped.isRevoked || mapped.isUnauthenticated) {
          await store.clear();
        }
        throw mapped;
      }
    },
    onRevoked: () => store.clear(),
  );
});
