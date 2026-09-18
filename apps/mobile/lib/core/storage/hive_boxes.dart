import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

abstract final class HiveBoxName {
  static const cache = 'zion8.cache.v1';
  static const outbox = 'zion8.outbox.v1';
  static const prefs = 'zion8.prefs.v1';
}

class HiveBoxes {
  const HiveBoxes({
    required this.cache,
    required this.outbox,
    required this.prefs,
  });

  final Box<dynamic> cache;
  final Box<dynamic> outbox;
  final Box<dynamic> prefs;
}

HiveBoxes? _opened;

Future<HiveBoxes> openZionBoxes() async {
  if (_opened != null) return _opened!;
  final cache = await Hive.openBox<dynamic>(HiveBoxName.cache);
  final outbox = await Hive.openBox<dynamic>(HiveBoxName.outbox);
  final prefs = await Hive.openBox<dynamic>(HiveBoxName.prefs);
  _opened = HiveBoxes(cache: cache, outbox: outbox, prefs: prefs);
  return _opened!;
}

/// In-memory boxes for widget tests. Hive.initFlutter is not required.
HiveBoxes memoryBoxes() {
  return HiveBoxes(
    cache: Hive.box<dynamic>(HiveBoxName.cache),
    outbox: Hive.box<dynamic>(HiveBoxName.outbox),
    prefs: Hive.box<dynamic>(HiveBoxName.prefs),
  );
}

final hiveBoxesProvider = Provider<HiveBoxes>((ref) {
  final opened = _opened;
  if (opened == null) {
    throw StateError('Hive boxes have not been opened. Call bootstrap() first.');
  }
  return opened;
});

void debugSetHiveBoxes(HiveBoxes boxes) {
  _opened = boxes;
}
