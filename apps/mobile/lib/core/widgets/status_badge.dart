import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Same tones as the web `Badge` so a pastor who uses both clients sees one
/// vocabulary: POSTED is success, DRAFT is neutral, REFUNDED is warning.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  static const _success = {
    'COMPLETED',
    'POSTED',
    'APPROVED',
    'RECORDED',
    'PAID',
    'ACTIVE',
    'PUBLISHED',
    'READY',
  };
  static const _info = {'SUBMITTED', 'PLANNED', 'PROCESSING', 'INVITED'};
  static const _warning = {'LOCKED', 'REFUNDED', 'STALE', 'PENDING'};
  static const _danger = {
    'REJECTED',
    'VOID',
    'TERMINATED',
    'FAILED',
    'ABSENT',
    'SUSPENDED',
    'ARCHIVED',
  };

  Color _tone() {
    final key = status.toUpperCase();
    if (_success.contains(key)) return ZionTokens.success;
    if (_info.contains(key)) return ZionTokens.info;
    if (_warning.contains(key)) return ZionTokens.warning;
    if (_danger.contains(key)) return ZionTokens.danger;
    return ZionTokens.slate400;
  }

  @override
  Widget build(BuildContext context) {
    final color = _tone();
    return Semantics(
      label: 'Status $status',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.16),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          status,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color),
        ),
      ),
    );
  }
}
