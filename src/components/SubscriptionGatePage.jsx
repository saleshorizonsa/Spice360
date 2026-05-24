import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/lib/AuthContext';
import { formatPlanPrice, subscriptionPlans } from '@/lib/subscriptionPlans';

const CONTACT_EMAIL = 'support@horizon-sa.net';

const statusMessages = {
  expired: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    bg: 'bg-amber-50 border-amber-200',
    title: 'Your trial has ended',
    description: 'Your free trial period has expired. Upgrade to a paid plan to continue using HORIZON.',
  },
  cancelled: {
    icon: AlertTriangle,
    iconClass: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    title: 'Subscription cancelled',
    description: 'Your subscription has been cancelled. Contact us to reactivate your account.',
  },
  past_due: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    bg: 'bg-amber-50 border-amber-200',
    title: 'Payment overdue',
    description: 'Your account is past due. Please contact us to settle your balance and restore access.',
  },
  suspended: {
    icon: AlertTriangle,
    iconClass: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    title: 'Account suspended',
    description: 'Your account has been suspended. Contact support to resolve this.',
  },
};

export default function SubscriptionGatePage({ subscriptionStatus = 'expired' }) {
  const { user, logout } = useAuth();
  const msg = statusMessages[subscriptionStatus] || statusMessages.expired;
  const Icon = msg.icon;

  const plans = subscriptionPlans.filter((p) => p.id !== 'enterprise');

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <BrandLogo imageClassName="h-11" />
          <Button variant="ghost" size="sm" className="gap-2 text-slate-500" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className={`mb-10 rounded-2xl border p-6 ${msg.bg}`}>
          <div className="flex items-start gap-4">
            <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${msg.iconClass}`} />
            <div>
              <h1 className="text-xl font-bold text-slate-900">{msg.title}</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">{msg.description}</p>
              {user?.email && (
                <p className="mt-2 text-xs text-slate-500">Signed in as <strong>{user.email}</strong></p>
              )}
            </div>
          </div>
        </div>

        {(subscriptionStatus === 'expired' || subscriptionStatus === 'past_due') && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Choose a plan to continue</h2>
              <p className="mt-1 text-sm text-slate-600">All plans include a 14-day free trial. Contact us to activate.</p>
            </div>

            <div className="mb-10 grid gap-5 md:grid-cols-2">
              {plans.map((plan) => (
                <Card key={plan.id} className={plan.id === 'professional' ? 'border-[#24466f] shadow-lg' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {plan.name}
                      {plan.id === 'professional' && (
                        <span className="rounded-full bg-[#eef3f9] px-3 py-1 text-xs text-[#24466f]">Most popular</span>
                      )}
                    </CardTitle>
                    <p className="text-3xl font-bold text-slate-900">{formatPlanPrice(plan)}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5 text-sm text-slate-600">
                      <p><strong>Users:</strong> {plan.userLimit}</p>
                      <p><strong>Invoices/mo:</strong> {plan.invoiceLimit}</p>
                      <p><strong>Support:</strong> {plan.supportLevel}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.modules.map((m) => (
                        <span key={m} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{m}</span>
                      ))}
                    </div>
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=Upgrade to ${plan.name} — ${user?.email || ''}`}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#24466f] py-2.5 text-sm font-medium text-white hover:bg-[#193658]"
                    >
                      <Mail className="h-4 w-4" />
                      Contact to activate {plan.name}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#24466f]" />
            <div>
              <p className="font-semibold text-slate-900">Need help or have questions?</p>
              <p className="mt-0.5 text-sm text-slate-600">
                Email us at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#24466f] underline">{CONTACT_EMAIL}</a>
                {' '}and we'll get you set up within 24 hours.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
