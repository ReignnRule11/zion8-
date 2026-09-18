/// Unlocks a refresh token already on the device. This is not an identity
/// provider: the API still records `REFRESH` as the authentication method.
class BiometricService {
  BiometricService({
    required this.enabled,
    this.availableFn,
    this.authenticateFn,
  });

  final bool enabled;
  final Future<bool> Function()? availableFn;
  final Future<bool> Function(String reason)? authenticateFn;

  Future<bool> isAvailable() async {
    if (!enabled) return false;
    if (availableFn != null) return availableFn!();
    return false;
  }

  Future<bool> authenticate({String reason = 'Unlock Zion8'}) async {
    if (!enabled) return false;
    if (authenticateFn != null) return authenticateFn!(reason);
    return false;
  }
}

class FakeBiometricService extends BiometricService {
  FakeBiometricService({this.available = true, this.succeeds = true})
      : super(enabled: true);

  final bool available;
  final bool succeeds;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<bool> authenticate({String reason = 'Unlock Zion8'}) async => succeeds;
}
