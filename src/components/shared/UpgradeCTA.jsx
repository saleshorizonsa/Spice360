import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Zap } from "lucide-react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useAuth } from "@/lib/AuthContext";
import { normalizeSubscriptionPlan } from "@/lib/subscriptionPlans";

export default function UpgradeCTA() {
  const { user } = useAuth();
  const orgId = user?.organization_id || user?.tenant_id;

  const { data: subscription } = useQuery({
    queryKey: ["upgrade-cta-subscription", orgId],
    queryFn: async () => {
      const subs = await matrixSales.entities.Subscription.filter({ organization_id: orgId });
      const list = (Array.isArray(subs) ? subs : []).filter(Boolean);
      return list.length > 0 ? list[0] : null;
    },
    enabled: Boolean(orgId) && !user?.is_platform_owner,
    staleTime: 10 * 60 * 1000
  });

  if (!subscription || user?.is_platform_owner) return null;

  const plan = normalizeSubscriptionPlan(subscription);

  // Only show for starter/trialing — hide for enterprise/professional who already paid
  const showUpgrade = subscription.status === "trialing" || plan.id === "starter";
  if (!showUpgrade) return null;

  const targetPlan = plan.id === "starter" ? "Professional" : "Professional";
  const subject = encodeURIComponent(`Upgrade to ${targetPlan} Plan`);
  const body = encodeURIComponent(`Hi,\n\nI would like to upgrade my HORIZON subscription to the ${targetPlan} plan.\n\nAccount email: ${user?.email || ""}\n\nThank you.`);

  return (
    <div className="mx-3 mb-4 rounded-xl bg-gradient-to-br from-[#1a3554] to-[#24466f] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-lg bg-[#d68f2b]/20 p-1.5">
          <Zap className="h-3.5 w-3.5 text-[#d68f2b]" />
        </div>
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Current Plan
        </span>
      </div>
      <p className="text-sm font-bold text-white mb-1">{plan.name}</p>
      <p className="text-xs text-white/60 mb-3 leading-relaxed">
        Upgrade for more users, priority support, and advanced features.
      </p>
      <a
        href={`mailto:support@horizon-sa.net?subject=${subject}&body=${body}`}
        className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#d68f2b] py-2 text-xs font-semibold text-slate-900 hover:bg-[#efaa42] transition-colors"
      >
        Upgrade Plan
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
