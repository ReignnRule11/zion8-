class Session {
  const Session({
    required this.accessToken,
    required this.refreshToken,
    required this.sessionId,
    required this.expiresIn,
    required this.refreshExpiresIn,
    required this.assuranceLevel,
    required this.mfaSatisfied,
    this.tokenType = 'Bearer',
  });

  final String accessToken;
  final String refreshToken;
  final String sessionId;
  final int expiresIn;
  final int refreshExpiresIn;
  final String assuranceLevel;
  final bool mfaSatisfied;
  final String tokenType;

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      sessionId: json['sessionId'] as String,
      tokenType: json['tokenType'] as String? ?? 'Bearer',
      expiresIn: json['expiresIn'] as int,
      refreshExpiresIn: json['refreshExpiresIn'] as int,
      assuranceLevel: json['assuranceLevel'] as String? ?? 'AAL1',
      mfaSatisfied: json['mfaSatisfied'] as bool? ?? false,
    );
  }
}

class MfaChallenge {
  const MfaChallenge({
    required this.mfaToken,
    required this.factors,
  });

  final String mfaToken;
  final List<MfaFactor> factors;

  factory MfaChallenge.fromJson(Map<String, dynamic> json) {
    final raw = json['factors'];
    return MfaChallenge(
      mfaToken: json['mfaToken'] as String,
      factors: raw is List
          ? raw
              .whereType<Map<String, dynamic>>()
              .map(MfaFactor.fromJson)
              .toList()
          : const [],
    );
  }
}

class MfaFactor {
  const MfaFactor({required this.id, required this.type, required this.name});

  final String id;
  final String type;
  final String name;

  factory MfaFactor.fromJson(Map<String, dynamic> json) {
    return MfaFactor(
      id: json['id'] as String,
      type: json['type'] as String,
      name: json['name'] as String,
    );
  }
}

sealed class LoginOutcome {
  const LoginOutcome();
}

class LoginSession extends LoginOutcome {
  const LoginSession(this.session);
  final Session session;
}

class LoginMfa extends LoginOutcome {
  const LoginMfa(this.challenge);
  final MfaChallenge challenge;
}

LoginOutcome parseLoginResult(Map<String, dynamic> json) {
  if (json['mfaRequired'] == true) {
    return LoginMfa(MfaChallenge.fromJson(json));
  }
  return LoginSession(Session.fromJson(json));
}
