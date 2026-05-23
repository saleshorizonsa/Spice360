export const authCallbackPaths = new Set([
  "/auth/confirm",
  "/auth/callback",
  "/verify-email"
]);

export const isAuthCallbackPath = (path = "") => authCallbackPaths.has(path);

export const getAuthRedirectUrl = () => {
  const env = import.meta.env || {};
  const configuredUrl = env.VITE_SUPABASE_AUTH_REDIRECT_URL;
  if (configuredUrl) return configuredUrl;

  const configuredAppUrl = env.VITE_APP_URL || env.VITE_PUBLIC_APP_URL;
  const origin = configuredAppUrl || (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) return undefined;

  return `${origin.replace(/\/$/, "")}/auth/confirm`;
};

export const createSignupVerificationOptions = ({ fullName, selectedPlan } = {}) => ({
  emailRedirectTo: getAuthRedirectUrl(),
  data: {
    full_name: fullName,
    selected_plan: selectedPlan
  }
});

export const getAuthErrorMessage = (error) => {
  const message = error?.message || String(error || "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("expired")) {
    return "This confirmation link has expired. Request a new confirmation email and try again.";
  }

  if (lowerMessage.includes("invalid") || lowerMessage.includes("token")) {
    return "This confirmation link is invalid or has already been used.";
  }

  return message || "Unable to confirm this email address.";
};

export const resolveAuthConfirmationMethod = (params = {}, sessionUser = null) => {
  if (params.error) {
    return { method: "error", message: params.errorDescription || params.error };
  }

  if (params.code) return { method: "exchange_code" };
  if (params.tokenHash || params.token) return { method: "verify_otp" };
  if (params.accessToken && params.refreshToken) return { method: "set_session" };

  if (sessionUser?.email_confirmed_at || sessionUser?.confirmed_at) {
    return { method: "already_verified" };
  }

  return {
    method: "missing_token",
    message: "Missing confirmation token. Open the latest confirmation email or request a new link."
  };
};
