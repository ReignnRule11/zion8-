import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:zion8/features/auth/domain/auth_state.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  test('cold start redirect table matches the architecture', () {
    expect(
      authRedirect(
        status: AuthStatus.unknown,
        location: '/',
        onboardingComplete: true,
      ),
      '/splash',
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
}
