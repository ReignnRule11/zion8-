import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/zion_api.dart';
import 'tokens.dart';

class BrandThemeController extends Notifier<BrandOverlay> {
  @override
  BrandOverlay build() => BrandOverlay.defaults;

  Future<void> load() async {
    try {
      final api = ref.read(zionApiProvider);
      final payload = await api.get('/onboarding/branding');
      if (payload is Map<String, dynamic>) {
        state = BrandOverlay.fromHex(
          primary: payload['primaryColor'] as String? ?? '#4f46e5',
          secondary: payload['secondaryColor'] as String? ?? '#0f172a',
          accent: payload['accentColor'] as String? ?? '#38bdf8',
          displayName: payload['displayName'] as String?,
          logoUrl: payload['logoUrl'] as String?,
        );
      }
    } catch (_) {
      state = BrandOverlay.defaults;
    }
  }

  void reset() {
    state = BrandOverlay.defaults;
  }
}

final brandThemeControllerProvider =
    NotifierProvider<BrandThemeController, BrandOverlay>(BrandThemeController.new);
