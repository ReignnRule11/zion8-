import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// Thrown when the API rejects a request with a structured error envelope.
final class AuthApiException implements Exception {
  /// Creates an API exception.
  const AuthApiException({
    required this.code,
    required this.message,
    required this.status,
    this.details = const <FieldIssue>[],
  });

  /// Stable, machine-readable error code.
  final String code;

  /// Human-readable message.
  final String message;

  /// HTTP status code.
  final int status;

  /// Optional field-level validation issues.
  final List<FieldIssue> details;

  /// Whether the failure means the caller is not (or no longer) authenticated.
  bool get isUnauthenticated =>
      status == 401 ||
      code == 'UNAUTHENTICATED' ||
      code == 'TOKEN_EXPIRED' ||
      code == 'TOKEN_REVOKED' ||
      code == 'INVALID_CREDENTIALS';

  @override
  String toString() => 'AuthApiException($status, $code): $message';
}

/// Low-level, stateless client for the Zion8 authentication endpoints.
///
/// This class maps one method to one endpoint and knows nothing about token
/// storage or refresh. [AuthClient] builds the session-aware behaviour on top.
final class AuthApi {
  /// Creates an API for [baseUrl], which must include the versioned prefix,
  /// for example `https://api.zion8.example/api/v1`.
  AuthApi({required this.baseUrl, http.Client? client})
      : _client = client ?? http.Client();

  /// Versioned API base URL.
  final String baseUrl;

  final http.Client _client;

  /// Registers a church workspace and returns the owner session.
  Future<Session> registerChurch({
    required String churchName,
    required String slug,
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String timezone = 'UTC',
    String locale = 'en',
  }) async {
    final Map<String, dynamic> body = await _post('/auth/register-church', <String, dynamic>{
      'church': <String, dynamic>{
        'name': churchName,
        'slug': slug,
        'timezone': timezone,
        'locale': locale,
      },
      'owner': <String, dynamic>{
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'password': password,
      },
    });
    return Session.fromJson(body);
  }

  /// Signs in with a password, possibly returning an MFA challenge.
  Future<LoginResult> login({
    String? email,
    String? phone,
    required String password,
    String? tenantSlug,
  }) async {
    _requireSingleContact(email: email, phone: phone);
    final Map<String, dynamic> body = await _post('/auth/login', <String, dynamic>{
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'password': password,
      if (tenantSlug != null) 'tenantSlug': tenantSlug,
    });
    return parseLoginResult(body);
  }

  /// Completes an MFA challenge with a TOTP or passkey code.
  Future<Session> verifyMfa({
    required String mfaToken,
    required String code,
  }) async {
    final Map<String, dynamic> body = await _post('/auth/mfa/verify', <String, dynamic>{
      'mfaToken': mfaToken,
      'code': code,
    });
    return Session.fromJson(body);
  }

  /// Completes an MFA challenge with a recovery code.
  Future<Session> verifyRecoveryCode({
    required String mfaToken,
    required String recoveryCode,
  }) async {
    final Map<String, dynamic> body = await _post('/auth/mfa/recovery', <String, dynamic>{
      'mfaToken': mfaToken,
      'recoveryCode': recoveryCode,
    });
    return Session.fromJson(body);
  }

  /// Requests a magic sign-in link. Always succeeds, to avoid user enumeration.
  Future<void> requestMagicLink({required String email, String? tenantSlug}) async {
    await _post('/auth/magic-link', <String, dynamic>{
      'email': email,
      if (tenantSlug != null) 'tenantSlug': tenantSlug,
    });
  }

  /// Consumes a magic sign-in link.
  Future<LoginResult> consumeMagicLink({required String token, String? tenantSlug}) async {
    final Map<String, dynamic> body = await _post('/auth/magic-link/consume', <String, dynamic>{
      'token': token,
      if (tenantSlug != null) 'tenantSlug': tenantSlug,
    });
    return parseLoginResult(body);
  }

  /// Requests a one-time code by email or SMS.
  Future<void> requestOtp({String? email, String? phone}) async {
    _requireSingleContact(email: email, phone: phone);
    await _post('/auth/otp', <String, dynamic>{
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
    });
  }

  /// Verifies a one-time code.
  Future<LoginResult> verifyOtp({
    String? email,
    String? phone,
    required String code,
    String? tenantSlug,
  }) async {
    _requireSingleContact(email: email, phone: phone);
    final Map<String, dynamic> body = await _post('/auth/otp/verify', <String, dynamic>{
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'code': code,
      if (tenantSlug != null) 'tenantSlug': tenantSlug,
    });
    return parseLoginResult(body);
  }

  /// Requests a password-reset email. Always succeeds, to avoid user enumeration.
  Future<void> requestPasswordReset({required String email}) async {
    await _post('/auth/password/reset', <String, dynamic>{'email': email});
  }

