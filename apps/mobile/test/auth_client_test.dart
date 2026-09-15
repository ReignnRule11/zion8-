import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zion8_mobile/src/auth/auth_api.dart';
import 'package:zion8_mobile/src/auth/auth_client.dart';
import 'package:zion8_mobile/src/auth/models.dart';
import 'package:zion8_mobile/src/auth/token_store.dart';

Map<String, dynamic> sessionJson({
  String accessToken = 'access-1',
  String refreshToken = 'refresh-1',
  int expiresIn = 900,
  String sessionId = '33333333-3333-4333-8333-333333333333',
  bool mfaSatisfied = false,
}) {
  return <String, dynamic>{
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'tokenType': 'Bearer',
    'expiresIn': expiresIn,
    'refreshExpiresIn': 2592000,
    'sessionId': sessionId,
    'assuranceLevel': mfaSatisfied ? 'AAL2' : 'AAL1',
    'mfaSatisfied': mfaSatisfied,
  };
}

http.Response jsonResponse(Object body, {int status = 200}) {
  return http.Response(
    jsonEncode(body),
    status,
    headers: <String, String>{'content-type': 'application/json'},
  );
}

http.Response errorResponse(String code, String message, {int status = 400}) {
  return jsonResponse(
    <String, dynamic>{
      'error': <String, dynamic>{'code': code, 'message': message},
    },
    status: status,
  );
}

