import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/biometrics/biometric_service.dart';
import 'package:zion8/core/di.dart';
import 'package:zion8/core/storage/memory_stores.dart';
import 'package:zion8/core/storage/secure_store.dart';
import 'package:zion8/core/widgets/zion_button.dart';
import 'package:zion8/features/auth/presentation/sign_in_screen.dart';

void main() {
  testWidgets('sign-in exposes labelled fields and a 48dp submit', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureStoreProvider.overrideWithValue(MemorySecureStore()),
          cacheStoreProvider.overrideWithValue(MemoryCacheStore()),
          outboxStoreProvider.overrideWithValue(MemoryOutboxStore()),
          biometricServiceProvider.overrideWithValue(FakeBiometricService()),
        ],
        child: const MaterialApp(home: SignInScreen()),
      ),
    );

    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);

    final submit = tester.getSize(find.byType(ZionButton).first);
    expect(submit.height, greaterThanOrEqualTo(48));
  });
}
