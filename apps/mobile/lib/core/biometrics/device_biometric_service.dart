import 'package:local_auth/local_auth.dart';

import 'biometric_service.dart';

/// Production adapter. Widget tests never construct this type.
class DeviceBiometricService extends BiometricService {
  DeviceBiometricService({required super.enabled, LocalAuthentication? auth})
      : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> isAvailable() async {
    if (!enabled) return false;
    try {
      if (!await _auth.isDeviceSupported()) return false;
      return _auth.canCheckBiometrics;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> authenticate({String reason = 'Unlock Zion8'}) async {
    if (!enabled) return false;
    try {
      return _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }
}
