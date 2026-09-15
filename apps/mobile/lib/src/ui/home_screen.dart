import 'package:flutter/material.dart';

import '../auth/auth_api.dart';
import '../auth/auth_client.dart';
import '../auth/models.dart';

/// Shows the signed-in user's profile and active sessions.
class HomeScreen extends StatefulWidget {
  /// Creates the screen.
  const HomeScreen({required this.auth, super.key});

  /// The authentication client.
  final AuthClient auth;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  MeResponse? _profile;
  List<AuthSessionSummary> _sessions = const <AuthSessionSummary>[];
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final MeResponse profile = await widget.auth.me();
      final List<AuthSessionSummary> sessions = await widget.auth.sessions();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _sessions = sessions;
      });
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke(String sessionId) async {
    try {
      await widget.auth.revokeSession(sessionId);
      await _load();
    } on AuthApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    }
  }

  Future<void> _signOut() async {
    await widget.auth.signOut();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final MeResponse? profile = _profile;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Workspace'),
        actions: <Widget>[
          IconButton(
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
          IconButton(
            onPressed: _signOut,
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: _busy && profile == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                if (_error != null) ...<Widget>[
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                  const SizedBox(height: 16),
                ],
                if (profile != null) ...<Widget>[
                  Text(
                    '${profile.principal.firstName} ${profile.principal.lastName}',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (profile.principal.email != null)
                    Text(profile.principal.email!),
                  const SizedBox(height: 24),
                  Text(
                    'Active sessions',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  for (final AuthSessionSummary entry in _sessions)
                    ListTile(
                      title: Text(entry.deviceName ?? entry.userAgent ?? 'Unknown device'),
                      subtitle: Text(
                        '${entry.status} - ${entry.lastSeenAt.toLocal()}',
                      ),
                      trailing: entry.current
                          ? const Text('This device')
                          : TextButton(
                              onPressed: () => _revoke(entry.id),
                              child: const Text('Revoke'),
                            ),
                    ),
                ],
              ],
            ),
    );
  }
}
