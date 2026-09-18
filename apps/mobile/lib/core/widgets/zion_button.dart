import 'package:flutter/material.dart';

import '../theme/tokens.dart';

enum ZionButtonKind { primary, secondary, destructive }

class ZionButton extends StatelessWidget {
  const ZionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.kind = ZionButtonKind.primary,
    this.loading = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final ZionButtonKind kind;
  final bool loading;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: 8),
              ],
              Text(label),
            ],
          );

    final callback = loading ? null : onPressed;
    final button = switch (kind) {
      ZionButtonKind.primary => FilledButton(onPressed: callback, child: child),
      ZionButtonKind.secondary => OutlinedButton(onPressed: callback, child: child),
      ZionButtonKind.destructive => FilledButton(
          onPressed: callback,
          style: FilledButton.styleFrom(backgroundColor: ZionTokens.danger),
          child: child,
        ),
    };

    return Semantics(
      button: true,
      enabled: callback != null,
      label: label,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: ZionTokens.minTap),
        child: button,
      ),
    );
  }
}
