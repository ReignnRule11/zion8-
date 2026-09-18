import 'hive_boxes.dart';

class OutboxItem {
  const OutboxItem({
    required this.id,
    required this.idempotencyKey,
    required this.method,
    required this.path,
    required this.body,
    required this.createdAt,
    required this.collection,
    this.resourceId,
    this.attempts = 0,
    this.nextAttemptAt,
    this.lastError,
  });

  final String id;
  final String idempotencyKey;
  final String method;
  final String path;
  final Map<String, dynamic>? body;
  final DateTime createdAt;
  final String collection;
  final String? resourceId;
  final int attempts;
  final DateTime? nextAttemptAt;
  final String? lastError;

  Map<String, dynamic> toJson() => {
        'id': id,
        'idempotencyKey': idempotencyKey,
        'method': method,
        'path': path,
        'body': body,
        'createdAt': createdAt.toIso8601String(),
        'collection': collection,
        'resourceId': resourceId,
        'attempts': attempts,
        'nextAttemptAt': nextAttemptAt?.toIso8601String(),
        'lastError': lastError,
      };

  factory OutboxItem.fromJson(Map<dynamic, dynamic> json) {
    return OutboxItem(
      id: json['id'] as String,
      idempotencyKey: json['idempotencyKey'] as String,
      method: json['method'] as String,
      path: json['path'] as String,
      body: (json['body'] as Map?)?.cast<String, dynamic>(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      collection: json['collection'] as String,
      resourceId: json['resourceId'] as String?,
      attempts: json['attempts'] as int? ?? 0,
      nextAttemptAt: json['nextAttemptAt'] == null
          ? null
          : DateTime.parse(json['nextAttemptAt'] as String),
      lastError: json['lastError'] as String?,
    );
  }

  OutboxItem copyWith({
    int? attempts,
    DateTime? nextAttemptAt,
    String? lastError,
  }) {
    return OutboxItem(
      id: id,
      idempotencyKey: idempotencyKey,
      method: method,
      path: path,
      body: body,
      createdAt: createdAt,
      collection: collection,
      resourceId: resourceId,
      attempts: attempts ?? this.attempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      lastError: lastError ?? this.lastError,
    );
  }
}

abstract class OutboxPort {
  List<OutboxItem> pending({DateTime? now});
  List<OutboxItem> all();
  Future<void> enqueue(OutboxItem item);
  Future<void> remove(String id);
  Future<void> update(OutboxItem item);
}

class OutboxStore implements OutboxPort {
  OutboxStore({required HiveBoxes boxes}) : _boxes = boxes;

  final HiveBoxes _boxes;

  List<OutboxItem> pending({DateTime? now}) {
    final moment = now ?? DateTime.now().toUtc();
    final items = _boxes.outbox.values
        .whereType<Map>()
        .map(OutboxItem.fromJson)
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return items
        .where((item) =>
            item.nextAttemptAt == null || !item.nextAttemptAt!.isAfter(moment))
        .toList();
  }

  List<OutboxItem> all() {
    return _boxes.outbox.values
        .whereType<Map>()
        .map(OutboxItem.fromJson)
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  Future<void> enqueue(OutboxItem item) {
    return _boxes.outbox.put(item.id, item.toJson());
  }

  Future<void> remove(String id) {
    return _boxes.outbox.delete(id);
  }

  Future<void> update(OutboxItem item) {
    return _boxes.outbox.put(item.id, item.toJson());
  }
}

/// Exponential backoff: 2s, 4s, 8s, ... capped at 5 minutes.
Duration outboxBackoff(int attempts) {
  final seconds = 2 << attempts.clamp(0, 8);
  final capped = seconds > 300 ? 300 : seconds;
  return Duration(seconds: capped);
}