  /// Completes a password reset with a single-use token.
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    await _post('/auth/password/reset/consume', <String, dynamic>{
      'token': token,
      'newPassword': newPassword,
    });
  }

  /// Changes the password of the signed-in user.
  Future<void> changePassword({
    required String accessToken,
    required String currentPassword,
    required String newPassword,
  }) async {
    await _post(
      '/auth/password/change',
      <String, dynamic>{
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
      accessToken: accessToken,
    );
  }

  /// Rotates the refresh token, returning a new session.
  Future<Session> refresh(String refreshToken) async {
    final Map<String, dynamic> body = await _post('/auth/refresh', <String, dynamic>{
      'refreshToken': refreshToken,
    });
    return Session.fromJson(body);
  }

  /// Revokes the session behind [refreshToken].
  Future<void> logout(String refreshToken) async {
    await _post('/auth/logout', <String, dynamic>{'refreshToken': refreshToken});
  }

  /// Switches the active tenant for the session.
  Future<Session> switchTenant({
    required String accessToken,
    required String tenantId,
    required String refreshToken,
  }) async {
    final Map<String, dynamic> body = await _post(
      '/auth/switch-tenant',
      <String, dynamic>{'tenantId': tenantId, 'refreshToken': refreshToken},
      accessToken: accessToken,
    );
    return Session.fromJson(body);
  }

  /// Loads the current user's profile.
  Future<MeResponse> me(String accessToken) async {
    final Map<String, dynamic> body = await _get('/auth/me', accessToken: accessToken);
    return MeResponse.fromJson(body);
  }

  /// Lists the user's device sessions.
  Future<List<AuthSessionSummary>> listSessions(String accessToken) async {
    final Map<String, dynamic> body =
        await _get('/auth/sessions', accessToken: accessToken);
    final Object? sessions = body['sessions'];
    if (sessions is! List<Object?>) return const <AuthSessionSummary>[];
    return sessions
        .whereType<Map<String, dynamic>>()
        .map(AuthSessionSummary.fromJson)
        .toList(growable: false);
  }

  /// Revokes one device session.
  Future<void> revokeSession({
    required String accessToken,
    required String sessionId,
  }) async {
    await _delete('/auth/sessions/$sessionId', accessToken: accessToken);
  }

  /// Requests an SMS code to verify a phone number.
  Future<void> requestPhoneVerification({
    required String accessToken,
    required String phone,
  }) async {
    await _post(
      '/auth/phone/verify',
      <String, dynamic>{'phone': phone},
      accessToken: accessToken,
    );
  }

  /// Verifies a phone number with an SMS code.
  Future<void> verifyPhone({required String phone, required String code}) async {
    await _post('/auth/phone/verify/consume', <String, dynamic>{
      'phone': phone,
      'code': code,
    });
  }

  /// Closes the underlying HTTP client.
  void close() => _client.close();

  static void _requireSingleContact({String? email, String? phone}) {
    if ((email == null) == (phone == null)) {
      throw ArgumentError('Provide exactly one of email or phone');
    }
  }

  Future<Map<String, dynamic>> _get(String path, {String? accessToken}) =>
      _send('GET', path, accessToken: accessToken);

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    String? accessToken,
  }) =>
      _send('POST', path, body: body, accessToken: accessToken);

  Future<Map<String, dynamic>> _delete(String path, {String? accessToken}) =>
      _send('DELETE', path, accessToken: accessToken);

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    String? accessToken,
  }) async {
    final Uri uri = Uri.parse('$baseUrl$path');
    final http.Request request = http.Request(method, uri)
      ..headers['accept'] = 'application/json';
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    if (accessToken != null) {
      request.headers['authorization'] = 'Bearer $accessToken';
    }

    final http.StreamedResponse streamed = await _client.send(request);
    final http.Response response = await http.Response.fromStream(streamed);
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    if (response.statusCode == 204) return const <String, dynamic>{};

    Map<String, dynamic>? payload;
    if (response.body.isNotEmpty) {
      try {
        final Object? decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) payload = decoded;
      } on FormatException {
        payload = null;
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return payload ?? const <String, dynamic>{};
    }

    final Object? error = payload?['error'];
    if (error is Map<String, dynamic>) {
      final Object? details = error['details'];
      throw AuthApiException(
        code: error['code'] is String ? error['code'] as String : 'INTERNAL_ERROR',
        message:
            error['message'] is String ? error['message'] as String : 'Request failed',
        status: response.statusCode,
        details: details is List<Object?>
            ? details
                .whereType<Map<String, dynamic>>()
                .map(FieldIssue.fromJson)
                .toList(growable: false)
            : const <FieldIssue>[],
      );
    }

    throw AuthApiException(
      code: 'INTERNAL_ERROR',
      message: 'The service is unavailable.',
      status: response.statusCode,
    );
  }
}
