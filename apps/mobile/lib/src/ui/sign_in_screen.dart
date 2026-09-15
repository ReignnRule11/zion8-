import 'package:flutter/material.dart';

import '../auth/auth_api.dart';
import '../auth/auth_client.dart';
import '../auth/models.dart';

/// Email and password sign-in with an inline multi-factor step.
class SignInScreen extends StatefulWidget {
  /// Creates the screen.
  const SignInScreen({
    required this.auth,
    required this.onAuthenticated,
    super.key,
  });

  /// The authentication client.
  final AuthClient auth;

  /// Called once a full session is available.
  final void Function(BuildContext context) onAuthenticated;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _code = TextEditingController();

  bool _busy = false;
  String? _error;
  String? _mfaToken;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _submitCredentials() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final LoginResult result = await widget.auth.login(
        email: _email.text.trim(),
        password: _password.text,
      );
      if (!mounted) return;

      if (result is LoginSuccess) {
        widget.onAuthenticated(context);
      } else if (result is LoginRequiresMfa) {
        setState(() => _mfaToken = result.mfaToken);
      }
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Something went wrong. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitCode() async {
    final String? mfaToken = _mfaToken;
    if (mfaToken == null) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await widget.auth.completeMfa(mfaToken: mfaToken, code: _code.text.trim());
      if (mounted) widget.onAuthenticated(context);
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Something went wrong. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool needsCode = _mfaToken != null;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    'Zion8',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    needsCode
                        ? 'Enter the code from your authenticator app.'
                        : 'Sign in to your church workspace.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  if (_error != null) ...<Widget>[
                    _ErrorBanner(message: _error!),
                    const SizedBox(height: 16),
                  ],
                  if (needsCode)
                    TextField(
                      controller: _code,
                      keyboardType: TextInputType.number,
                      autofillHints: const <String>[AutofillHints.oneTimeCode],
                      decoration: const InputDecoration(
                        labelText: 'Authentication code',
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _submitCode(),
                    )
                  else ...<Widget>[
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const <String>[AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email address',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _password,
                      obscureText: true,
                      autofillHints: const <String>[AutofillHints.password],
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _submitCredentials(),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _busy
                        ? null
                        : (needsCode ? _submitCode : _submitCredentials),
                    child: _busy
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(needsCode ? 'Verify' : 'Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
    );
  }
}
