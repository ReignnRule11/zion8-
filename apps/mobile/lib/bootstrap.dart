import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/di.dart';
import 'core/notifications/push_service.dart';
import 'core/storage/hive_boxes.dart';
import 'core/sync/sync_engine.dart';
import 'features/auth/presentation/auth_controller.dart';

export 'core/di.dart';

/// Opens Hive, constructs the [ProviderContainer], and warms the session.
///
/// Widget tests call this with in-memory overrides instead of plugins.
Future<ProviderContainer> bootstrap({
  ProviderContainer? parent,
  List<Override> overrides = const [],
  bool initHive = true,
}) async {
  WidgetsFlutterBinding.ensureInitialized();
  if (initHive) {
    await Hive.initFlutter();
    await openZionBoxes();
  }

  final container = ProviderContainer(
    parent: parent,
    overrides: overrides,
  );

  await container.read(secureStoreProvider).hydrate();
  await container.read(authControllerProvider.notifier).restore();

  final push = container.read(pushServiceProvider);
  await push.initialize();

  final engine = container.read(syncEngineProvider);
  engine.attach();
  await engine.registerBackgroundTask();

  return container;
}
