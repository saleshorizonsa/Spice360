import React from "react";
import { Lock, ArrowUpRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/SubscriptionContext";
import { getModuleForPage, MODULE_INFO } from "@/lib/moduleAccess";
import { useLanguage } from "@/components/utils/languageContext";

export default function ModuleGate({ pageName, children }) {
  const { hasModule, plan, isPlatformOwner } = useSubscription();
  const { isRTL } = useLanguage();

  const moduleName = getModuleForPage(pageName);

  if (!moduleName || hasModule(moduleName)) {
    return children;
  }

  const info = MODULE_INFO[moduleName] || { label: moduleName, description: "" };
  const planName = plan?.name || "your current plan";

  const subject = encodeURIComponent(`Upgrade to unlock ${info.label}`);
  const body = encodeURIComponent(`Hi,\n\nI'd like to upgrade my HORIZON subscription to unlock the ${info.label} module.\n\nThank you.`);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
        <Lock className="h-9 w-9 text-slate-400" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">
          {isRTL ? `${info.label} غير مفعّل` : `${info.label} is not included`}
        </h2>
        <p className="max-w-md text-slate-500">
          {isRTL
            ? `هذه الوحدة غير متاحة في خطة ${planName}. قم بالترقية للحصول على وصول كامل.`
            : `This module is not available on the ${planName} plan. Upgrade to unlock full access.`}
        </p>
        {info.description && (
          <p className="max-w-md text-sm text-slate-400">{info.description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={`mailto:support@horizon-sa.net?subject=${subject}&body=${body}`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#24466f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#193658]"
        >
          <Zap className="h-4 w-4" />
          {isRTL ? "ترقية الخطة" : "Upgrade Plan"}
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <Button variant="outline" onClick={() => window.history.back()}>
          {isRTL ? "رجوع" : "Go Back"}
        </Button>
      </div>

      <p className="text-xs text-slate-400">
        {isRTL
          ? "تواصل معنا على support@horizon-sa.net"
          : "Contact us at support@horizon-sa.net"}
      </p>
    </div>
  );
}
