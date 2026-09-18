import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/features/auth/domain/session.dart';

void main() {
  test('a session payload is not an MFA challenge', () {
    final outcome = parseLoginResult({
      'accessToken': 'a',
      'refreshToken': 'refresh-token-value-32-chars-min',
      'sessionId': '00000000-0000-0000-0000-000000000001',
      'tokenType': 'Bearer',
      'expiresIn': 900,
      'refreshExpiresIn': 2592000,
      'assuranceLevel': 'AAL1',
      'mfaSatisfied': false,
    });
    expect(outcome, isA<LoginSession>());
  });

  test('mfaRequired yields a challenge bound to the attempt', () {
    final outcome = parseLoginResult({
      'mfaRequired': true,
      'mfaToken': 'mfa-token-value-32-characters-long',
      'factors': [
        {'id': 'f1', 'type': 'TOTP', 'name': 'Authenticator'},
      ],
    });
    expect(outcome, isA<LoginMfa>());
    expect((outcome as LoginMfa).challenge.factors.first.type, 'TOTP');
  });
}
