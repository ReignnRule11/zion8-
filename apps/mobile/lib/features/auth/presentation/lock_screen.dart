import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import 'auth_controller.dart';

class LockScreen extends ConsumerWidget {
  const LockScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(ZionTokens.space * 3),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Zion8 is locked', style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 12),
            const Text('Use biometrics to unlock this device session.'),
            const SizedBox(height: 32),
            ZionButton(
              label: 'Unlock',
              icon: Icons.fingerprint,
              onPressed: () => ref.read(authControllerProvider.notifier).unlock(),
            ),
            const SizedBox(height: 12),
            ZionButton(
              label: 'Sign in another way',
              kind: ZionButtonKind.secondary,
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).signInAnotherWay(),
            ),
          ],
        ),
      ),
    );
  }
}
