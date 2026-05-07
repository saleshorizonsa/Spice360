import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthErrorMessage,
  isAuthCallbackPath,
  resolveAuthConfirmationMethod
} from "../src/lib/authRedirect.js";

test("recognizes supported auth confirmation callback routes", () => {
  assert.equal(isAuthCallbackPath("/auth/confirm"), true);
  assert.equal(isAuthCallbackPath("/auth/callback"), true);
  assert.equal(isAuthCallbackPath("/verify-email"), true);
  assert.equal(isAuthCallbackPath("/Dashboard"), false);
});

test("detects successful confirmation methods", () => {
  assert.equal(resolveAuthConfirmationMethod({ code: "abc" }).method, "exchange_code");
  assert.equal(resolveAuthConfirmationMethod({ tokenHash: "hash", type: "email" }).method, "verify_otp");
  assert.equal(resolveAuthConfirmationMethod({ accessToken: "access", refreshToken: "refresh" }).method, "set_session");
});

test("detects already verified user when link is refreshed", () => {
  const method = resolveAuthConfirmationMethod({}, { email_confirmed_at: "2026-05-07T10:00:00Z" });
  assert.equal(method.method, "already_verified");
});

test("returns friendly invalid and expired confirmation messages", () => {
  assert.equal(
    getAuthErrorMessage(new Error("Token has expired")),
    "This confirmation link has expired. Request a new confirmation email and try again."
  );
  assert.equal(
    getAuthErrorMessage(new Error("Invalid token")),
    "This confirmation link is invalid or has already been used."
  );
});

test("detects missing confirmation token", () => {
  const method = resolveAuthConfirmationMethod({});
  assert.equal(method.method, "missing_token");
  assert.match(method.message, /Missing confirmation token/);
});
