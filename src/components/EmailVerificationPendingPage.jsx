import React, { useMemo, useState } from "react";
import { LogOut, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/lib/AuthContext";
import { getResendRateLimitState } from "@/lib/emailVerificationGate";

const resendStorageKey = (email) => `horizon:last_verification_resend:${email || "unknown"}`;

export default function EmailVerificationPendingPage({ email: initialEmail, onBackToLogin }) {
  const { user, resendVerificationEmail, logout, checkAppState } = useAuth();
  const { toast } = useToast();
  const queryEmail = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("email") || "";
  }, []);
  const [email, setEmail] = useState(initialEmail || user?.email || queryEmail || "");
  const [isSending, setIsSending] = useState(false);

  const resend = async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      toast({ title: "Email required", description: "Enter the email address used during signup.", variant: "destructive" });
      return;
    }

    const key = resendStorageKey(targetEmail);
    const rateLimit = getResendRateLimitState(localStorage.getItem(key));
    if (!rateLimit.allowed) {
      toast({
        title: "Please wait",
        description: `You can request another verification email in ${rateLimit.retryAfterSeconds} seconds.`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSending(true);
      await resendVerificationEmail(targetEmail);
      localStorage.setItem(key, String(Date.now()));
      toast({ title: "Verification email sent", description: "Open the latest HORIZON verification link from your inbox." });
    } catch (error) {
      toast({ title: "Unable to send verification", description: error.message || "Check SMTP/auth settings and try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const signOut = async () => {
    await logout(false);
    onBackToLogin?.();
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <Card className="w-full border-slate-200 shadow-xl shadow-slate-200/70">
          <CardHeader className="space-y-5 text-center">
            <div className="mx-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <BrandLogo imageClassName="h-14" />
            </div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3f9]">
              <Mail className="h-7 w-7 text-[#24466f]" />
            </div>
            <CardTitle>Email Verification Pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-center text-sm leading-6 text-slate-600">
              We sent a verification link to your email address. You cannot continue to company setup,
              ZATCA setup, modules, reports, settings, or the dashboard until that email is confirmed.
            </p>

            <div className="space-y-2">
              <Label htmlFor="pending-email">Email address</Label>
              <Input
                id="pending-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@company.com"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" onClick={resend} disabled={isSending} className="bg-[#24466f] hover:bg-[#193658]">
                <RefreshCw className={`mr-2 h-4 w-4 ${isSending ? "animate-spin" : ""}`} />
                {isSending ? "Sending..." : "Resend Email"}
              </Button>
              <Button type="button" variant="outline" onClick={checkAppState}>
                Refresh Status
              </Button>
              <Button type="button" variant="ghost" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
