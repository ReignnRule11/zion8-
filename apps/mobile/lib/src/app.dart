import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'auth/auth_api.dart';
import 'auth/auth_client.dart';
import 'auth/token_store.dart';
import 'ui/home_screen.dart';
import 'ui/sign_in_screen.dart';

/// Base URL of the versioned API.
///
/// Override at build time with:
/// `flutter run --dart-define=ZION8_API_BASE_URL=https://api.example.com/api/v1`
const String kApiBaseUrl = String.fromEnvironment(
  'ZION8_API_BASE_URL',
  defaultValue: 'http://localhost:4000/api/v1',
);

/// Builds the authentication client used by the application.
AuthClient buildAuthClient({http.Client? httpClient}) {
  return AuthClient(
    api: AuthApi(baseUrl: kApiBaseUrl, client: httpClient),
    store: const SecureTokenStore(),
  );
}

/// The Zion8 mobile application.
class Zion8App extends StatefulWidget {
  /// Creates the application.
  const Zion8App({super.key, this.authClient});

  /// Optional pre-built client, used by tests to inject a fake.
  final AuthClient? authClient;

  @override
  State<Zion8App> createState() => _Zion8AppState();
}

class _Zion8AppState extends State<Zion8App> {
  late final AuthClient _auth = widget.authClient ?? buildAuthClient();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Zion8',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6D4AFF),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: SignInScreen(
        auth: _auth,
        onAuthenticated: (BuildContext context) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute<void>(
              builder: (_) => HomeScreen(auth: _auth),
            ),
          );
        },
      ),
    );
  }
}
