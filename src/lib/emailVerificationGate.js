export const onboardingStatuses = {
  EMAIL: "email_verification_pending",
  COMPANY: "company_profile_pending",
  ZATCA: "zatca_setup_pending",
  MODULES: "modules_configuration_pending",
  READY: "ready_to_use"
};

export const emailVerificationAllowedPaths = new Set([
  "/",
  "/auth/confirm",
  "/auth/callback",
  "/verify-email",
  "/email-verification-pending"
]);

export const isEmailVerified = (user = {}) =>
  Boolean(user?.email_verified || user?.email_confirmed_at || user?.confirmed_at);

export const getNextOnboardingPath = (user, organization = null) => {
  if (!isEmailVerified(user)) return "/email-verification-pending";

  const status = organization?.onboarding_status;
  if (!organization || status === onboardingStatuses.COMPANY) return "/company-profile";
  if (status === onboardingStatuses.ZATCA) return "/zatca-setup";
  if (status === onboardingStatuses.MODULES) return "/modules-configuration";
  return "/Dashboard";
};

export const canAccessPathForEmailVerification = (path, user = {}) => {
  if (isEmailVerified(user)) return true;
  return emailVerificationAllowedPaths.has(path);
};

export const getResendRateLimitState = (lastSentAt, now = Date.now(), windowMs = 60_000) => {
  if (!lastSentAt) return { allowed: true, retryAfterSeconds: 0 };

  const elapsed = now - Number(lastSentAt);
  if (elapsed >= windowMs) return { allowed: true, retryAfterSeconds: 0 };

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((windowMs - elapsed) / 1000)
  };
};
