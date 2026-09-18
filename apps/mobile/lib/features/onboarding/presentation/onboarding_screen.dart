import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/zion_api.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/presentation/auth_controller.dart';

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set up your church')),
      body: Padding(
        padding: const EdgeInsets.all(ZionTokens.space * 3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'The dashboard unlocks after the required steps. Optional steps can wait.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            ZionButton(
              label: 'Continue on the web',
              onPressed: () {},
            ),
            const SizedBox(height: 12),
            ZionButton(
              label: 'I have finished setup',
              kind: ZionButtonKind.secondary,
              onPressed: () async {
                try {
                  await ref.read(zionApiProvider).post('/onboarding/complete', body: {});
                } catch (_) {}
                await ref.read(authControllerProvider.notifier).restore();
              },
            ),
          ],
        ),
      ),
    );
  }
}
