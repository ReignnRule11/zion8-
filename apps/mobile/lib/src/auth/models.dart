/// Dart representations of the Zion8 authentication contracts.
///
/// These mirror the Zod schemas in `packages/contracts`. They are intentionally
/// hand-written rather than generated so the mobile application has no build-time
/// dependency on the TypeScript toolchain.
library;

/// Returns a required string field or throws a [FormatException].
String _string(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  if (value is String) return value;
  throw FormatException('Expected string field "$key"');
}

/// Returns a nullable string field.
String? _stringOrNull(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  return value is String ? value : null;
}

/// Returns a required boolean field or throws a [FormatException].
bool _bool(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  if (value is bool) return value;
  throw FormatException('Expected boolean field "$key"');
}

/// Returns a required integer field or throws a [FormatException].
int _int(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  if (value is int) return value;
  throw FormatException('Expected integer field "$key"');
}

/// Returns a required JSON object field or throws a [FormatException].
Map<String, dynamic> _object(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  if (value is Map<String, dynamic>) return value;
  throw FormatException('Expected object field "$key"');
}

/// Returns a list of JSON objects for a field, defaulting to empty.
List<Map<String, dynamic>> _objects(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  if (value == null) return const <Map<String, dynamic>>[];
  if (value is List<Object?>) {
    return value.whereType<Map<String, dynamic>>().toList(growable: false);
  }
  throw FormatException('Expected list field "$key"');
}

/// Returns a list of strings for a field, defaulting to empty.
List<String> _strings(Map<String, dynamic> json, String key) {
  final Object? value = json[key];
  if (value == null) return const <String>[];
  if (value is List<Object?>) {
    return value.whereType<String>().toList(growable: false);
  }
  throw FormatException('Expected list field "$key"');
}

/// The level of assurance a session reached.
enum AssuranceLevel {
  /// Single factor.
  aal1,

  /// Two factors.
  aal2,

  /// Phishing-resistant or hardware-backed second factor.
  aal3;

  /// Parses the wire value, defaulting to [AssuranceLevel.aal1].
  static AssuranceLevel parse(String? value) {
    switch (value) {
      case 'AAL2':
        return AssuranceLevel.aal2;
      case 'AAL3':
        return AssuranceLevel.aal3;
      default:
        return AssuranceLevel.aal1;
    }
  }
}

/// A minted session. Access tokens are short-lived and refresh tokens rotate.
final class Session {
  /// Creates a session.
  Session({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.refreshExpiresIn,
    required this.sessionId,
    required this.assuranceLevel,
    required this.mfaSatisfied,
    DateTime? issuedAt,
  }) : issuedAt = issuedAt ?? DateTime.now();

  /// Decodes a session from the API.
  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      accessToken: _string(json, 'accessToken'),
      refreshToken: _string(json, 'refreshToken'),
      expiresIn: _int(json, 'expiresIn'),
      refreshExpiresIn: _int(json, 'refreshExpiresIn'),
      sessionId: _string(json, 'sessionId'),
      assuranceLevel: AssuranceLevel.parse(_stringOrNull(json, 'assuranceLevel')),
      mfaSatisfied: _bool(json, 'mfaSatisfied'),
    );
  }

  /// Short-lived bearer token for API calls.
  final String accessToken;

  /// Rotating, opaque refresh token bound to [sessionId].
  final String refreshToken;

  /// Access-token lifetime in seconds.
  final int expiresIn;

  /// Refresh-token lifetime in seconds.
  final int refreshExpiresIn;

  /// Stable identifier for the session behind this token pair.
  final String sessionId;

  /// Assurance level reached by this session.
  final AssuranceLevel assuranceLevel;

  /// Whether a second factor was satisfied in this session.
  final bool mfaSatisfied;

  /// When the token pair was received.
  final DateTime issuedAt;

  /// When the access token expires.
  DateTime get accessTokenExpiresAt =>
      issuedAt.add(Duration(seconds: expiresIn));

  /// Whether the access token has expired.
  bool get isAccessTokenExpired => DateTime.now().isAfter(accessTokenExpiresAt);

  /// Encodes the session for secure storage.
  Map<String, dynamic> toJson() => <String, dynamic>{
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresIn': expiresIn,
        'refreshExpiresIn': refreshExpiresIn,
        'sessionId': sessionId,
        'assuranceLevel': assuranceLevel.name.toUpperCase(),
        'mfaSatisfied': mfaSatisfied,
      };
}

