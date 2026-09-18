import 'package:flutter/widgets.dart';

import '../theme/tokens.dart';

/// Shared accessibility helpers. Widget primitives call these so a feature
/// screen cannot forget a tap target or a semantics label.
abstract final class Access {
  static const double minTap = ZionTokens.minTap;
  static const double maxTextScale = 1.4;

  static TextScaler clampScaler(TextScaler scaler) {
    return scaler.clamp(minScaleFactor: 1, maxScaleFactor: maxTextScale);
  }

  static bool reduceMotion(BuildContext context) {
    return MediaQuery.of(context).disableAnimations;
  }
}
