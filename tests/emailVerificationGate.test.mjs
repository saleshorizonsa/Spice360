import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canAccessPathForEmailVerification,
  getNextOnboardingPath,
  getResendRateLimitState,
  isEmailVerified,
  onboardingStatuses
} from "../src/lib/emailVerificationGate.js";
import { createSignupVerificationOptions } from "../src/lib/authRedirect.js";

test("signup verification options request a confirmation email callback", () => {
  global.window = { location: { origin: "https://matrixsales-peach.vercel.app" } };
  const options = createSignupVerificationOptions({
    fullName: "Admin User",
    selectedPlan: "professional"
  });

  assert.match(options.emailRedirectTo, /\/auth\/confirm$/);
  assert.equal(options.data.full_name, "Admin User");
  assert.equal(options.data.selected_plan, "professional");
});

test("signup starts tenant onboarding at email_verification_pending", () => {
  assert.equal(onboardingStatuses.EMAIL, "email_verification_pending");
  assert.equal(onboardingStatuses.COMPANY, "company_profile_pending");
  assert.equal(onboardingStatuses.ZATCA, "zatca_setup_pending");
  assert.equal(onboardingStatuses.MODULES, "modules_configuration_pending");
  assert.equal(onboardingStatuses.READY, "ready_to_use");
});

test("database migration creates pending tenant and user records on signup", () => {
  const migration = readFileSync(
    "supabase/migrations/20260508110000_fix_email_verification_onboarding_gate.sql",
    "utf8"
  );

  assert.match(migration, /after insert on auth\.users/);
  assert.match(migration, /insert into public\.organization/);
  assert.match(migration, /insert into public\."user"/);
  assert.match(migration, /'email_verified', false/);
  assert.match(migration, /'onboarding_status', 'email_verification_pending'/);
});

test("database migration marks verified users and tenants after confirmation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260508110000_fix_email_verification_onboarding_gate.sql",
    "utf8"
  );

  assert.match(migration, /after update of email_confirmed_at on auth\.users/);
  assert.match(migration, /'email_verified', true/);
  assert.match(migration, /'company_profile_pending'/);
  assert.match(migration, /matrixsales_auth_email_verified/);
});

test("unverified user cannot access company setup or dashboard", () => {
  const user = { email_verified: false };

  assert.equal(canAccessPathForEmailVerification("/email-verification-pending", user), true);
  assert.equal(canAccessPathForEmailVerification("/auth/confirm", user), true);
  assert.equal(canAccessPathForEmailVerification("/Dashboard", user), false);
  assert.equal(canAccessPathForEmailVerification("/AdminCenter", user), false);
  assert.equal(canAccessPathForEmailVerification("/company-profile", user), false);
});

test("authenticated session is not treated as verified email", () => {
  assert.equal(isEmailVerified({ id: "auth-user-id", email: "new@example.com" }), false);
  assert.equal(isEmailVerified({ id: "auth-user-id", email_confirmed_at: "2026-05-08T10:00:00Z" }), true);
});

test("verification callback moves verified user to company_profile_pending", () => {
  const user = { email_confirmed_at: "2026-05-08T10:00:00Z" };
  const organization = { onboarding_status: onboardingStatuses.COMPANY };

  assert.equal(getNextOnboardingPath(user, organization), "/company-profile");
});

test("ready verified user can access dashboard", () => {
  const user = { email_verified: true };
  const organization = { onboarding_status: onboardingStatuses.READY };

  assert.equal(getNextOnboardingPath(user, organization), "/Dashboard");
  assert.equal(canAccessPathForEmailVerification("/Dashboard", user), true);
});

test("invalid or expired callback tokens stay on the confirmation error flow", async () => {
  const { getAuthErrorMessage } = await import("../src/lib/authRedirect.js");

  assert.equal(
    getAuthErrorMessage(new Error("Token has expired")),
    "This confirmation link has expired. Request a new confirmation email and try again."
  );
  assert.equal(
    getAuthErrorMessage(new Error("Invalid token")),
    "This confirmation link is invalid or has already been used."
  );
});

test("resend verification is rate limited", () => {
  const now = Date.parse("2026-05-08T10:00:00Z");
  const recent = now - 15_000;
  const old = now - 61_000;

  assert.deepEqual(getResendRateLimitState(null, now), { allowed: true, retryAfterSeconds: 0 });
  assert.equal(getResendRateLimitState(recent, now).allowed, false);
  assert.equal(getResendRateLimitState(recent, now).retryAfterSeconds, 45);
  assert.deepEqual(getResendRateLimitState(old, now), { allowed: true, retryAfterSeconds: 0 });
});
