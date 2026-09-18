import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'biometrics/biometric_service.dart';
import 'biometrics/device_biometric_service.dart';
import 'config/app_config.dart';
import 'storage/cache_store.dart';
import 'storage/hive_boxes.dart';
import 'storage/keychain_secure_store.dart';
import 'storage/outbox_store.dart';
import 'storage/secure_store.dart';

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromEnvironment());

final secureStoreProvider = Provider<SecureStore>((ref) => KeychainSecureStore());

final cacheStoreProvider = Provider<CacheStoreView>((ref) {
  return CacheStore(boxes: ref.watch(hiveBoxesProvider));
});

final outboxStoreProvider = Provider<OutboxPort>((ref) {
  return OutboxStore(boxes: ref.watch(hiveBoxesProvider));
});

final biometricServiceProvider = Provider<BiometricService>((ref) {
  return DeviceBiometricService(
    enabled: ref.watch(appConfigProvider).enableBiometrics,
  );
});

final activeTenantIdProvider = StateProvider<String>((ref) => '');
