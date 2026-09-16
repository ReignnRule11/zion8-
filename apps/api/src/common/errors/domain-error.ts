import { ErrorCode, type FieldIssue } from '@zion8/contracts';

const DEFAULT_STATUS: Partial<Record<ErrorCode, number>> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_REVOKED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TENANT_REQUIRED]: 400,
  [ErrorCode.TENANT_NOT_FOUND]: 404,
  [ErrorCode.TENANT_SUSPENDED]: 403,
  [ErrorCode.TENANT_SLUG_TAKEN]: 409,
  [ErrorCode.TENANT_MEMBERSHIP_REQUIRED]: 403,
  [ErrorCode.EMAIL_ALREADY_REGISTERED]: 409,
  [ErrorCode.IDENTITY_ALREADY_LINKED]: 409,
  [ErrorCode.INVALID_CHALLENGE]: 400,
  [ErrorCode.CHALLENGE_EXPIRED]: 400,
  [ErrorCode.CHALLENGE_CONSUMED]: 400,
  [ErrorCode.MFA_REQUIRED]: 401,
  [ErrorCode.MFA_INVALID_CODE]: 401,
  [ErrorCode.MFA_FACTOR_NOT_FOUND]: 404,
  [ErrorCode.WEBAUTHN_FAILED]: 400,
  [ErrorCode.OAUTH_FAILED]: 400,
  [ErrorCode.OAUTH_PROVIDER_UNAVAILABLE]: 503,
  [ErrorCode.CONTACT_NOT_VERIFIED]: 403,
  [ErrorCode.ONBOARDING_STATUS]: 409,
  [ErrorCode.ONBOARDING_STEP_OUT_OF_ORDER]: 409,
  [ErrorCode.ONBOARDING_INCOMPLETE]: 409,
  [ErrorCode.ONBOARDING_ALREADY_COMPLETED]: 409,
  [ErrorCode.INVITATION_NOT_FOUND]: 404,
  [ErrorCode.INVITATION_EXPIRED]: 410,
  [ErrorCode.INVITATION_ALREADY_ACCEPTED]: 409,
  [ErrorCode.INVITATION_ALREADY_EXISTS]: 409,
  [ErrorCode.SUBSCRIPTION_PLAN_UNAVAILABLE]: 400,
  [ErrorCode.MEMBER_IMPORT_INVALID]: 400,
  [ErrorCode.MEMBER_IMPORT_NOT_READY]: 409,
  // Membership. A missing record is 404, a uniqueness or state conflict is 409,
  // and a payload the server cannot store is reported with the matching HTTP
  // semantic so clients can react without parsing the message.
  [ErrorCode.MEMBER_NOT_FOUND]: 404,
  [ErrorCode.MEMBER_ALREADY_ARCHIVED]: 409,
  [ErrorCode.MEMBER_EMAIL_TAKEN]: 409,
  [ErrorCode.MEMBER_ACCOUNT_LINKED]: 409,
  [ErrorCode.FAMILY_NOT_FOUND]: 404,
  [ErrorCode.FAMILY_MEMBER_EXISTS]: 409,
  [ErrorCode.FAMILY_MEMBER_NOT_FOUND]: 404,
  [ErrorCode.RELATIONSHIP_NOT_FOUND]: 404,
  [ErrorCode.RELATIONSHIP_EXISTS]: 409,
  [ErrorCode.RELATIONSHIP_SELF_REFERENCE]: 400,
  [ErrorCode.VISITOR_NOT_FOUND]: 404,
  [ErrorCode.VISITOR_ALREADY_CONVERTED]: 409,
  [ErrorCode.ATTENDANCE_SESSION_NOT_FOUND]: 404,
  [ErrorCode.ATTENDANCE_SESSION_CLOSED]: 409,
  [ErrorCode.ATTENDANCE_ATTENDEE_REQUIRED]: 400,
  [ErrorCode.ATTENDANCE_RECORD_EXISTS]: 409,
  [ErrorCode.DEPARTMENT_NOT_FOUND]: 404,
  [ErrorCode.DEPARTMENT_NAME_TAKEN]: 409,
  [ErrorCode.DEPARTMENT_MEMBER_EXISTS]: 409,
  [ErrorCode.DEPARTMENT_MEMBER_NOT_FOUND]: 404,
  [ErrorCode.VOLUNTEER_ROLE_NOT_FOUND]: 404,
  [ErrorCode.VOLUNTEER_ASSIGNMENT_EXISTS]: 409,
  [ErrorCode.VOLUNTEER_ASSIGNMENT_NOT_FOUND]: 404,
  [ErrorCode.DOCUMENT_NOT_FOUND]: 404,
  [ErrorCode.DOCUMENT_TOO_LARGE]: 413,
  [ErrorCode.DOCUMENT_TYPE_UNSUPPORTED]: 415,
  [ErrorCode.DOCUMENT_UNAVAILABLE]: 503,
  [ErrorCode.SUMMARY_NOT_FOUND]: 404,
  [ErrorCode.SUMMARY_GENERATION_FAILED]: 502,
  [ErrorCode.GRAPH_LIMIT_EXCEEDED]: 400,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: FieldIssue[];

  constructor(code: ErrorCode, message: string, details?: FieldIssue[], httpStatus?: number) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus ?? DEFAULT_STATUS[code] ?? 500;
  }

  static validation(details: FieldIssue[], message = 'Request validation failed'): DomainError {
    return new DomainError(ErrorCode.VALIDATION_FAILED, message, details);
  }

  static unauthenticated(message = 'Authentication is required'): DomainError {
    return new DomainError(ErrorCode.UNAUTHENTICATED, message);
  }

  static invalidCredentials(message = 'Invalid email or password'): DomainError {
    return new DomainError(ErrorCode.INVALID_CREDENTIALS, message);
  }

  static tokenExpired(message = 'Session has expired'): DomainError {
    return new DomainError(ErrorCode.TOKEN_EXPIRED, message);
  }

  static tokenRevoked(message = 'Session has been revoked'): DomainError {
    return new DomainError(ErrorCode.TOKEN_REVOKED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): DomainError {
    return new DomainError(ErrorCode.FORBIDDEN, message);
  }

  static tenantRequired(message = 'A tenant context is required'): DomainError {
    return new DomainError(ErrorCode.TENANT_REQUIRED, message);
  }

  static tenantNotFound(message = 'Church workspace not found'): DomainError {
    return new DomainError(ErrorCode.TENANT_NOT_FOUND, message);
  }

  static tenantSuspended(message = 'Church workspace is suspended'): DomainError {
    return new DomainError(ErrorCode.TENANT_SUSPENDED, message);
  }

  static tenantSlugTaken(message = 'That workspace address is already in use'): DomainError {
    return new DomainError(ErrorCode.TENANT_SLUG_TAKEN, message);
  }

  static membershipRequired(
    message = 'You are not a member of this church workspace',
  ): DomainError {
    return new DomainError(ErrorCode.TENANT_MEMBERSHIP_REQUIRED, message);
  }

  static emailRegistered(message = 'An account with this email already exists'): DomainError {
    return new DomainError(ErrorCode.EMAIL_ALREADY_REGISTERED, message);
  }

  static identityLinked(message = 'This account is already linked to another user'): DomainError {
    return new DomainError(ErrorCode.IDENTITY_ALREADY_LINKED, message);
  }

  static invalidChallenge(message = 'This link or code is not valid'): DomainError {
    return new DomainError(ErrorCode.INVALID_CHALLENGE, message);
  }

  static challengeExpired(message = 'This link or code has expired'): DomainError {
    return new DomainError(ErrorCode.CHALLENGE_EXPIRED, message);
  }

  static challengeConsumed(message = 'This link or code has already been used'): DomainError {
    return new DomainError(ErrorCode.CHALLENGE_CONSUMED, message);
  }

  static mfaRequired(message = 'Multi-factor authentication is required'): DomainError {
    return new DomainError(ErrorCode.MFA_REQUIRED, message);
  }

  static mfaInvalidCode(message = 'That verification code is not valid'): DomainError {
    return new DomainError(ErrorCode.MFA_INVALID_CODE, message);
  }

  static mfaFactorNotFound(message = 'That authentication method was not found'): DomainError {
    return new DomainError(ErrorCode.MFA_FACTOR_NOT_FOUND, message);
  }

  static webauthnFailed(message = 'Passkey verification failed'): DomainError {
    return new DomainError(ErrorCode.WEBAUTHN_FAILED, message);
  }

  static oauthFailed(message = 'Sign-in with the provider failed'): DomainError {
    return new DomainError(ErrorCode.OAUTH_FAILED, message);
  }

  static oauthProviderUnavailable(message = 'This sign-in provider is not available'): DomainError {
    return new DomainError(ErrorCode.OAUTH_PROVIDER_UNAVAILABLE, message);
  }

  static contactNotVerified(message = 'Please verify your contact details first'): DomainError {
    return new DomainError(ErrorCode.CONTACT_NOT_VERIFIED, message);
  }

  static onboardingStepOutOfOrder(
    missingSteps: readonly string[],
    message = 'Complete the earlier onboarding steps first',
  ): DomainError {
    return new DomainError(ErrorCode.ONBOARDING_STEP_OUT_OF_ORDER, message, [
      {
        path: 'step',
        code: ErrorCode.ONBOARDING_STEP_OUT_OF_ORDER,
        message: `Required steps are incomplete: ${missingSteps.join(', ')}`,
      },
    ]);
  }

  static onboardingIncomplete(
    missingSteps: readonly string[],
    message = 'The workspace cannot be finalized until the required steps are complete',
  ): DomainError {
    return new DomainError(ErrorCode.ONBOARDING_INCOMPLETE, message, [
      {
        path: 'step',
        code: ErrorCode.ONBOARDING_INCOMPLETE,
        message: `Required steps are incomplete: ${missingSteps.join(', ')}`,
      },
    ]);
  }

  static onboardingAlreadyCompleted(
    message = 'Onboarding is already complete',
  ): DomainError {
    return new DomainError(ErrorCode.ONBOARDING_ALREADY_COMPLETED, message);
  }

  static invitationNotFound(message = 'This invitation could not be found'): DomainError {
    return new DomainError(ErrorCode.INVITATION_NOT_FOUND, message);
  }

  static invitationExpired(message = 'This invitation has expired'): DomainError {
    return new DomainError(ErrorCode.INVITATION_EXPIRED, message);
  }

  static invitationAlreadyAccepted(
    message = 'This invitation has already been accepted',
  ): DomainError {
    return new DomainError(ErrorCode.INVITATION_ALREADY_ACCEPTED, message);
  }

  static invitationAlreadyExists(message = 'That person has already been invited'): DomainError {
    return new DomainError(ErrorCode.INVITATION_ALREADY_EXISTS, message);
  }

  static subscriptionPlanUnavailable(message = 'That subscription plan is not available'): DomainError {
    return new DomainError(ErrorCode.SUBSCRIPTION_PLAN_UNAVAILABLE, message);
  }

  static memberImportInvalid(
    message = 'The import file could not be read',
    details?: FieldIssue[],
  ): DomainError {
    return new DomainError(ErrorCode.MEMBER_IMPORT_INVALID, message, details);
  }

  static memberImportNotReady(message = 'The import is not ready to be applied'): DomainError {
    return new DomainError(ErrorCode.MEMBER_IMPORT_NOT_READY, message);
  }

  static notFound(message = 'Resource not found'): DomainError {
    return new DomainError(ErrorCode.RESOURCE_NOT_FOUND, message);
  }

  static conflict(message = 'Resource conflict'): DomainError {
    return new DomainError(ErrorCode.RESOURCE_CONFLICT, message);
  }

  static rateLimited(message = 'Too many requests'): DomainError {
    return new DomainError(ErrorCode.RATE_LIMITED, message);
  }

  static internal(message = 'An unexpected error occurred'): DomainError {
    return new DomainError(ErrorCode.INTERNAL_ERROR, message);
  }

  static unavailable(message = 'Service temporarily unavailable'): DomainError {
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
