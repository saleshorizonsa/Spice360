import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Receipt, Calendar, ArrowUpRight, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { matrixSales } from "@/api/matrixSalesClient";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/utils/languageContext";
import { normalizeSubscriptionPlan } from "@/lib/subscriptionPlans";

function UsageBar({ label, used, limit, icon: Icon, colorClass }) {
  const pct = limit && limit < 999999 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const isUnlimited = !limit || limit >= 999999;
  const warn = pct !== null && pct >= 80;
  const danger = pct !== null && pct >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          {label}
        </span>
        <span className={`font-semibold ${danger ? "text-red-600" : warn ? "text-amber-600" : "text-slate-700"}`}>
          {isUnlimited ? (
            <span className="text-emerald-600">{used.toLocaleString()} / ∞</span>
          ) : (
            `${used.toLocaleString()} / ${Number(limit).toLocaleString()}`
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${danger ? "bg-red-500" : warn ? "bg-amber-400" : colorClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function PlanUsageWidget() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const orgId = user?.organization_id || user?.tenant_id;

  const { data: subscription } = useQuery({
    queryKey: ["plan-usage-subscription", orgId],
    queryFn: async () => {
      const subs = await matrixSales.entities.Subscription.filter({ organization_id: orgId });
      const list = (Array.isArray(subs) ? subs : []).filter(Boolean);
      return list.length > 0 ? list[0] : null;
    },
    enabled: Boolean(orgId) && !user?.is_platform_owner,
    staleTime: 5 * 60 * 1000
  });

  const { data: userCount = 0 } = useQuery({
    queryKey: ["plan-usage-users", orgId],
    queryFn: async () => {
      const users = await matrixSales.entities.User.filter({ organization_id: orgId });
      return Array.isArray(users) ? users.filter(Boolean).length : 0;
    },
    enabled: Boolean(orgId) && !user?.is_platform_owner,
    staleTime: 5 * 60 * 1000
  });

  const { data: invoiceCount = 0 } = useQuery({
    queryKey: ["plan-usage-invoices", orgId],
    queryFn: async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      try {
        const invoices = await matrixSales.entities.Invoice.filter({
          organization_id: orgId,
          invoice_date_gte: firstOfMonth
        });
        return Array.isArray(invoices) ? invoices.filter(Boolean).length : 0;
      } catch {
        const invoices = await matrixSales.entities.Invoice.list("-invoice_date", 9999);
        const thisMonth = Array.isArray(invoices)
          ? invoices.filter(Boolean).filter((inv) => inv.invoice_date >= firstOfMonth)
          : [];
        return thisMonth.length;
      }
    },
    enabled: Boolean(orgId) && !user?.is_platform_owner,
    staleTime: 5 * 60 * 1000
  });

  if (!subscription || user?.is_platform_owner) return null;

  const plan = normalizeSubscriptionPlan(subscription);
  const userLimit = plan.limits?.users ?? plan.userLimit;
  const invoiceLimit = plan.limits?.invoices_per_month ?? plan.invoiceLimit;

  const trialEnd = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))) : null;
  const isTrialing = subscription.status === "trialing";

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5" dir={isRTL ? "rtl" : "ltr"}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#eef3f9] p-2">
              <Zap className="h-4 w-4 text-[#24466f]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {isRTL ? "خطتك" : "Your Plan"}
              </p>
              <p className="text-sm font-bold text-slate-800">{plan.name}</p>
            </div>
          </div>
          {isTrialing && trialDaysLeft !== null && (
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              trialDaysLeft <= 3 ? "bg-red-50 text-red-700" : trialDaysLeft <= 7 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
            }`}>
              <Calendar className="h-3 w-3" />
              {isRTL ? `${trialDaysLeft} يوم تجريبي` : `${trialDaysLeft}d trial`}
            </div>
          )}
          <a
            href="mailto:support@horizon-sa.net?subject=Upgrade%20Plan"
            className="flex items-center gap-1 text-xs font-semibold text-[#24466f] hover:underline"
          >
            {isRTL ? "ترقية" : "Upgrade"}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        <div className="space-y-3">
          <UsageBar
            label={isRTL ? "المستخدمون" : "Users"}
            used={userCount}
            limit={typeof userLimit === "number" ? userLimit : (userLimit === "Unlimited" ? 999999 : Number(userLimit) || null)}
            icon={Users}
            colorClass="bg-[#24466f]"
          />
          <UsageBar
            label={isRTL ? "الفواتير هذا الشهر" : "Invoices this month"}
            used={invoiceCount}
            limit={typeof invoiceLimit === "number" ? invoiceLimit : (invoiceLimit === "Custom" ? 999999 : Number(invoiceLimit) || null)}
            icon={Receipt}
            colorClass="bg-emerald-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}
