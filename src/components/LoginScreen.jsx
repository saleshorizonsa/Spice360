import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LogIn, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { defaultSubscriptionPlanId, getSubscriptionPlan, storeSignupPlan } from '@/lib/subscriptionPlans';

export default function LoginScreen({ onLogin, onAuthSuccess, selectedPlan = defaultSubscriptionPlanId, initialMode = 'signin', onBackToLanding, onForgotPassword }) {
  const { authProvider, authError, signInWithPassword, signUpWithPassword, resendVerificationEmail } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const plan = getSubscriptionPlan(selectedPlan);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (authProvider !== 'supabase' && authProvider !== 'phpApi') {
      onLogin();
      return;
    }

    if (!formData.email || !formData.password || (mode === 'signup' && !formData.fullName)) {
      toast({
        title: 'Missing details',
        description: 'Complete the required sign-in fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'signup') {
        const email = formData.email.trim().toLowerCase();
        await signUpWithPassword({
          email,
          password: formData.password,
          fullName: formData.fullName.trim(),
          selectedPlan,
          termsAccepted
        });
        storeSignupPlan(selectedPlan);
        setPendingConfirmationEmail(email);
        toast({
          title: 'Account created',
          description: 'Check your inbox and spam folder for the confirmation email.'
        });
        setMode('signin');
      } else {
        await signInWithPassword({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        });
        onAuthSuccess?.();
      }
    } catch (error) {
      toast({
        title: mode === 'signup' ? 'Sign up failed' : 'Sign in failed',
        description: error.message || 'Unable to authenticate.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    const email = (pendingConfirmationEmail || formData.email).trim().toLowerCase();
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Enter the email address used during signup.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsResending(true);
      await resendVerificationEmail(email);
      setPendingConfirmationEmail(email);
      toast({
        title: 'Confirmation email sent',
        description: 'Use the latest email from HORIZON. Check spam or junk if it is not in your inbox.'
      });
    } catch (error) {
      toast({
        title: 'Unable to resend confirmation',
        description: error.message || 'Check Supabase email settings and try again.',
        variant: 'destructive'
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-slate-200/80 lg:grid-cols-[1.08fr_440px]">
          <div className="relative flex min-h-[680px] flex-col justify-between bg-[#15243b] p-8 text-white lg:p-12">
            <div className="absolute inset-0 opacity-95">
              <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(214,143,43,0.34),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(72,111,168,0.4),transparent_26%),linear-gradient(135deg,#15243b_0%,#243d62_48%,#6d4522_100%)]" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex rounded-2xl bg-white px-5 py-4 shadow-xl shadow-slate-950/20">
                <BrandLogo imageClassName="h-20" />
              </div>
            </div>

            <div className="relative z-10 max-w-2xl space-y-7">
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
                Enterprise operations platform
              </div>
              <h1 className="text-5xl font-bold leading-tight tracking-normal md:text-6xl">
                HORIZON
              </h1>
              <p className="max-w-xl text-xl leading-9 text-white/82">
                Powering sales, finance, inventory, production, HR, approvals, and reporting from one secure workspace.
              </p>
              <div className="grid gap-3 text-sm text-white/85 sm:grid-cols-3">
                {['Operational control', 'Financial clarity', 'Secure access'].map(item => (
                  <div key={item} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur">
                    <CheckCircle2 className="h-4 w-4 text-[#d68f2b]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 text-sm text-white/65">
              Built for focused business execution.
            </div>
          </div>

          <div className="flex flex-col justify-center bg-white p-7 lg:p-9">
            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="mb-6 flex w-fit items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-[#24466f]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </button>
            )}
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef3f9]">
                <ShieldCheck className="h-6 w-6 text-[#24466f]" />
              </div>
              <h2 className="text-2xl font-bold tracking-normal text-slate-950">User Login</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {mode === 'signup' ? `Create your account on the ${plan?.name || 'selected'} plan.` : 'Enter your User ID and password to access HORIZON.'}
              </p>
            </div>

            {authProvider === 'supabase' || authProvider === 'phpApi' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {pendingConfirmationEmail && mode === 'signin' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">Confirm your email to continue</p>
                    <p className="mt-1 leading-5">
                      We sent a confirmation link to <strong>{pendingConfirmationEmail}</strong>. Check inbox, spam, or junk.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 border-amber-300 bg-white"
                      onClick={handleResendConfirmation}
                      disabled={isResending}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {isResending ? 'Sending...' : 'Resend confirmation email'}
                    </Button>
                  </div>
                )}

                {mode === 'signup' && (
                  <>
                    <div className="rounded-lg border border-[#dbe6f3] bg-[#f8fafc] p-3 text-sm text-slate-700">
                      Selected plan: <strong>{plan?.name}</strong>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input
                        id="full-name"
                        value={formData.fullName}
                        onChange={(event) => handleChange('fullName', event.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="flex items-start gap-2.5">
                      <input
                        id="tos"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#24466f]"
                      />
                      <label htmlFor="tos" className="cursor-pointer text-xs leading-5 text-slate-600">
                        I agree to the{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#24466f] underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#24466f] underline">Privacy Policy</a>
                      </label>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">User ID</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleChange('email', event.target.value)}
                    placeholder="user@company.com"
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(event) => handleChange('password', event.target.value)}
                    placeholder="Password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  {mode === 'signin' && onForgotPassword && (
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="mt-1 text-xs text-[#24466f] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting || (mode === 'signup' && !termsAccepted)} className="h-11 w-full bg-[#24466f] hover:bg-[#193658]">
                  {mode === 'signup' ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
                  {isSubmitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                  {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                >
                  {mode === 'signup' ? 'Use an existing account' : 'Create a new account'}
                </Button>
                {mode === 'signin' && !pendingConfirmationEmail && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-[#24466f]"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {isResending ? 'Sending confirmation...' : "Didn't receive confirmation email?"}
                  </Button>
                )}
              </form>
            ) : (
              <Button onClick={onLogin} className="h-11 w-full bg-[#24466f] hover:bg-[#193658]">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              Contact your administrator if your account has not been invited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
