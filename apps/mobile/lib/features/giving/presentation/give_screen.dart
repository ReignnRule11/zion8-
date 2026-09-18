import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../data/giving_repository.dart';

final contributionsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(givingRepositoryProvider).contributions();
});

class GiveScreen extends ConsumerWidget {
  const GiveScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(contributionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Give')),
      body: async.when(
        loading: () => const LoadingState(label: 'Loading gifts'),
        error: (error, _) => ErrorState(
          error: error,
          onRetry: () => ref.invalidate(contributionsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              title: 'No gifts yet',
              body: 'Recorded contributions appear here. Journals stay on the web.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(ZionTokens.space * 2),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final row = items[index];
              final minor = row['amountMinor'] is int
                  ? row['amountMinor'] as int
                  : int.tryParse('${row['amountMinor']}') ?? 0;
              return ZionCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          MoneyText(minor: minor),
                          Text(row['donorName'] as String? ?? 'Anonymous'),
                        ],
                      ),
                    ),
                    StatusBadge(status: row['status'] as String? ?? 'POSTED'),
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
