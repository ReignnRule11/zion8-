import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/brand_theme_controller.dart';
import 'core/theme/zion_theme.dart';
import 'features/auth/presentation/auth_controller.dart';

class ZionApp extends ConsumerWidget {
  const ZionApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final brand = ref.watch(brandThemeControllerProvider);
    final brightness = ref.watch(authControllerProvider).isAuthenticated
        ? Brightness.dark
        : Brightness.dark;

    return MaterialApp.router(
      title: 'Zion8',
      debugShowCheckedModeBanner: false,
      theme: ZionTheme.light(brand),
      darkTheme: ZionTheme.dark(brand),
      themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      routerConfig: router,
    );
  }
}
