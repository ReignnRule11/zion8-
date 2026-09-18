import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../data/sermon_repository.dart';

class SermonDetailScreen extends ConsumerWidget {
  const SermonDetailScreen({super.key, required this.sermonId});

  final String sermonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Map<String, dynamic>>(
      future: ref.read(sermonRepositoryProvider).get(sermonId),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: LoadingState(label: 'Loading sermon'));
        }
        if (snapshot.hasError) {
          return Scaffold(body: ErrorState(error: snapshot.error!));
        }
        final sermon = snapshot.data!;
        return Scaffold(
          appBar: AppBar(title: Text(sermon['title'] as String? ?? 'Sermon')),
          body: ListView(
            padding: const EdgeInsets.all(ZionTokens.space * 2),
            children: [
              StatusBadge(status: sermon['status'] as String? ?? 'DRAFT'),
              const SizedBox(height: 16),
              if (sermon['summary'] != null) Text(sermon['summary'] as String),
            ],
          ),
        );
      },
    );
  }
}
