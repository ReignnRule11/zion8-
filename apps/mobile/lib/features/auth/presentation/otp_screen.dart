import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import 'auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  bool _sent = false;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).requestOtp(email: _email.text.trim());
    if (mounted) setState(() {
      _busy = false;
      _sent = true;
    });
  }

  Future<void> _verify() async {
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).verifyOtp(
          email: _email.text.trim(),
          code: _code.text.trim(),
        );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final error = ref.watch(authControllerProvider).error;
    return Scaffold(
      appBar: AppBar(title: const Text('One-time code')),
      body: Padding(
        padding: const EdgeInsets.all(ZionTokens.space * 3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ZionTextField(
              label: 'Email',
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            if (_sent) ...[
              const SizedBox(height: 12),
              ZionTextField(
                label: 'Code',
                controller: _code,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _verify(),
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 24),
            ZionButton(
              label: _sent ? 'Verify code' : 'Send code',
              loading: _busy,
              onPressed: _sent ? _verify : _request,
            ),
            TextButton(
              onPressed: () => context.go(Routes.signIn),
              child: const Text('Back to sign in'),
            ),
          ],
        ),
      ),
    );
  }
}
