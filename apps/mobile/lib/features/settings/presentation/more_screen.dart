import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/presentation/auth_controller.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final biometric = ref.watch(cacheStoreProvider).biometricUnlockEnabled;
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        padding: const EdgeInsets.all(ZionTokens.space * 2),
        children: [
          ZionCard(
            child: SwitchListTile(
              title: const Text('Unlock with biometrics'),
              subtitle: const Text('Requires presence before a stored refresh token is used.'),
              value: biometric,
              onChanged: (value) =>
                  ref.read(authControllerProvider.notifier).enableBiometricUnlock(value),
            ),
          ),
          const SizedBox(height: 12),
          ZionButton(
            label: 'Sign out',
            kind: ZionButtonKind.destructive,
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}
