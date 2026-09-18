import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Today')),
      body: ListView(
        padding: const EdgeInsets.all(ZionTokens.space * 2),
        children: [
          ZionCard(
            semanticsLabel: 'People',
            onTap: () => context.go(Routes.people),
            child: const ListTile(
              title: Text('People'),
              subtitle: Text('Members, families, visitors, attendance'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const SizedBox(height: 12),
          ZionCard(
            semanticsLabel: 'Sermons',
            onTap: () => context.go(Routes.sermons),
            child: const ListTile(
              title: Text('Sermons'),
              subtitle: Text('Library, series, notes'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const SizedBox(height: 12),
          ZionCard(
            semanticsLabel: 'Give',
            onTap: () => context.go(Routes.give),
            child: const ListTile(
              title: Text('Give'),
              subtitle: Text('Funds and recent gifts'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
        ],
      ),
    );
  }
}
