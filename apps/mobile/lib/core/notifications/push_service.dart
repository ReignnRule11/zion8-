import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../sync/sync_engine.dart';

/// Foreground display and cache invalidation. Device-token registration waits
/// for the notifications bounded context; the token is stored in Hive so that
/// module can upload it later without asking again.
class PushService {
  PushService({required this.onInvalidate});

  final void Function(List<String> collections) onInvalidate;
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  Future<void> initialize() async {
    if (_ready) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );
    _ready = true;
  }

  void handleData(Map<String, dynamic> data) {
    final raw = data['invalidate'];
    final collections = <String>[];
    if (raw is String && raw.isNotEmpty) {
      collections.addAll(raw.split(',').map((part) => part.trim()));
    } else if (raw is List) {
      collections.addAll(raw.whereType<String>());
    }
    if (collections.isNotEmpty) onInvalidate(collections);
  }

  Future<void> show({required String title, required String body}) async {
    if (!_ready) return;
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'zion8.default',
        'Zion8',
        importance: Importance.defaultImportance,
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _plugin.show(DateTime.now().millisecondsSinceEpoch ~/ 1000, title, body, details);
  }
}

class FakePushService extends PushService {
  FakePushService() : super(onInvalidate: (_) {});

  @override
  Future<void> initialize() async {}
}

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(
    onInvalidate: (collections) {
      ref.read(syncEngineProvider).invalidate(collections);
    },
  );
});
