import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import 'auth_controller.dart';

class MfaScreen extends ConsumerStatefulWidget {
  const MfaScreen({super.key});

  @override
  ConsumerState<MfaScreen> createState() => _MfaScreenState();
}

class _MfaScreenState extends ConsumerState<MfaScreen> {
  final _code = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).verifyMfa(_code.text.trim());
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final factor = auth.challenge?.factors.isNotEmpty == true
        ? auth.challenge!.factors.first.name
        : 'authenticator';
    return Scaffold(
      appBar: AppBar(title: const Text('Two-step verification')),
      body: Padding(
        padding: const EdgeInsets.all(ZionTokens.space * 3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Enter the 6-digit code from $factor.'),
            const SizedBox(height: 16),
            ZionTextField(
              label: 'Code',
              controller: _code,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
            ),
            if (auth.error != null) ...[
              const SizedBox(height: 12),
              Text(auth.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 24),
            ZionButton(label: 'Verify', loading: _busy, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
