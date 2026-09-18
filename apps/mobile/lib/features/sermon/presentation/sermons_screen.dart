import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../data/sermon_repository.dart';

final sermonsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(sermonRepositoryProvider).list();
});

class SermonsScreen extends ConsumerWidget {
  const SermonsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(sermonsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Sermons')),
      body: async.when(
        loading: () => const LoadingState(label: 'Loading sermons'),
        error: (error, _) => ErrorState(
          error: error,
          onRetry: () => ref.invalidate(sermonsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              title: 'No sermons yet',
              body: 'Published messages appear here for study on the go.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(ZionTokens.space * 2),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final sermon = items[index];
              final title = sermon['title'] as String? ?? 'Untitled';
              final id = sermon['id'] as String? ?? '';
              return ZionCard(
                semanticsLabel: title,
                onTap: id.isEmpty ? null : () => context.go('/app/sermons/$id'),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: Theme.of(context).textTheme.titleLarge),
                          if (sermon['speakerName'] != null)
                            Text(sermon['speakerName'] as String),
                        ],
                      ),
                    ),
                    StatusBadge(status: sermon['status'] as String? ?? 'DRAFT'),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