void main() {
  group('AuthClient.login', () {
    test('stores the session when no MFA is required', () async {
      final store = InMemoryTokenStore();
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            expect(request.url.path, '/api/v1/auth/login');
            expect(request.method, 'POST');
            return jsonResponse(sessionJson());
          }),
        ),
        store: store,
      );

      final LoginResult result = await client.login(
        email: 'pastor@grace.example',
        password: 'faithful8church',
      );

      expect(result, isA<LoginSuccess>());
      expect(client.isAuthenticated, isTrue);
      expect((await store.read())?.accessToken, 'access-1');
    });

    test('does not store a session when a second factor is required', () async {
      final store = InMemoryTokenStore();
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            return jsonResponse(<String, dynamic>{
              'mfaRequired': true,
              'mfaToken': 'challenge-token-value-that-is-long-enough',
              'factors': <Map<String, dynamic>>[
                <String, dynamic>{
                  'id': '11111111-1111-4111-8111-111111111111',
                  'type': 'TOTP',
                  'name': 'Authenticator',
                },
              ],
            });
          }),
        ),
        store: store,
      );

      final LoginResult result = await client.login(
        email: 'pastor@grace.example',
        password: 'faithful8church',
      );

      expect(result, isA<LoginRequiresMfa>());
      expect(client.isAuthenticated, isFalse);
      expect(await store.read(), isNull);
    });

    test('surfaces the API error code on invalid credentials', () async {
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', status: 401);
          }),
        ),
        store: InMemoryTokenStore(),
      );

      await expectLater(
        client.login(email: 'pastor@grace.example', password: 'wrong'),
        throwsA(
          isA<AuthApiException>()
              .having((AuthApiException e) => e.code, 'code', 'INVALID_CREDENTIALS')
              .having((AuthApiException e) => e.isUnauthenticated, 'isUnauthenticated', isTrue),
        ),
      );
    });
  });

  group('AuthClient MFA', () {
    test('persists the session after a successful step-up', () async {
      final store = InMemoryTokenStore();
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            expect(request.url.path, '/api/v1/auth/mfa/verify');
            return jsonResponse(sessionJson(mfaSatisfied: true));
          }),
        ),
        store: store,
      );

      final Session session = await client.completeMfa(
        mfaToken: 'challenge-token-value-that-is-long-enough',
        code: '123456',
      );

      expect(session.mfaSatisfied, isTrue);
      expect(session.assuranceLevel, AssuranceLevel.aal2);
      expect((await store.read())?.assuranceLevel, AssuranceLevel.aal2);
    });
  });

  group('AuthClient refresh', () {
    test('refreshes proactively when the access token has expired', () async {
      final store = InMemoryTokenStore();
      int refreshCalls = 0;
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            if (request.url.path == '/api/v1/auth/refresh') {
              refreshCalls++;
              return jsonResponse(sessionJson(accessToken: 'access-2', refreshToken: 'refresh-2'));
            }
            expect(request.headers['authorization'], 'Bearer access-2');
            return jsonResponse(<String, dynamic>{
              'principal': <String, dynamic>{
                'userId': '11111111-1111-4111-8111-111111111111',
                'email': 'pastor@grace.example',
                'phone': null,
                'firstName': 'Grace',
                'lastName': 'Pastor',
                'isPlatformAdmin': false,
              },
              'activeTenant': null,
              'role': null,
              'permissions': <String>[],
              'assuranceLevel': 'AAL1',
              'mfaEnrolled': false,
              'memberships': <Map<String, dynamic>>[],
            });
          }),
        ),
        store: store,
      );

      // Seed an already-expired session directly into the store.
      await store.write(
        Session.fromJson(sessionJson(expiresIn: -1)),
      );
      await client.restore();

      final MeResponse profile = await client.me();

      expect(refreshCalls, 1);
      expect(profile.principal.firstName, 'Grace');
      expect((await store.read())?.accessToken, 'access-2');
    });

    test('refreshes reactively when the server rejects the access token', () async {
      final store = InMemoryTokenStore();
      int meCalls = 0;
      int refreshCalls = 0;
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            if (request.url.path == '/api/v1/auth/refresh') {
              refreshCalls++;
              return jsonResponse(sessionJson(accessToken: 'access-2', refreshToken: 'refresh-2'));
            }
            meCalls++;
            if (meCalls == 1) {
              return errorResponse('TOKEN_REVOKED', 'Session has been revoked', status: 401);
            }
            return jsonResponse(<String, dynamic>{
              'principal': <String, dynamic>{
                'userId': '11111111-1111-4111-8111-111111111111',
                'email': 'pastor@grace.example',
                'phone': null,
                'firstName': 'Grace',
                'lastName': 'Pastor',
                'isPlatformAdmin': false,
              },
              'activeTenant': null,
              'role': null,
              'permissions': <String>[],
              'assuranceLevel': 'AAL1',
              'mfaEnrolled': false,
              'memberships': <Map<String, dynamic>>[],
            });
          }),
        ),
        store: store,
      );

      await store.write(Session.fromJson(sessionJson()));
      await client.restore();

      final MeResponse profile = await client.me();

      expect(refreshCalls, 1);
      expect(meCalls, 2);
      expect(profile.principal.lastName, 'Pastor');
    });

    test('clears the session when the refresh token is rejected', () async {
      final store = InMemoryTokenStore();
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            return errorResponse('TOKEN_REVOKED', 'Session has been revoked', status: 401);
          }),
        ),
        store: store,
      );

      await store.write(Session.fromJson(sessionJson(expiresIn: -1)));
      await client.restore();

      await expectLater(client.me(), throwsA(isA<AuthApiException>()));
      expect(client.isAuthenticated, isFalse);
      expect(await store.read(), isNull);
    });
  });

  group('AuthClient.signOut', () {
    test('clears local state even when the API call fails', () async {
      final store = InMemoryTokenStore();
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async {
            return errorResponse('SERVICE_UNAVAILABLE', 'Down', status: 503);
          }),
        ),
        store: store,
      );

      await store.write(Session.fromJson(sessionJson()));
      await client.restore();

      await client.signOut();

      expect(client.isAuthenticated, isFalse);
      expect(await store.read(), isNull);
    });
  });

  group('AuthClient.restore', () {
    test('returns null when nothing is stored', () async {
      final client = AuthClient(
        api: AuthApi(
          baseUrl: 'http://localhost:4000/api/v1',
          client: MockClient((http.Request request) async => jsonResponse(<String, dynamic>{})),
        ),
        store: InMemoryTokenStore(),
      );

      expect(await client.restore(), isNull);
    });
  });
}
