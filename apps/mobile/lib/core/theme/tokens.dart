import 'package:flutter/material.dart';

/// Shared palette. Values match `apps/web/tailwind.config.ts` (`zion.*`) and
/// `DEFAULT_BRAND_THEME` in `packages/contracts/src/onboarding/branding.schemas.ts`.
/// When `packages/design-tokens` generates Dart, this file is replaced.
abstract final class ZionTokens {
  static const Color zion50 = Color(0xFFEEF2FF);
  static const Color zion100 = Color(0xFFE0E7FF);
  static const Color zion500 = Color(0xFF6366F1);
  static const Color zion600 = Color(0xFF4F46E5);
  static const Color zion700 = Color(0xFF4338CA);
  static const Color zion950 = Color(0xFF1E1B4B);

  static const Color slate50 = Color(0xFFF8FAFC);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate900 = Color(0xFF0F172A);
  static const Color slate950 = Color(0xFF020617);

  static const Color sky400 = Color(0xFF38BDF8);
  static const Color sky600 = Color(0xFF0284C7);

  static const Color success = Color(0xFF34D399);
  static const Color warning = Color(0xFFFBBF24);
  static const Color danger = Color(0xFFF87171);
  static const Color info = Color(0xFF38BDF8);

  static const double space = 8;
  static const double radius = 16;
  static const double minTap = 48;

  static const double display = 32;
  static const double title = 22;
  static const double body = 16;
  static const double label = 12;
}

class BrandOverlay {
  const BrandOverlay({
    required this.primary,
    required this.secondary,
    required this.accent,
    this.displayName,
    this.logoUrl,
  });

  final Color primary;
  final Color secondary;
  final Color accent;
  final String? displayName;
  final String? logoUrl;

  static const BrandOverlay defaults = BrandOverlay(
    primary: ZionTokens.zion600,
    secondary: ZionTokens.slate900,
    accent: ZionTokens.sky400,
  );

  factory BrandOverlay.fromHex({
    String primary = '#4f46e5',
    String secondary = '#0f172a',
    String accent = '#38bdf8',
    String? displayName,
    String? logoUrl,
  }) {
    return BrandOverlay(
      primary: parseHex(primary) ?? ZionTokens.zion600,
      secondary: parseHex(secondary) ?? ZionTokens.slate900,
      accent: parseHex(accent) ?? ZionTokens.sky400,
      displayName: displayName,
      logoUrl: logoUrl,
    );
  }

  static Color? parseHex(String value) {
    final raw = value.trim().replaceFirst('#', '');
    if (raw.length != 6) return null;
    final parsed = int.tryParse(raw, radix: 16);
    if (parsed == null) return null;
    return Color(0xFF000000 | parsed);
  }
}
