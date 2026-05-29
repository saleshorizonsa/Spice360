import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";
import { useAuth } from "@/lib/AuthContext";
import { normalizeSubscriptionPlan } from "@/lib/subscriptionPlans";
import { hasModule as _hasModule } from "@/lib/moduleAccess";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const orgId = user?.organization_id || user?.tenant_id;
  const isPlatformOwner = Boolean(user?.is_platform_owner);

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["active-subscription", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const subs = await matrixSales.entities.Subscription.filter({ organization_id: orgId });
      const list = (Array.isArray(subs) ? subs : []).filter(Boolean);
      return list.length > 0 ? list[0] : null;
    },
    enabled: isAuthenticated && !isPlatformOwner && Boolean(orgId),
    staleTime: 60_000,
  });

  // Count invoices created this calendar month
  const { data: invoicesThisMonth = 0, isLoading: invLoading } = useQuery({
    queryKey: ["subscription-invoice-count", orgId],
    queryFn: async () => {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      const since = firstOfMonth.toISOString().slice(0, 10);
      try {
        const all = await matrixSales.entities.Invoice.list("-invoice_date", 9999);
        const list = Array.isArray(all) ? all.filter(Boolean) : [];
        return list.filter((inv) => inv.invoice_date >= since).length;
      } catch {
        return 0;
      }
    },
    enabled: isAuthenticated && !isPlatformOwner && Boolean(orgId),
    staleTime: 30_000,
  });

  const plan = useMemo(
    () => (subscription ? normalizeSubscriptionPlan(subscription) : null),
    [subscription]
  );

  const planModules = useMemo(() => plan?.modules ?? [], [plan]);

  const invoiceLimit = useMemo(() => {
    if (!plan) return Infinity;
    const raw = plan.limits?.invoices_per_month ?? plan.invoiceLimit;
    if (!raw || raw === "Custom") return Infinity;
    const n = Number(raw);
    return isNaN(n) ? Infinity : n;
  }, [plan]);

  const invoicesRemaining = Math.max(0, invoiceLimit - invoicesThisMonth);
  const atInvoiceLimit = invoiceLimit < Infinity && invoicesThisMonth >= invoiceLimit;

  const hasModule = (moduleName) => {
    if (isPlatformOwner) return true;
    if (!isAuthenticated) return false;
    if (!subscription) return true; // no subscription yet → don't block
    return _hasModule(planModules, moduleName);
  };

  const value = {
    subscription,
    plan,
    planModules,
    invoicesThisMonth,
    invoiceLimit,
    invoicesRemaining,
    atInvoiceLimit,
    hasModule,
    isLoading: subLoading || invLoading,
    isPlatformOwner,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return ctx;
}
