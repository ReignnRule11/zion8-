import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import 'auth_controller.dart';

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _church = TextEditingController();
  final _slug = TextEditingController();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _church.dispose();
    _slug.dispose();
    _first.dispose();
    _last.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).registerChurch(
          churchName: _church.text.trim(),
          slug: _slug.text.trim(),
          firstName: _first.text.trim(),
          lastName: _last.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
        );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final error = ref.watch(authControllerProvider).error;
    return Scaffold(
      appBar: AppBar(title: const Text('Register a church')),
      body: ListView(
        padding: const EdgeInsets.all(ZionTokens.space * 3),
        children: [
          ZionTextField(label: 'Church name', controller: _church, textInputAction: TextInputAction.next),
          const SizedBox(height: 12),
          ZionTextField(label: 'Workspace slug', controller: _slug, textInputAction: TextInputAction.next),
          const SizedBox(height: 12),
          ZionTextField(label: 'First name', controller: _first, textInputAction: TextInputAction.next),
          const SizedBox(height: 12),
          ZionTextField(label: 'Last name', controller: _last, textInputAction: TextInputAction.next),
          const SizedBox(height: 12),
          ZionTextField(
            label: 'Email',
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          ZionTextField(
            label: 'Password',
            controller: _password,
            obscure: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 24),
          ZionButton(label: 'Create workspace', loading: _busy, onPressed: _submit),
          TextButton(
            onPressed: () => context.go(Routes.signIn),
            child: const Text('Already have an account'),
          ),
        ],
      ),
    );
  }
}
