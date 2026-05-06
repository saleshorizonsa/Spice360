import React, { useState } from 'react';
import { BarChart3, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function LoginScreen({ onLogin }) {
  const { authProvider, authError, signInWithPassword, signUpWithPassword } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState('signin');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (authProvider !== 'supabase') {
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
        await signUpWithPassword({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          fullName: formData.fullName.trim()
        });
        toast({
          title: 'Account created',
          description: 'Check your email if confirmation is required, then sign in.'
        });
        setMode('signin');
      } else {
        await signInWithPassword({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        });
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-600 p-2.5">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-950">MatrixSales</h1>
                <p className="text-sm text-slate-600">Enterprise operations workspace</p>
              </div>
            </div>

            <div className="max-w-2xl space-y-4">
              <h2 className="text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">
                Sign in to manage your business operations
              </h2>
              <p className="text-lg leading-8 text-slate-600">
                Access sales, finance, inventory, production, HR, approvals, and reporting from one secure workspace.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Secure Login</h3>
                <p className="text-sm text-slate-600">Use your authorized MatrixSales account.</p>
              </div>
            </div>

            {authProvider === 'supabase' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {authError?.type === 'missing_supabase_config' && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Supabase is not configured for this deployment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input
                      id="full-name"
                      value={formData.fullName}
                      onChange={(event) => handleChange('fullName', event.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleChange('email', event.target.value)}
                    placeholder="you@company.com"
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
                </div>

                <Button type="submit" disabled={isSubmitting || authError?.type === 'missing_supabase_config'} className="h-11 w-full bg-emerald-600 hover:bg-emerald-700">
                  {mode === 'signup' ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
                  {isSubmitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                >
                  {mode === 'signup' ? 'Use an existing account' : 'Create a new account'}
                </Button>
              </form>
            ) : (
              <Button onClick={onLogin} className="h-11 w-full bg-emerald-600 hover:bg-emerald-700">
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
