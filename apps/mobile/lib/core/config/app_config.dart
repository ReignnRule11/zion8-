/// Runtime configuration. Values come from `--dart-define`, never from a
/// committed file. Names match the web/API convention: origin plus a version
/// that becomes `/api/v$version`.
class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.apiVersion,
    required this.enableBiometrics,
  });

  final String apiBaseUrl;
  final String apiVersion;
  final bool enableBiometrics;

  String get apiRoot {
    final origin = apiBaseUrl.endsWith('/')
        ? apiBaseUrl.substring(0, apiBaseUrl.length - 1)
        : apiBaseUrl;
    return '$origin/api/v$apiVersion';
  }

  factory AppConfig.fromEnvironment() {
    return const AppConfig(
      apiBaseUrl: String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:4000',
      ),
      apiVersion: String.fromEnvironment('API_VERSION', defaultValue: '1'),
      enableBiometrics: bool.fromEnvironment(
        'ENABLE_BIOMETRICS',
        defaultValue: true,
      ),
    );
  }
}
