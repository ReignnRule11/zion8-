import '../../../core/errors/api_exception.dart';
import '../../../core/network/zion_api.dart';
import '../domain/session.dart';

class AuthRepository {
  AuthRepository(this._api);

  final ZionApi _api;

  Future<LoginOutcome> login({
    String? email,
    String? phone,
    required String password,
    String? tenantSlug,
  }) async {
    final body = <String, dynamic>{
      'password': password,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      if (tenantSlug != null) 'tenantSlug': tenantSlug,
    };
    final payload = await _api.post('/auth/login', body: body);
    return parseLoginResult(payload as Map<String, dynamic>);
  }

  Future<Session> verifyMfa({
    required String mfaToken,
    required String code,
  }) async {
    final payload = await _api.post(
      '/auth/mfa/verify',
      body: {'mfaToken': mfaToken, 'code': code},
    );
    return Session.fromJson(payload as Map<String, dynamic>);
  }

  Future<void> requestMagicLink({required String email, String? tenantSlug}) {
    return _api.post(
      '/auth/magic-link',
      body: {
        'email': email,
        if (tenantSlug != null) 'tenantSlug': tenantSlug,
      },
    );
  }

  Future<LoginOutcome> consumeMagicLink({
    required String token,
    String? tenantSlug,
  }) async {
    final payload = await _api.post(
      '/auth/magic-link/consume',
      body: {
        'token': token,
        if (tenantSlug != null) 'tenantSlug': tenantSlug,
      },
    );
    return parseLoginResult(payload as Map<String, dynamic>);
  }

  Future<void> requestOtp({String? email, String? phone}) {
    return _api.post(
      '/auth/otp',
      body: {
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      },
    );
  }

  Future<LoginOutcome> verifyOtp({
    String? email,
    String? phone,
    required String code,
  }) async {
    final payload = await _api.post(
      '/auth/otp/verify',
      body: {
        'code': code,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      },
    );
    return parseLoginResult(payload as Map<String, dynamic>);
  }

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
    final payload = await _api.post(
      '/auth/register-church',
      body: {
        'church': {
          'name': churchName,
          'slug': slug,
          'timezone': timezone,
          'locale': locale,
        },
        'owner': {
          'firstName': firstName,
          'lastName': lastName,
          'email': email,
          'password': password,
        },
      },
    );
    return Session.fromJson(payload as Map<String, dynamic>);
  }

  Future<Session> refresh(String refreshToken) async {
    final payload = await _api.post(
      '/auth/refresh',
      body: {'refreshToken': refreshToken},
    );
    return Session.fromJson(payload as Map<String, dynamic>);
  }

  Future<void> logout(String refreshToken) async {
    try {
      await _api.post('/auth/logout', body: {'refreshToken': refreshToken});
    } on ApiException {
      // Local sign-out still proceeds; the session is revoked server-side on
      // the next refresh if this call never landed.
    }
  }

  Future<Map<String, dynamic>> me() async {
    final payload = await _api.get('/auth/me');
    return payload as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> onboarding() async {
    final payload = await _api.get('/onboarding');
    return payload as Map<String, dynamic>;
  }

  Future<Session> switchTenant({
    required String tenantId,
    required String refreshToken,
  }) async {
    final payload = await _api.post(
      '/auth/switch-tenant',
      body: {'tenantId': tenantId, 'refreshToken': refreshToken},
    );
    return Session.fromJson(payload as Map<String, dynamic>);
  }

  Future<void> requestPasswordReset({required String email}) {
    return _api.post('/auth/password/reset', body: {'email': email});
  }
}
