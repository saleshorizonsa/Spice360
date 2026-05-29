import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Building2, CheckCircle2, CreditCard, Eye, PauseCircle, PlayCircle, RefreshCw, Shield, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { matrixSales } from "@/api/matrixSalesClient";
import DataTable from "@/components/erp/DataTable";
import StatCard from "@/components/erp/StatCard";
import { useAuth } from "@/lib/AuthContext";
import { isPlatformOwnerEmail, normalizeSubscriptionPlan, subscriptionPlans } from "@/lib/subscriptionPlans";

const toList = (v) => (Array.isArray(v) ? v : []);
const toLimitNumber = (v) => (v === "Unlimited" || v === "Custom" ? 999999 : Number(v) || 0);

const statusClass = (s) => ({
  trialing:  "bg-blue-100 text-blue-800",
  active:    "bg-emerald-100 text-emerald-800",
  past_due:  "bg-amber-100 text-amber-800",
  cancelled: "bg-slate-100 text-slate-600",
  expired:   "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
  ready_to_use: "bg-emerald-100 text-emerald-800",
  company_profile_pending: "bg-orange-100 text-orange-800",
  zatca_setup_pending: "bg-amber-100 text-amber-800",
  modules_configuration_pending: "bg-blue-100 text-blue-800",
}[s] || "bg-slate-100 text-slate-800");

const hasOwnerApi = typeof matrixSales.owner?.listTenants === "function";

const fetchAllTenants = async () => {
  if (hasOwnerApi) {
    const data = await matrixSales.owner.listTenants();
    return Array.isArray(data) ? data : [];
  }
  const [orgs, subs] = await Promise.all([
    matrixSales.entities.Organization.list("-created_at"),
    matrixSales.entities.Subscription.list("-created_at")
  ]);
  const subMap = new Map(toList(subs).map((s) => [s.organization_id, s]));
  return toList(orgs).map((org) => ({
    ...org,
    subscription: subMap.get(org.id) || null,
    user_count: 0
  }));
};

const saveSubscription = async (orgId, data) => {
  if (hasOwnerApi) return matrixSales.owner.updateSubscription(orgId, data);
  const existing = (await matrixSales.entities.Subscription.filter({ organization_id: orgId })).filter(Boolean);
  if (existing.length > 0 && existing[0]?.id) {
    return matrixSales.entities.Subscription.update(existing[0].id, { ...existing[0], ...data, organization_id: orgId });
  }
  return matrixSales.entities.Subscription.create({ ...data, organization_id: orgId });
};

const BLANK_SUB = {
  plan: "professional", plan_name: "Professional", status: "trialing",
  monthly_price: 799, currency: "SAR", trial_end_date: "", renewal_date: "", billing_notes: ""
};

