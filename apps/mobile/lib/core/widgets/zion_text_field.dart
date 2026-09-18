import 'package:flutter/material.dart';

import '../theme/tokens.dart';

class ZionTextField extends StatelessWidget {
  const ZionTextField({
    super.key,
    required this.label,
    required this.controller,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.errorText,
    this.autofillHints,
    this.onSubmitted,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? errorText;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      textField: true,
      label: label,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: ZionTokens.minTap),
        child: TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          autofocus: autofocus,
          onSubmitted: onSubmitted,
          decoration: InputDecoration(
            labelText: label,
            errorText: errorText,
          ),
        ),
      ),
    );
  }
}
