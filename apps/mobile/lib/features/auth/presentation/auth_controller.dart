import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/biometrics/biometric_service.dart';
import '../../../core/di.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/zion_api.dart';
import '../../../core/storage/cache_store.dart';
import '../../../core/storage/secure_store.dart';
import '../../../core/theme/brand_theme_controller.dart';
import '../data/auth_repository.dart';
import '../domain/auth_state.dart';
import '../domain/session.dart';

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() => AuthState.unknown;

  AuthRepository get _repo => AuthRepository(ref.read(zionApiProvider));
  SecureStore get _store => ref.read(secureStoreProvider);
  CacheStoreView get _cache => ref.read(cacheStoreProvider);
  BiometricService get _biometrics => ref.read(biometricServiceProvider);

  Future<void> restore() async {
    final session = _store.session;
    if (session == null) {
      state = AuthState.signedOut;
      return;
    }
    final biometricOn = _cache.biometricUnlockEnabled;
    if (biometricOn && await _biometrics.isAvailable()) {
      state = AuthState(status: AuthStatus.locked, session: session);
      return;
    }
    await _activate(session);
  }

  Future<void> unlock() async {
    final session = state.session ?? _store.session;
    if (session == null) {
      state = AuthState.signedOut;
      return;
    }
    final ok = await _biometrics.authenticate();
    if (!ok) return;
    await _activate(session);
  }

  Future<void> signInAnotherWay() async {
    await _store.clear();
    state = AuthState.signedOut;
  }

  Future<void> login({
    String? email,
    String? phone,
    required String password,
    String? tenantSlug,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final outcome = await _repo.login(
        email: email,
        phone: phone,
        password: password,
        tenantSlug: tenantSlug,
      );
      await _applyOutcome(outcome);
      if (tenantSlug != null) {
        await _cache.setLastTenantSlug(tenantSlug);
      }
    } on ApiException catch (error) {
      state = state.copyWith(error: error.message);
    }
  }

  Future<void> verifyMfa(String code) async {
    final token = state.challenge?.mfaToken;
    if (token == null) return;
    try {
      final session = await _repo.verifyMfa(mfaToken: token, code: code);
      await _activate(session, clearChallenge: true);
    } on ApiException catch (error) {
      state = state.copyWith(error: error.message);
    }
  }

  Future<void> registerChurch({
    required String churchName,
    required String slug,
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final session = await _repo.registerChurch(
        churchName: churchName,
        slug: slug,
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      );
      await _activate(session, onboardingComplete: false);
    } on ApiException catch (error) {
      state = state.copyWith(error: error.message);
    }
  }

  Future<void> consumeMagicLink(String token) async {
    try {
      final outcome = await _repo.consumeMagicLink(token: token);
      await _applyOutcome(outcome);
    } on ApiException catch (error) {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        error: error.message,
      );
    }
  }

  Future<void> requestOtp({String? email, String? phone}) {
    return _repo.requestOtp(email: email, phone: phone);
  }

  Future<void> verifyOtp({
    String? email,
    String? phone,
    required String code,
  }) async {
    try {
      final outcome = await _repo.verifyOtp(
        email: email,
        phone: phone,
        code: code,
      );
      await _applyOutcome(outcome);
    } on ApiException catch (error) {
      state = state.copyWith(error: error.message);
    }
  }

  Future<void> requestPasswordReset(String email) {
    return _repo.requestPasswordReset(email: email);
  }

  Future<void> logout() async {
    final refresh = _store.session?.refreshToken;
    if (refresh != null) {
      await _repo.logout(refresh);
    }
    await _store.clear();
    ref.read(brandThemeControllerProvider.notifier).reset();
    ref.read(activeTenantIdProvider.notifier).state = '';
    state = AuthState.signedOut;
  }

  Future<void> enableBiometricUnlock(bool value) {
    return _cache.setBiometricUnlock(value);
  }

  Future<void> _applyOutcome(LoginOutcome outcome) async {
    switch (outcome) {
      case LoginSession(:final session):
        await _activate(session);
      case LoginMfa(:final challenge):
        state = AuthState(
          status: AuthStatus.mfaRequired,
          challenge: challenge,
        );
    }
  }

  Future<void> _activate(
    Session session, {
    bool clearChallenge = false,
    bool? onboardingComplete,
  }) async {
    await _store.write(session);
    var complete = onboardingComplete ?? true;
    try {
      final me = await _repo.me();
      final tenant = me['activeTenant'];
      if (tenant is Map<String, dynamic> && tenant['id'] is String) {
        ref.read(activeTenantIdProvider.notifier).state = tenant['id'] as String;
      }
      if (onboardingComplete == null) {
        try {
          final boarding = await _repo.onboarding();
          complete = boarding['completedAt'] != null ||
              boarding['dashboardReady'] == true ||
              boarding['status'] == 'COMPLETED';
        } on ApiException {
          complete = true;
        }
      }
      await ref.read(brandThemeControllerProvider.notifier).load();
    } on ApiException catch (error) {
      if (error.isUnauthenticated) {
        await _store.clear();
        state = AuthState.signedOut;
        return;
      }
    }
    state = AuthState(
      status: AuthStatus.authenticated,
      session: session,
      onboardingComplete: complete,
    );
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(zionApiProvider));
});
