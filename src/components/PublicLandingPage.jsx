import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, CheckCircle2, FileCheck, MessageCircle, Receipt, Repeat2, ShoppingCart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BrandLogo from "@/components/BrandLogo";
import { matrixSales } from "@/api/matrixSalesClient";
import { formatPlanPrice, normalizeSubscriptionPlans } from "@/lib/subscriptionPlans";

const benefits = [
  "Create recurring invoices from IT service contracts without inventory or warehouse complexity.",
  "Send ZATCA-ready bilingual invoice PDFs and reminders through email and WhatsApp workflows.",
  "Track MRR, ARR, active contracts, renewals, overdue invoices, VAT, and customer growth in one tenant-safe workspace."
];

const modules = [
  { title: "Recurring Billing", icon: Repeat2, description: "Monthly, annual, and contract-linked invoices for AMC, SLA, cloud, Microsoft 365, consulting, and support retainers." },
  { title: "Service Contracts", icon: ShoppingCart, description: "Manage contract periods, renewal alerts, SLA details, service lines, auto-renewal, and pause/resume billing." },
  { title: "ZATCA Compliance", icon: FileCheck, description: "Standard and simplified tax invoice workflows with QR code, VAT validation, Arabic support, and Phase 2 readiness." },
  { title: "WhatsApp Workflows", icon: MessageCircle, description: "Share invoices, quotations, payment reminders, and renewal messages with bilingual templates." },
  { title: "Customer Portal", icon: Users, description: "Let customers view invoices, approve quotes, download PDFs, open tickets, and review payment history." },
  { title: "Service KPIs", icon: BarChart3, description: "Track MRR, ARR, active contracts, renewal pipeline, overdue invoices, VAT collected, and revenue by service type." }
];

const faqs = [
  ["Is HORIZON multi-tenant?", "Yes. Each company is treated as a separate tenant and business data is scoped by tenant."],
  ["Can we start with a trial?", "Yes. Plans include trial days and the selected plan is carried into signup and onboarding."],
  ["Does it support ZATCA?", "The app includes ZATCA setup fields, QR readiness, validation, bilingual invoice templates, and submission log workflows."],
  ["Can pricing change later?", "Yes. Pricing is database-backed and owner changes are reflected on the public landing page."]
];

export default function PublicLandingPage({ onLogin, onSelectPlan }) {
  const { data: dbPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["public-subscription-plans"],
    queryFn: async () => {
      try {
        return await matrixSales.entities.SubscriptionPlan.list("display_order");
      } catch (error) {
        console.warn("Using fallback subscription plans:", error);
        return [];
      }
    },
    initialData: []
  });
  const plans = normalizeSubscriptionPlans(dbPlans);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <BrandLogo imageClassName="h-11" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onLogin}>Login</Button>
            <Button onClick={() => onSelectPlan(plans[1]?.id || "professional")} className="bg-[#24466f] hover:bg-[#193658]">
              Start Free Trial
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#15243b] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(214,143,43,0.28),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(72,111,168,0.42),transparent_30%),linear-gradient(135deg,#15243b_0%,#243d62_52%,#6d4522_100%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
            <div className="space-y-7">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                ZATCA recurring billing for Saudi IT service companies
              </div>
              <h1 className="max-w-4xl text-5xl font-bold leading-tight md:text-6xl">
                HORIZON
              </h1>
              <p className="max-w-2xl text-xl leading-9 text-white/82">
                The easiest ZATCA-compliant recurring billing platform for managed IT services, AMC/SLA contracts, cloud services, subscriptions, and support retainers.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => onSelectPlan(plans[1]?.id || "professional")} className="h-12 bg-[#d68f2b] px-6 text-slate-950 hover:bg-[#efaa42]">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={onLogin} className="h-12 border-white/30 bg-white/10 px-6 text-white hover:bg-white/20">
                  Login
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
              <div className="grid gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex gap-3 rounded-xl bg-white/10 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#d68f2b]" />
                    <p className="text-sm leading-6 text-white/88">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase text-[#24466f]">Product benefits</p>
            <h2 className="mt-2 text-3xl font-bold">Built for recurring service revenue</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit}>
                <CardContent className="p-5">
                  <Receipt className="mb-3 h-5 w-5 text-[#24466f]" />
                  <p className="text-sm leading-6 text-slate-600">{benefit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-5">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase text-[#24466f]">Modules</p>
              <h2 className="mt-2 text-3xl font-bold">Core features</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Card key={module.title}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5 text-[#24466f]" />
                        {module.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 text-slate-600">{module.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase text-[#24466f]">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold">Choose a subscription plan</h2>
            {plansLoading && <p className="mt-2 text-sm text-slate-500">Loading latest pricing...</p>}
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.id === "professional" ? "border-[#24466f] shadow-lg" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {plan.id === "professional" && <span className="rounded-full bg-[#eef3f9] px-3 py-1 text-xs text-[#24466f]">Popular</span>}
                  </CardTitle>
                  <p className="text-3xl font-bold">{formatPlanPrice(plan)}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-slate-600">
                    <p><strong>Users:</strong> {plan.userLimit}</p>
                    <p><strong>Invoices:</strong> {plan.invoiceLimit}</p>
                    <p><strong>Support:</strong> {plan.supportLevel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plan.modules.map((module) => (
                      <span key={module} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{module}</span>
                    ))}
                  </div>
                  <Button onClick={() => onSelectPlan(plan.id)} className="w-full bg-[#24466f] hover:bg-[#193658]">
                    Choose Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-5xl px-5">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase text-[#24466f]">FAQ</p>
              <h2 className="mt-2 text-3xl font-bold">Questions before signup</h2>
            </div>
            <div className="grid gap-4">
              {faqs.map(([question, answer]) => (
                <Card key={question}>
                  <CardContent className="flex gap-3 p-5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#24466f]" />
                    <div>
                      <p className="font-semibold">{question}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{answer}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