/// A second factor offered by the API when a login needs step-up.
final class MfaFactorChoice {
  /// Creates a factor choice.
  const MfaFactorChoice({
    required this.id,
    required this.type,
    required this.name,
  });

  /// Decodes a factor choice from the API.
  factory MfaFactorChoice.fromJson(Map<String, dynamic> json) {
    return MfaFactorChoice(
      id: _string(json, 'id'),
      type: _string(json, 'type'),
      name: _string(json, 'name'),
    );
  }

  /// Factor identifier.
  final String id;

  /// `TOTP` or `WEBAUTHN`.
  final String type;

  /// Human-readable label.
  final String name;
}

/// The outcome of a login attempt.
sealed class LoginResult {
  const LoginResult();
}

/// The login completed and produced a session.
final class LoginSuccess extends LoginResult {
  /// Creates a successful login result.
  const LoginSuccess(this.session);

  /// The minted session.
  final Session session;
}

/// The login requires a second factor.
final class LoginRequiresMfa extends LoginResult {
  /// Creates a step-up result.
  const LoginRequiresMfa({
    required this.mfaToken,
    required this.factors,
  });

  /// Short-lived token that authorises completing the challenge.
  final String mfaToken;

  /// Factors the user can satisfy.
  final List<MfaFactorChoice> factors;
}

/// Decodes a login response, distinguishing a session from a step-up challenge.
LoginResult parseLoginResult(Map<String, dynamic> json) {
  final Object? required = json['mfaRequired'];
  if (required == true) {
    return LoginRequiresMfa(
      mfaToken: _string(json, 'mfaToken'),
      factors: _objects(json, 'factors')
          .map(MfaFactorChoice.fromJson)
          .toList(growable: false),
    );
  }
  return LoginSuccess(Session.fromJson(json));
}

/// A tenant the user belongs to.
final class TenantSummary {
  /// Creates a tenant summary.
  const TenantSummary({
    required this.id,
    required this.slug,
    required this.name,
    required this.status,
  });

  /// Decodes a tenant summary from the API.
  factory TenantSummary.fromJson(Map<String, dynamic> json) {
    return TenantSummary(
      id: _string(json, 'id'),
      slug: _string(json, 'slug'),
      name: _string(json, 'name'),
      status: _string(json, 'status'),
    );
  }

  /// Tenant identifier.
  final String id;

  /// URL-safe workspace slug.
  final String slug;

  /// Display name.
  final String name;

  /// Lifecycle status.
  final String status;
}

/// The authenticated principal.
final class Principal {
  /// Creates a principal.
  const Principal({
    required this.userId,
    required this.email,
    required this.phone,
    required this.firstName,
    required this.lastName,
    required this.isPlatformAdmin,
  });

  /// Decodes a principal from the API.
  factory Principal.fromJson(Map<String, dynamic> json) {
    return Principal(
      userId: _string(json, 'userId'),
      email: _stringOrNull(json, 'email'),
      phone: _stringOrNull(json, 'phone'),
      firstName: _string(json, 'firstName'),
      lastName: _string(json, 'lastName'),
      isPlatformAdmin: _bool(json, 'isPlatformAdmin'),
    );
  }

  /// User identifier.
  final String userId;

  /// Primary email, if any.
  final String? email;

  /// Primary phone, if any.
  final String? phone;

  /// Given name.
  final String firstName;

  /// Family name.
  final String lastName;

  /// Whether the user is a platform administrator.
  final bool isPlatformAdmin;
}

/// A membership in a church workspace.
final class MembershipSummary {
  /// Creates a membership summary.
  const MembershipSummary({
    required this.tenantId,
    required this.tenantName,
    required this.tenantSlug,
    required this.role,
    required this.status,
  });

