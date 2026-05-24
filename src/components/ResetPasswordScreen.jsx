import React, { useState } from 'react';
import { CheckCircle2, KeyRound, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { matrixSales } from '@/api/matrixSalesClient';
import BrandLogo from '@/components/BrandLogo';

const rules = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Number', test: (p) => /[0-9]/.test(p) },
];

export default function ResetPasswordScreen({ token, onSuccess }) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const allRulesPassed = rules.every((r) => r.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allRulesPassed) {
      toast({ title: 'Weak password', description: 'Password does not meet all requirements.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', description: 'Re-enter your new password in both fields.', variant: 'destructive' });
      return;
    }
    if (!token) {
      toast({ title: 'Invalid link', description: 'Reset token is missing. Request a new link.', variant: 'destructive' });
      return;
    }
    try {
      setIsSubmitting(true);
      await matrixSales.auth.resetPassword(token, password);
      setDone(true);
    } catch (error) {
      toast({ title: 'Reset failed', description: error.message || 'Link may have expired. Request a new one.', variant: 'destructive' });
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

        {done ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
            <p className="text-sm text-slate-600">Your password has been reset. You can now sign in with your new password.</p>
            <Button className="mt-4 w-full bg-[#24466f] hover:bg-[#193658]" onClick={onSuccess}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef3f9]">
                <KeyRound className="h-6 w-6 text-[#24466f]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Set new password</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  autoFocus
                />
                {password && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {rules.map((r) => (
                      <div key={r.label} className={`flex items-center gap-1.5 text-xs ${r.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {r.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !allRulesPassed || password !== confirm}
                className="h-11 w-full bg-[#24466f] hover:bg-[#193658]"
              >
                {isSubmitting ? 'Saving...' : 'Set new password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
