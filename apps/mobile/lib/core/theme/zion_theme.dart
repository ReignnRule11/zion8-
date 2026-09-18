import 'package:flutter/material.dart';

import 'tokens.dart';

abstract final class ZionTheme {
  static ThemeData dark(BrandOverlay brand) {
    final scheme = ColorScheme.dark(
      primary: brand.primary,
      secondary: brand.accent,
      surface: ZionTokens.slate950,
      onSurface: ZionTokens.slate200,
      error: ZionTokens.danger,
    );
    return _base(scheme, brand, Brightness.dark);
  }

  static ThemeData light(BrandOverlay brand) {
    final scheme = ColorScheme.light(
      primary: brand.primary,
      secondary: brand.accent,
      surface: ZionTokens.slate50,
      onSurface: ZionTokens.slate900,
      error: ZionTokens.danger,
    );
    return _base(scheme, brand, Brightness.light);
  }

  static ThemeData _base(ColorScheme scheme, BrandOverlay brand, Brightness brightness) {
    final text = TextTheme(
      displaySmall: const TextStyle(
        fontSize: ZionTokens.display,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.4,
      ),
      titleLarge: const TextStyle(
        fontSize: ZionTokens.title,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: const TextStyle(fontSize: ZionTokens.body, height: 1.4),
      bodyMedium: const TextStyle(fontSize: 14, height: 1.4),
      labelSmall: const TextStyle(
        fontSize: ZionTokens.label,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.4,
      ),
    ).apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      textTheme: text,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: brightness == Brightness.dark
            ? ZionTokens.slate900
            : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ZionTokens.radius),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(ZionTokens.minTap, ZionTokens.minTap),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ZionTokens.radius),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(ZionTokens.minTap, ZionTokens.minTap),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ZionTokens.radius),
          ),
        ),
      ),
      cardTheme: CardTheme(
        color: brightness == Brightness.dark ? ZionTokens.slate900 : Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ZionTokens.radius),
          side: BorderSide(
            color: brightness == Brightness.dark
                ? ZionTokens.slate800
                : ZionTokens.slate200,
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: brightness == Brightness.dark
            ? ZionTokens.slate900
            : Colors.white,
        indicatorColor: brand.primary.withOpacity(0.2),
      ),
    );
  }
}
