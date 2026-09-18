import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../data/membership_repository.dart';

final membersProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(membershipRepositoryProvider).listMembers();
});

class PeopleScreen extends ConsumerWidget {
  const PeopleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(membersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('People')),
      body: async.when(
        loading: () => const LoadingState(label: 'Loading people'),
        error: (error, _) => ErrorState(
          error: error,
          onRetry: () => ref.invalidate(membersProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              title: 'No people yet',
              body: 'Import members from the web workspace or add them here later.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(ZionTokens.space * 2),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final member = items[index];
              final name =
                  '${member['firstName'] ?? ''} ${member['lastName'] ?? ''}'.trim();
              final status = member['status'] as String? ?? 'ACTIVE';
              final id = member['id'] as String? ?? '';
              return ZionCard(
                semanticsLabel: name,
                onTap: id.isEmpty ? null : () => context.go('/app/people/$id'),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: Theme.of(context).textTheme.titleLarge),
                          if (member['email'] != null)
                            Text(member['email'] as String),
                        ],
                      ),
                    ),
                    StatusBadge(status: status),
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
