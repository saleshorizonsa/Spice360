import React, { useState } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { matrixSales } from '@/api/matrixSalesClient';
import BrandLogo from '@/components/BrandLogo';

export default function ForgotPasswordScreen({ onBack }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Email required', description: 'Enter your account email address.', variant: 'destructive' });
      return;
    }
    try {
      setIsSubmitting(true);
      await matrixSales.auth.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (error) {
      toast({ title: 'Request failed', description: error.message || 'Unable to send reset email.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-6 flex items-center justify-center">
          <BrandLogo imageClassName="h-14" />
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Mail className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Check your inbox</h2>
            <p className="text-sm leading-6 text-slate-600">
              If an account exists for <strong>{email}</strong>, we sent a password reset link. Check your inbox and spam folder.
            </p>
            <p className="text-xs text-slate-400">The link expires in 1 hour.</p>
            <Button variant="outline" className="mt-4 w-full" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Forgot password?</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                Enter your account email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-[#24466f] hover:bg-[#193658]">
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
