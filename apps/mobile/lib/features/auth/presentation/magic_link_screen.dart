import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import 'auth_controller.dart';

class MagicLinkScreen extends ConsumerStatefulWidget {
  const MagicLinkScreen({super.key, this.token});

  final String? token;

  @override
  ConsumerState<MagicLinkScreen> createState() => _MagicLinkScreenState();
}

class _MagicLinkScreenState extends ConsumerState<MagicLinkScreen> {
  @override
  void initState() {
    super.initState();
    final token = widget.token;
    if (token != null && token.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(authControllerProvider.notifier).consumeMagicLink(token);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = ref.watch(authControllerProvider).error;
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(ZionTokens.space * 3),
        child: Center(
          child: error == null
              ? const LoadingState(label: 'Opening your workspace')
              : ErrorState(error: error),
        ),
      ),
    );
  }
}
