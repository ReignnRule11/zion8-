import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../data/membership_repository.dart';

class MemberDetailScreen extends ConsumerWidget {
  const MemberDetailScreen({super.key, required this.memberId});

  final String memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Map<String, dynamic>>(
      future: ref.read(membershipRepositoryProvider).getMember(memberId),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: LoadingState(label: 'Loading member'));
        }
        if (snapshot.hasError) {
          return Scaffold(body: ErrorState(error: snapshot.error!));
        }
        final member = snapshot.data!;
        final name = '${member['firstName'] ?? ''} ${member['lastName'] ?? ''}'.trim();
        return Scaffold(
          appBar: AppBar(title: Text(name)),
          body: ListView(
            padding: const EdgeInsets.all(ZionTokens.space * 2),
            children: [
              ZionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatusBadge(status: member['status'] as String? ?? 'ACTIVE'),
                    const SizedBox(height: 12),
                    if (member['email'] != null) Text(member['email'] as String),
                    if (member['phone'] != null) Text(member['phone'] as String),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
