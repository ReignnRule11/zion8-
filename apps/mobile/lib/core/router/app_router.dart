import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/lock_screen.dart';
import '../../features/auth/presentation/magic_link_screen.dart';
import '../../features/auth/presentation/mfa_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/auth/presentation/sign_in_screen.dart';
import '../../features/auth/presentation/sign_up_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/giving/presentation/give_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/membership/presentation/member_detail_screen.dart';
import '../../features/membership/presentation/people_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/sermon/presentation/sermon_detail_screen.dart';
import '../../features/sermon/presentation/sermons_screen.dart';
import '../../features/settings/presentation/more_screen.dart';
import '../widgets/responsive_scaffold.dart';
import 'routes.dart';

final _rootKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      return authRedirect(
        status: auth.status,
        location: state.matchedLocation,
        onboardingComplete: auth.onboardingComplete,
      );
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: Routes.signIn, builder: (_, __) => const SignInScreen()),
      GoRoute(path: Routes.signUp, builder: (_, __) => const SignUpScreen()),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(path: Routes.otp, builder: (_, __) => const OtpScreen()),
      GoRoute(
        path: Routes.magicLink,
        builder: (context, state) => MagicLinkScreen(
          token: state.uri.queryParameters['token'],
        ),
      ),
      GoRoute(path: Routes.mfa, builder: (_, __) => const MfaScreen()),
      GoRoute(path: Routes.lock, builder: (_, __) => const LockScreen()),
      GoRoute(
        path: Routes.onboarding,
        builder: (_, __) => const OnboardingScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ResponsiveScaffold(
            navigationShell: navigationShell,
            destinations: const [
              ShellDestination(
                location: Routes.home,
                label: 'Home',
                icon: Icons.home_outlined,
                selectedIcon: Icons.home,
              ),
              ShellDestination(
                location: Routes.people,
                label: 'People',
                icon: Icons.people_outline,
                selectedIcon: Icons.people,
              ),
              ShellDestination(
                location: Routes.sermons,
                label: 'Sermons',
                icon: Icons.menu_book_outlined,
                selectedIcon: Icons.menu_book,
              ),
              ShellDestination(
                location: Routes.give,
                label: 'Give',
                icon: Icons.volunteer_activism_outlined,
                selectedIcon: Icons.volunteer_activism,
              ),
              ShellDestination(
                location: Routes.more,
                label: 'More',
                icon: Icons.more_horiz,
              ),
            ],
          );
        },
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.home,
              builder: (_, __) => const HomeScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.people,
              builder: (_, __) => const PeopleScreen(),
              routes: [
                GoRoute(
                  path: ':memberId',
                  builder: (context, state) => MemberDetailScreen(
                    memberId: state.pathParameters['memberId']!,
                  ),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.sermons,
              builder: (_, __) => const SermonsScreen(),
              routes: [
                GoRoute(
                  path: ':sermonId',
                  builder: (context, state) => SermonDetailScreen(
                    sermonId: state.pathParameters['sermonId']!,
                  ),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.give,
              builder: (_, __) => const GiveScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.more,
              builder: (_, __) => const MoreScreen(),
            ),
          ]),
        ],
      ),
    ],
  );
});
