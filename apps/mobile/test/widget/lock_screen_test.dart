import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/biometrics/biometric_service.dart';
import 'package:zion8/core/di.dart';
import 'package:zion8/core/storage/memory_stores.dart';
import 'package:zion8/core/storage/secure_store.dart';
import 'package:zion8/features/auth/presentation/lock_screen.dart';

void main() {
  testWidgets('lock screen offers unlock and a way out', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureStoreProvider.overrideWithValue(MemorySecureStore()),
          cacheStoreProvider.overrideWithValue(MemoryCacheStore()),
          outboxStoreProvider.overrideWithValue(MemoryOutboxStore()),
          biometricServiceProvider.overrideWithValue(
            FakeBiometricService(succeeds: false),
          ),
        ],
        child: const MaterialApp(home: LockScreen()),
      ),
    );

    expect(find.text('Unlock'), findsOneWidget);
    expect(find.text('Sign in another way'), findsOneWidget);
  });
}