  /// Decodes a membership from the API.
  factory MembershipSummary.fromJson(Map<String, dynamic> json) {
    return MembershipSummary(
      tenantId: _string(json, 'tenantId'),
      tenantName: _string(json, 'tenantName'),
      tenantSlug: _string(json, 'tenantSlug'),
      role: _string(json, 'role'),
      status: _string(json, 'status'),
    );
  }

  /// Tenant identifier.
  final String tenantId;

  /// Tenant display name.
  final String tenantName;

  /// Tenant slug.
  final String tenantSlug;

  /// Role held in the tenant.
  final String role;

  /// Membership status.
  final String status;
}

/// The current user's profile and access context.
final class MeResponse {
  /// Creates a profile response.
  const MeResponse({
    required this.principal,
    required this.activeTenant,
    required this.role,
    required this.permissions,
    required this.assuranceLevel,
    required this.mfaEnrolled,
    required this.memberships,
  });

  /// Decodes a profile response from the API.
  factory MeResponse.fromJson(Map<String, dynamic> json) {
    final Object? tenant = json['activeTenant'];
    return MeResponse(
      principal: Principal.fromJson(_object(json, 'principal')),
      activeTenant: tenant is Map<String, dynamic>
          ? TenantSummary.fromJson(tenant)
          : null,
      role: _stringOrNull(json, 'role'),
      permissions: _strings(json, 'permissions'),
      assuranceLevel: AssuranceLevel.parse(_stringOrNull(json, 'assuranceLevel')),
      mfaEnrolled: _bool(json, 'mfaEnrolled'),
      memberships: _objects(json, 'memberships')
          .map(MembershipSummary.fromJson)
          .toList(growable: false),
    );
  }

  /// The authenticated user.
  final Principal principal;

  /// The tenant currently bound to the session, if any.
  final TenantSummary? activeTenant;

  /// Role in [activeTenant].
  final String? role;

  /// Permissions granted in [activeTenant].
  final List<String> permissions;

  /// Assurance level of the current session.
  final AssuranceLevel assuranceLevel;

  /// Whether the user has an active second factor.
  final bool mfaEnrolled;

  /// All workspaces the user belongs to.
  final List<MembershipSummary> memberships;
}

/// A summary of one device session.
final class AuthSessionSummary {
  /// Creates a session summary.
  const AuthSessionSummary({
    required this.id,
    required this.deviceName,
    required this.userAgent,
    required this.status,
    required this.assuranceLevel,
    required this.current,
    required this.lastSeenAt,
  });

  /// Decodes a session summary from the API.
  factory AuthSessionSummary.fromJson(Map<String, dynamic> json) {
    return AuthSessionSummary(
      id: _string(json, 'id'),
      deviceName: _stringOrNull(json, 'deviceName'),
      userAgent: _stringOrNull(json, 'userAgent'),
      status: _string(json, 'status'),
      assuranceLevel: AssuranceLevel.parse(_stringOrNull(json, 'assuranceLevel')),
      current: _bool(json, 'current'),
      lastSeenAt: DateTime.parse(_string(json, 'lastSeenAt')),
    );
  }

  /// Session identifier.
  final String id;

  /// Optional device name.
  final String? deviceName;

  /// Optional user agent.
  final String? userAgent;

  /// Lifecycle status.
  final String status;

  /// Assurance level attained in this session.
  final AssuranceLevel assuranceLevel;

  /// Whether this is the calling session.
  final bool current;

  /// When the session was last used.
  final DateTime lastSeenAt;
}

/// A single-use recovery code.
typedef RecoveryCode = String;

/// A field-level validation issue returned by the API.
final class FieldIssue {
  /// Creates a field issue.
  const FieldIssue({required this.path, required this.message});

  /// Decodes a field issue from the API.
  factory FieldIssue.fromJson(Map<String, dynamic> json) {
    return FieldIssue(
      path: _string(json, 'path'),
      message: _string(json, 'message'),
    );
  }

  /// Dotted path to the offending field.
  final String path;

  /// Human-readable explanation.
  final String message;
}
