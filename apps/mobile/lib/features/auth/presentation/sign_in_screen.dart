import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import 'auth_controller.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _slug = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _slug.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).login(
          email: _email.text.trim(),
          password: _password.text,
          tenantSlug: _slug.text.trim().isEmpty ? null : _slug.text.trim(),
        );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(
            padding: const EdgeInsets.all(ZionTokens.space * 3),
            children: [
              Text('Zion8', style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(
                'Sign in to your church workspace.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 32),
              ZionTextField(
                label: 'Email',
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.username, AutofillHints.email],
              ),
              const SizedBox(height: 12),
              ZionTextField(
                label: 'Password',
                controller: _password,
                obscure: true,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.password],
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 12),
              ZionTextField(
                label: 'Church slug (optional)',
                controller: _slug,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              if (auth.error != null) ...[
                const SizedBox(height: 12),
                Text(
                  auth.error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 24),
              ZionButton(
                label: 'Sign in',
                loading: _busy,
                onPressed: _submit,
              ),
              const SizedBox(height: 12),
              ZionButton(
                label: 'Use a one-time code',
                kind: ZionButtonKind.secondary,
                onPressed: () => context.go(Routes.otp),
              ),
              TextButton(
                onPressed: () => context.go(Routes.forgotPassword),
                child: const Text('Forgot password'),
              ),
              TextButton(
                onPressed: () => context.go(Routes.signUp),
                child: const Text('Register a church'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
