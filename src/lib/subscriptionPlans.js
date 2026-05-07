export const PLATFORM_OWNER_EMAIL = "shareef6695@gmail.com";

export const subscriptionPlans = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 299,
    currency: "SAR",
    billingCycle: "monthly",
    trialDays: 14,
    userLimit: 5,
    invoiceLimit: 500,
    supportLevel: "Email support",
    modules: ["Sales", "Inventory", "Finance", "ZATCA"],
    limits: {
      users: 5,
      invoices_per_month: 500,
      tenants: 1
    }
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 799,
    currency: "SAR",
    billingCycle: "monthly",
    trialDays: 14,
    userLimit: 25,
    invoiceLimit: 5000,
    supportLevel: "Priority support",
    modules: ["Sales", "Inventory", "Finance", "Purchasing", "HR", "Projects", "ZATCA", "Reports"],
    limits: {
      users: 25,
      invoices_per_month: 5000,
      tenants: 1
    }
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    currency: "SAR",
    billingCycle: "custom",
    trialDays: 30,
    userLimit: "Unlimited",
    invoiceLimit: "Custom",
    supportLevel: "Dedicated success manager",
    modules: ["All modules", "Advanced reports", "Owner controls", "Integrations"],
    limits: {
      users: 999999,
      invoices_per_month: 999999,
      tenants: 1
    }
  }
];

export const defaultSubscriptionPlanId = "professional";

export function getSubscriptionPlan(planId = defaultSubscriptionPlanId) {
  return subscriptionPlans.find((plan) => plan.id === planId) || subscriptionPlans.find((plan) => plan.id === defaultSubscriptionPlanId);
}

export function normalizeSubscriptionPlan(plan = {}) {
  const fallback = getSubscriptionPlan(plan.plan_id || plan.id);
  return {
    ...fallback,
    ...plan,
    id: plan.plan_id || plan.id || fallback.id,
    name: plan.plan_name || plan.name || fallback.name,
    monthlyPrice: plan.monthly_price ?? plan.monthlyPrice ?? fallback.monthlyPrice,
    billingCycle: plan.billing_cycle || plan.billingCycle || fallback.billingCycle,
    trialDays: plan.trial_days ?? plan.trialDays ?? fallback.trialDays,
    userLimit: plan.user_limit ?? plan.userLimit ?? fallback.userLimit,
    invoiceLimit: plan.invoice_limit ?? plan.invoiceLimit ?? fallback.invoiceLimit,
    supportLevel: plan.support_level || plan.supportLevel || fallback.supportLevel,
    modules: Array.isArray(plan.modules) ? plan.modules : fallback.modules,
    limits: plan.limits || fallback.limits,
    currency: plan.currency || fallback.currency,
    status: plan.status || "active"
  };
}

export function normalizeSubscriptionPlans(plans = []) {
  if (!Array.isArray(plans) || plans.length === 0) return subscriptionPlans;
  const activePlans = plans
    .map(normalizeSubscriptionPlan)
    .filter((plan) => plan.status === "active")
    .sort((left, right) => (left.display_order ?? 99) - (right.display_order ?? 99));
  return activePlans.length > 0 ? activePlans : subscriptionPlans;
}

export function formatPlanPrice(plan) {
  if (!plan) return "";
  if (plan.monthlyPrice === null) return "Custom";
  return `${plan.currency} ${plan.monthlyPrice.toLocaleString()}/mo`;
}

export function getStoredSignupPlan() {
  if (typeof window === "undefined") return defaultSubscriptionPlanId;
  return window.localStorage.getItem("horizon_selected_plan") || defaultSubscriptionPlanId;
}

export function storeSignupPlan(planId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("horizon_selected_plan", planId || defaultSubscriptionPlanId);
}

export function isPlatformOwnerEmail(email) {
  return email?.toLowerCase() === PLATFORM_OWNER_EMAIL;
}
