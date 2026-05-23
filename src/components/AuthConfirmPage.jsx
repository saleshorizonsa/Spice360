import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/lib/supabaseClient";
import { matrixSales } from "@/api/matrixSalesClient";

const usePhpApi = !!import.meta.env.VITE_API_URL;
import { useAuth } from "@/lib/AuthContext";
import { getAuthErrorMessage, resolveAuthConfirmationMethod } from "@/lib/authRedirect";

const parseAuthParams = () => {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  return {
    code: url.searchParams.get("code") || hashParams.get("code"),
    tokenHash: url.searchParams.get("token_hash") || hashParams.get("token_hash"),
    token: url.searchParams.get("token") || hashParams.get("token"),
    type: url.searchParams.get("type") || hashParams.get("type") || "email",
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    error: url.searchParams.get("error") || hashParams.get("error"),
    errorDescription: url.searchParams.get("error_description") || hashParams.get("error_description")
  };
};

const normalizeOtpType = (type) => {
  const allowedTypes = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
  return allowedTypes.has(type) ? type : "email";
};

export default function AuthConfirmPage({ onConfirmed, onBackToLogin }) {
  const { checkAppState, resendVerificationEmail, logout, user } = useAuth();
  const [status, setStatus] = useState("confirming");
  const [message, setMessage] = useState("Confirming your email address...");
  const [email, setEmail] = useState(user?.email || "");
  const [isResending, setIsResending] = useState(false);
  const params = useMemo(parseAuthParams, []);
  const hasStartedConfirmation = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const confirmEmail = async () => {
      if (hasStartedConfirmation.current) return;
      hasStartedConfirmation.current = true;

      if (usePhpApi) {
        const token = params.token || new URLSearchParams(window.location.search).get('token');
        if (!token) {
          setStatus("error");
          setMessage("Confirmation token is missing from the link. Request a new one.");
          return;
        }
        try {
          await matrixSales.auth.confirmEmail(token);
          if (!isMounted) return;
          setStatus("success");
          setMessage("Email confirmed. Opening your app...");
          window.history.replaceState({}, document.title, "/auth/confirm");
          await checkAppState();
          setTimeout(() => { onConfirmed?.(); }, 900);
        } catch (error) {
          if (!isMounted) return;
          setStatus("error");
          setMessage(error.message || "Confirmation failed. Request a new link.");
          window.history.replaceState({}, document.title, "/auth/confirm");
        }
        return;
      }

      if (!supabase) {
        setStatus("error");
        setMessage("Supabase is not configured for this deployment.");
        return;
      }

      try {
        let method = resolveAuthConfirmationMethod(params);
        if (method.method === "missing_token") {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          method = resolveAuthConfirmationMethod(params, data.session?.user);
        }
        if (method.method === "error" || method.method === "missing_token") throw new Error(method.message);

        if (method.method === "exchange_code") {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
        } else if (method.method === "verify_otp") {
          const payload = params.tokenHash
            ? { type: normalizeOtpType(params.type), token_hash: params.tokenHash }
            : { type: normalizeOtpType(params.type), token: params.token };
          const { error } = await supabase.auth.verifyOtp(payload);
          if (error) throw error;
        } else if (method.method === "set_session") {
          const { error } = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken
          });
          if (error) throw error;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!userData.user?.email_confirmed_at && !userData.user?.confirmed_at) {
          throw new Error("Email confirmation was not completed. Request a new confirmation email and try again.");
        }

        if (!isMounted) return;
        setStatus("success");
        setMessage("Email confirmed. Opening your onboarding flow...");
        window.history.replaceState({}, document.title, "/auth/confirm");
        await checkAppState();
        setTimeout(() => {
          onConfirmed?.();
        }, 900);
      } catch (error) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(getAuthErrorMessage(error));
        window.history.replaceState({}, document.title, "/auth/confirm");
      }
    };

    confirmEmail();

    return () => {
      isMounted = false;
    };
  }, [checkAppState, onConfirmed, params]);

  const resend = async () => {
    if (!email) {
      setMessage("Enter your email address to resend the confirmation link.");
      return;
    }

    try {
      setIsResending(true);
      await resendVerificationEmail(email.trim().toLowerCase());
      setMessage("A new confirmation link has been sent. Use the latest email from HORIZON.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  const isSuccess = status === "success";

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <Card className="w-full border-slate-200 shadow-xl shadow-slate-200/70">
          <CardHeader className="space-y-5 text-center">
            <div className="mx-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <BrandLogo imageClassName="h-14" />
            </div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3f9]">
              {isSuccess ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              ) : status === "confirming" ? (
                <RefreshCw className="h-7 w-7 animate-spin text-[#24466f]" />
              ) : (
                <ShieldAlert className="h-7 w-7 text-red-600" />
              )}
            </div>
            <CardTitle>{isSuccess ? "Email Confirmed" : status === "confirming" ? "Confirming Email" : "Confirmation Link Problem"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-center">
            <p className="text-sm leading-6 text-slate-600">{message}</p>

            {status === "error" && (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="confirm-email">Email address</Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="user@company.com"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button type="button" onClick={resend} disabled={isResending} className="bg-[#24466f] hover:bg-[#193658]">
                    <Mail className="mr-2 h-4 w-4" />
                    {isResending ? "Sending..." : "Resend"}
                  </Button>
                  <Button type="button" variant="outline" onClick={async () => {
                    await logout(false);
                    onBackToLogin?.();
                  }}>
                    Back to Login
                  </Button>
                  <Button type="button" variant="ghost" asChild>
                    <a href="mailto:support@saleshorizonsa.com">
                      Contact Support
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {isSuccess && (
              <Button onClick={onConfirmed} className="bg-[#24466f] hover:bg-[#193658]">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
