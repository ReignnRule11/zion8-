import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/features/auth/domain/auth_state.dart';

void main() {
  group('authRedirect', () {
    test('unknown always goes to splash', () {
      expect(
        authRedirect(
          status: AuthStatus.unknown,
          location: '/sign-in',
          onboardingComplete: true,
        ),
        '/splash',
      );
      expect(
        authRedirect(
          status: AuthStatus.unknown,
          location: '/splash',
          onboardingComplete: true,
        ),
        isNull,
      );
    });

    test('unauthenticated may only stay on public auth routes', () {
      expect(
        authRedirect(
          status: AuthStatus.unauthenticated,
          location: '/sign-in',
          onboardingComplete: true,
        ),
        isNull,
      );
      expect(
        authRedirect(
          status: AuthStatus.unauthenticated,
          location: '/app/home',
          onboardingComplete: true,
        ),
        '/sign-in',
      );
    });

    test('mfaRequired is pinned to /mfa', () {
      expect(
        authRedirect(
          status: AuthStatus.mfaRequired,
          location: '/sign-in',
          onboardingComplete: true,
        ),
        '/mfa',
      );
    });

    test('locked is pinned to /lock', () {
      expect(
        authRedirect(
          status: AuthStatus.locked,
          location: '/app/home',
          onboardingComplete: true,
        ),
        '/lock',
      );
    });

    test('authenticated with incomplete onboarding stays on /onboarding', () {
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: '/app/home',
          onboardingComplete: false,
        ),
        '/onboarding',
      );
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: '/onboarding',
          onboardingComplete: false,
        ),
        isNull,
      );
    });

    test('authenticated lands on the shell', () {
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: '/sign-in',
          onboardingComplete: true,
        ),
        '/app/home',
      );
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: '/app/people',
          onboardingComplete: true,
        ),
        isNull,
      );
    });
  });
}
