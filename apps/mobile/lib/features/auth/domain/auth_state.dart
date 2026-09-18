import 'session.dart';

enum AuthStatus {
  unknown,
  unauthenticated,
  mfaRequired,
  locked,
  authenticated,
}

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.challenge,
    this.error,
    this.onboardingComplete = true,
  });

  final AuthStatus status;
  final Session? session;
  final MfaChallenge? challenge;
  final String? error;
  final bool onboardingComplete;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  static const unknown = AuthState(status: AuthStatus.unknown);
  static const signedOut = AuthState(status: AuthStatus.unauthenticated);

  AuthState copyWith({
    AuthStatus? status,
    Session? session,
    MfaChallenge? challenge,
    String? error,
    bool? onboardingComplete,
    bool clearError = false,
    bool clearChallenge = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      challenge: clearChallenge ? null : (challenge ?? this.challenge),
      error: clearError ? null : (error ?? this.error),
      onboardingComplete: onboardingComplete ?? this.onboardingComplete,
    );
  }
}

/// The only table that interprets [AuthState] for GoRouter.
String? authRedirect({
  required AuthStatus status,
  required String location,
  required bool onboardingComplete,
}) {
  const public = {
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/otp',
    '/magic-link',
  };

  switch (status) {
    case AuthStatus.unknown:
      return location == '/splash' ? null : '/splash';
    case AuthStatus.unauthenticated:
      return public.contains(location) ? null : '/sign-in';
    case AuthStatus.mfaRequired:
      return location == '/mfa' ? null : '/mfa';
    case AuthStatus.locked:
      return location == '/lock' ? null : '/lock';
    case AuthStatus.authenticated:
      if (!onboardingComplete) {
        return location.startsWith('/onboarding') ? null : '/onboarding';
      }
      if (location.startsWith('/app')) return null;
      return '/app/home';
  }
}
