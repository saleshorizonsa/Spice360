import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X, ArrowUpRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { matrixSales } from "@/api/matrixSalesClient";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";

export default function TrialBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem("trial_banner_dismissed") === "1"
  );

  const { data: subscription } = useQuery({
    queryKey: ["trial-banner-subscription", user?.id],
    queryFn: async () => {
      const orgId = user?.organization_id || user?.tenant_id;
      if (!orgId) return null;
      const subs = await matrixSales.entities.Subscription.filter({ organization_id: orgId });
      const list = (Array.isArray(subs) ? subs : []).filter(Boolean);
      return list.length > 0 ? list[0] : null;
    },
    enabled: Boolean(user?.id) && !user?.is_platform_owner,
    staleTime: 5 * 60 * 1000
  });

  if (dismissed || !subscription) return null;
  if (subscription.status !== "trialing") return null;

  const trialEnd = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
  if (!trialEnd) return null;

  const now = new Date();
  const diffMs = trialEnd - now;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return null; // Gate page handles expired

  const urgent = daysLeft <= 3;
  const warning = daysLeft <= 7;

  const handleDismiss = () => {
    sessionStorage.setItem("trial_banner_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium ${
        urgent
          ? "bg-red-600 text-white"
          : warning
          ? "bg-amber-500 text-white"
          : "bg-[#24466f] text-white"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {urgent ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">
          {`${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in your free trial`}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          asChild
          size="sm"
          variant="secondary"
          className={`h-7 gap-1 px-3 text-xs font-semibold ${
            urgent
              ? "bg-white text-red-700 hover:bg-red-50"
              : warning
              ? "bg-white text-amber-700 hover:bg-amber-50"
              : "bg-white text-[#24466f] hover:bg-blue-50"
          }`}
        >
          <a href={`mailto:support@horizon-sa.net?subject=Upgrade%20Plan`}>
            Upgrade Now
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </Button>
        <button
          onClick={handleDismiss}
          className="rounded p-0.5 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
