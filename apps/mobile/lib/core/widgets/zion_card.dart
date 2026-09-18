import 'package:flutter/material.dart';

class ZionCard extends StatelessWidget {
  const ZionCard({super.key, required this.child, this.onTap, this.semanticsLabel});

  final Widget child;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final card = Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
    if (onTap == null) {
      return Semantics(container: true, label: semanticsLabel, child: card);
    }
    return Semantics(
      button: true,
      label: semanticsLabel,
      child: InkWell(onTap: onTap, child: card),
    );
  }
}