function SubscriptionPanel({ tenant, plans, onClose, onSaved }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sub = tenant.subscription || {};

  const [form, setForm] = useState({
    ...BLANK_SUB,
    ...sub,
    plan: sub.plan || sub.plan_id || BLANK_SUB.plan,
    plan_name: sub.plan_name || BLANK_SUB.plan_name,
    monthly_price: sub.monthly_price ?? BLANK_SUB.monthly_price,
    trial_end_date: sub.trial_end_date ? sub.trial_end_date.slice(0, 10) : "",
    renewal_date: sub.renewal_date ? sub.renewal_date.slice(0, 10) : ""
  });

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const applyAndSave = async (overrides) => {
    const payload = { ...form, ...overrides, plan_id: (overrides.plan || form.plan), organization_id: tenant.id, tenant_id: tenant.id };
    setForm((prev) => ({ ...prev, ...overrides }));
    try {
      await saveSubscription(tenant.id, payload);
      queryClient.invalidateQueries({ queryKey: ["owner-tenants"] });
      toast({ title: "Subscription updated", description: `${tenant.tenant_name || tenant.id} is now ${payload.status}.` });
      onSaved?.();
    } catch (err) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => saveSubscription(tenant.id, { ...form, plan_id: form.plan, organization_id: tenant.id, tenant_id: tenant.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-tenants"] });
      toast({ title: "Subscription saved" });
      onSaved?.();
    },
    onError: (err) => toast({ title: "Save failed", description: err.message, variant: "destructive" })
  });

  const trialDays = plans.find((p) => p.id === form.plan)?.trialDays || 14;
  const daysOut = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  return (
    <Card className="border-[#24466f]/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg">Manage Subscription</CardTitle>
          <p className="text-sm text-slate-500 mt-0.5">{tenant.tenant_name || tenant.id}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500">✕</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quick actions */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Actions</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => applyAndSave({ status: "active", renewal_date: daysOut(30) })}>
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Activate (30-day)
            </Button>
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => applyAndSave({ status: "trialing", trial_end_date: daysOut(trialDays) })}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Start Trial ({trialDays}d)
            </Button>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => applyAndSave({ status: "past_due" })}>
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Suspend
            </Button>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => applyAndSave({ status: "cancelled" })}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={form.plan} onValueChange={(v) => {
              const p = plans.find((x) => x.id === v);
              set("plan", v);
              set("plan_name", p?.name || v);
              if (p?.monthlyPrice != null) set("monthly_price", p.monthlyPrice);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past Due / Suspended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Monthly Price (SAR)</Label>
            <Input type="number" value={form.monthly_price ?? ""} onChange={(e) => set("monthly_price", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input value={form.currency || "SAR"} onChange={(e) => set("currency", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Trial End Date</Label>
            <Input type="date" value={form.trial_end_date || ""} onChange={(e) => set("trial_end_date", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Renewal Date</Label>
            <Input type="date" value={form.renewal_date || ""} onChange={(e) => set("renewal_date", e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Billing Notes</Label>
          <Textarea
            value={form.billing_notes || ""}
            onChange={(e) => set("billing_notes", e.target.value)}
            rows={2}
            placeholder="Internal notes about this customer's billing..."
          />
        </div>

        <Button
          className="w-full bg-[#24466f] hover:bg-[#193658]"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Subscription"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const isOwner = user?.is_platform_owner || isPlatformOwnerEmail(user?.email);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenants = [], isLoading: tenantsLoading, error: tenantsError } = useQuery({
    queryKey: ["owner-tenants"],
    queryFn: fetchAllTenants,
    enabled: isOwner,
    initialData: []
  });

  const { data: dbPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["owner-subscription-plans"],
    queryFn: () => matrixSales.entities.SubscriptionPlan.list("display_order"),
    enabled: isOwner,
    initialData: []
  });

  const planRows = (dbPlans.length > 0 ? dbPlans : subscriptionPlans.map((plan, i) => ({
    plan_id: plan.id, plan_name: plan.name, monthly_price: plan.monthlyPrice,
    currency: plan.currency, billing_cycle: plan.billingCycle, trial_days: plan.trialDays,
    user_limit: plan.userLimit, invoice_limit: plan.invoiceLimit, support_level: plan.supportLevel,
    modules: plan.modules, limits: plan.limits, display_order: i + 1, status: "active"
  }))).filter(Boolean).map(normalizeSubscriptionPlan).filter(Boolean);

  useEffect(() => {
    if (!editingPlan && !isNewPlan && planRows.length > 0) setEditingPlan(planRows[0]);
  }, [editingPlan, isNewPlan, planRows]);

  const savePlanMutation = useMutation({
    mutationFn: async (plan) => {
      if (!plan.id || !String(plan.id).trim()) throw new Error("Plan ID is required.");
      if (!plan.name || !String(plan.name).trim()) throw new Error("Plan Name is required.");
      const payload = {
        plan_id: String(plan.id).trim().toLowerCase(), plan_name: plan.name,
        monthly_price: plan.monthlyPrice === "" ? null : Number(plan.monthlyPrice),
        currency: plan.currency || "SAR", billing_cycle: plan.billingCycle || "monthly",
        trial_days: Number(plan.trialDays) || 14, user_limit: plan.userLimit,
        invoice_limit: plan.invoiceLimit, support_level: plan.supportLevel,
        modules: Array.isArray(plan.modules) ? plan.modules : String(plan.modules || "").split(",").map((s) => s.trim()).filter(Boolean),
        limits: { users: toLimitNumber(plan.userLimit), invoices_per_month: toLimitNumber(plan.invoiceLimit), tenants: 1 },
        display_order: Number(plan.display_order) || 99, status: plan.status || "active"
      };
      const existing = (await matrixSales.entities.SubscriptionPlan.filter({ plan_id: payload.plan_id })).filter(Boolean);
      if (existing.length > 0 && existing[0]?.id) return matrixSales.entities.SubscriptionPlan.update(existing[0].id, { ...existing[0], ...payload });
      return matrixSales.entities.SubscriptionPlan.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["public-subscription-plans"] });
      setIsNewPlan(false);
      toast({ title: isNewPlan ? "Plan created" : "Plan saved", description: "The plan is now live on the public pricing page." });
    },
    onError: (err) => toast({ title: "Unable to save plan", description: err.message, variant: "destructive" })
  });

  const seedPlansMutation = useMutation({
    mutationFn: () => Promise.all(subscriptionPlans.map((plan, i) => savePlanMutation.mutateAsync({ ...plan, display_order: i + 1 }))),
    onSuccess: () => toast({ title: "Default plans seeded" })
  });

  const tenantList = toList(tenants);

  const rows = tenantList.map((tenant) => {
    const sub = tenant.subscription || {};
    return {
      ...tenant,
      tenant_name: tenant.company_legal_name || tenant.organization_name || tenant.company_name || tenant.trade_name || tenant.id,
      plan: sub.plan_name || sub.plan || tenant.selected_plan || "-",
      subscription_status: sub.status || "not_started",
      trial_end_date: sub.trial_end_date ? sub.trial_end_date.slice(0, 10) : "-",
      renewal_date: sub.renewal_date ? sub.renewal_date.slice(0, 10) : "-",
      monthly_price: sub.monthly_price || 0,
      user_count: tenant.user_count || 0
    };
  });

  const activeCount = tenantList.filter((t) => t.subscription?.status === "active").length;
  const trialCount  = tenantList.filter((t) => t.subscription?.status === "trialing").length;
  const mrr = tenantList.filter((t) => t.subscription?.status === "active")
    .reduce((sum, t) => sum + (Number(t.subscription?.monthly_price) || 0), 0);

  if (!isOwner) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="text-2xl font-bold">Owner access required</h1>
            <p className="mt-2 text-slate-600">Only the platform owner can access this dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">Owner Dashboard</h1>
        <p className="mt-1 text-slate-600">Tenant management, subscriptions, and pricing.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Customers" value={tenantList.length} icon={Building2} trend="All tenants" color="blue" />
        <StatCard title="Active Subscriptions" value={activeCount} icon={CreditCard} trend="Paid accounts" color="emerald" />
        <StatCard title="Trial Users" value={trialCount} icon={Users} trend="Trialing tenants" color="amber" />
        <StatCard title="MRR" value={`SAR ${mrr.toLocaleString()}`} icon={BarChart3} trend="Active plans only" color="purple" />
      </div>

      {/* Tenant list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Customers
            {tenantsLoading && <span className="text-sm font-normal text-slate-500">Loading...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Unable to load tenant data. Confirm the API connection and owner role assignment.
            </div>
          ) : (
            <DataTable
              data={rows}
              columns={[
                { header: "Tenant", key: "tenant_name" },
                { header: "Owner Email", key: "owner_email" },
                { header: "Users", key: "user_count" },
                { header: "Plan", key: "plan" },
                {
                  header: "Subscription",
                  key: "subscription_status",
                  render: (v) => <Badge className={statusClass(v)}>{v || "not_started"}</Badge>
                },
                { header: "Trial End", key: "trial_end_date" },
                { header: "Renewal", key: "renewal_date" },
                { header: "MRR (SAR)", key: "monthly_price" },
                {
                  header: "Actions",
                  key: "actions",
                  sortable: false,
                  render: (_v, row) => (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedTenant(row); setShowManage(false); }}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" className="bg-[#24466f] hover:bg-[#193658]"
                        onClick={() => { setSelectedTenant(row); setShowManage(true); }}>
                        <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Billing
                      </Button>
                    </div>
                  )
                }
              ]}
              searchFields={["tenant_name", "owner_email", "plan", "subscription_status"]}
              itemsPerPage={20}
              enableSorting={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Tenant detail (read-only) */}
      {selectedTenant && !showManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Customer Details
              <Button size="sm" className="bg-[#24466f] hover:bg-[#193658]" onClick={() => setShowManage(true)}>
                <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Manage Subscription
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["Tenant ID", selectedTenant.id],
              ["Company", selectedTenant.tenant_name],
              ["Owner Email", selectedTenant.owner_email || "-"],
              ["Contact Email", selectedTenant.contact_email || "-"],
              ["VAT Number", selectedTenant.vat_number || "-"],
              ["CR Number", selectedTenant.commercial_registration_number || "-"],
              ["Plan", selectedTenant.plan],
              ["Subscription", selectedTenant.subscription_status],
              ["Trial End", selectedTenant.trial_end_date],
              ["Renewal Date", selectedTenant.renewal_date],
              ["Active Users", selectedTenant.user_count],
              ["MRR (SAR)", selectedTenant.monthly_price],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{String(value ?? "-")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Subscription management panel */}
      {selectedTenant && showManage && (
        <SubscriptionPanel
          tenant={selectedTenant}
          plans={planRows}
          onClose={() => setShowManage(false)}
          onSaved={() => { setShowManage(false); setSelectedTenant(null); }}
        />
      )}

      {/* Plan pricing editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Plans & Pricing
            <div className="flex items-center gap-2">
              {plansLoading && <span className="text-sm font-normal text-slate-500">Loading...</span>}
              <Button variant="outline" size="sm" onClick={() => seedPlansMutation.mutate()} disabled={seedPlansMutation.isPending}>
                Seed Defaults
              </Button>
              <Button size="sm" className="bg-[#24466f] hover:bg-[#193658]" onClick={() => {
                setIsNewPlan(true);
                setEditingPlan({
                  id: "", name: "", monthlyPrice: 0, currency: "SAR",
                  billingCycle: "monthly", trialDays: 14, userLimit: 5,
                  invoiceLimit: 500, supportLevel: "Email support",
                  modules: [], status: "active", display_order: planRows.length + 1
                });
              }}>
                + Add Plan
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <DataTable
            data={planRows}
            columns={[
              { header: "Plan", key: "name" },
              {
                header: "Monthly Price",
                key: "monthlyPrice",
                render: (v, row) => row.monthlyPrice === null ? "Custom" : `${row.currency} ${Number(v || 0).toLocaleString()}`
              },
              { header: "Users", key: "userLimit" },
              { header: "Invoices/mo", key: "invoiceLimit" },
              { header: "Support", key: "supportLevel" },
              { header: "Trial Days", key: "trialDays" },
              {
                header: "Status",
                key: "status",
                render: (v) => <Badge className={statusClass(v)}>{v || "active"}</Badge>
              },
              {
                header: "Edit",
                key: "edit",
                sortable: false,
                render: (_v, row) => <Button variant="outline" size="sm" onClick={() => { setIsNewPlan(false); setEditingPlan(row); }}>Edit</Button>
              }
            ]}
            searchFields={["name", "supportLevel", "status"]}
            itemsPerPage={10}
            enableSorting={true}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">{isNewPlan ? "New Plan" : "Edit Plan"}</h3>
            {editingPlan ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Plan ID <span className="text-slate-400 text-xs font-normal">(slug, e.g. "gold" — cannot change after creation)</span></Label>
                  <Input
                    value={editingPlan.id || ""}
                    placeholder={isNewPlan ? "e.g. gold" : ""}
                    disabled={!isNewPlan}
                    className={!isNewPlan ? "bg-slate-50 text-slate-500" : ""}
                    onChange={(e) => isNewPlan && setEditingPlan({ ...editingPlan, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan Name</Label>
                  <Input value={editingPlan.name || ""} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monthly Price (SAR)</Label>
                    <Input type="number" value={editingPlan.monthlyPrice ?? ""} onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trial Days</Label>
                    <Input type="number" value={editingPlan.trialDays ?? 14} onChange={(e) => setEditingPlan({ ...editingPlan, trialDays: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>User Limit</Label>
                    <Input value={editingPlan.userLimit ?? ""} onChange={(e) => setEditingPlan({ ...editingPlan, userLimit: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Invoice Limit</Label>
                    <Input value={editingPlan.invoiceLimit ?? ""} onChange={(e) => setEditingPlan({ ...editingPlan, invoiceLimit: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Support Level</Label>
                  <Input value={editingPlan.supportLevel || ""} onChange={(e) => setEditingPlan({ ...editingPlan, supportLevel: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editingPlan.status || "active"} onValueChange={(v) => setEditingPlan({ ...editingPlan, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Modules (comma-separated)</Label>
                  <Textarea
                    value={(editingPlan.modules || []).join(", ")}
                    onChange={(e) => setEditingPlan({ ...editingPlan, modules: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    rows={3}
                  />
                </div>
                {isNewPlan && (
                  <Button variant="outline" className="w-full" onClick={() => {
                    setIsNewPlan(false);
                    setEditingPlan(planRows[0] || null);
                  }}>
                    Cancel
                  </Button>
                )}
                <Button
                  className="w-full bg-[#24466f] hover:bg-[#193658]"
                  disabled={savePlanMutation.isPending}
                  onClick={() => savePlanMutation.mutate(editingPlan)}
                >
                  {savePlanMutation.isPending ? "Saving..." : isNewPlan ? "Create Plan" : "Save Pricing"}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a plan to edit, or click Add Plan.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
