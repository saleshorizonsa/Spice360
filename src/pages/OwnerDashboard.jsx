import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Building2, CreditCard, Eye, Shield, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const toList = (value) => (Array.isArray(value) ? value : []);
const toLimitNumber = (value) => {
  if (value === "Unlimited" || value === "Custom") return 999999;
  return Number(value) || 0;
};

const statusClass = (status) => {
  const classes = {
    trialing: "bg-blue-100 text-blue-800",
    active: "bg-emerald-100 text-emerald-800",
    past_due: "bg-amber-100 text-amber-800",
    cancelled: "bg-slate-100 text-slate-800",
    expired: "bg-red-100 text-red-800",
    ready_to_use: "bg-emerald-100 text-emerald-800",
    zatca_setup_pending: "bg-amber-100 text-amber-800",
    company_profile_pending: "bg-orange-100 text-orange-800",
    modules_configuration_pending: "bg-blue-100 text-blue-800"
  };
  return classes[status] || "bg-slate-100 text-slate-800";
};

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const isOwner = user?.is_platform_owner || isPlatformOwnerEmail(user?.email);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenants = [], isLoading: tenantsLoading, error: tenantsError } = useQuery({
    queryKey: ["owner-tenants"],
    queryFn: () => matrixSales.entities.Organization.list("-created_at"),
    enabled: isOwner,
    initialData: []
  });

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["owner-subscriptions"],
    queryFn: () => matrixSales.entities.Subscription.list("-created_at"),
    enabled: isOwner,
    initialData: []
  });

  const { data: dbPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["owner-subscription-plans"],
    queryFn: () => matrixSales.entities.SubscriptionPlan.list("display_order"),
    enabled: isOwner,
    initialData: []
  });

  const planRows = (dbPlans.length > 0 ? dbPlans : subscriptionPlans.map((plan, index) => ({
    plan_id: plan.id,
    plan_name: plan.name,
    monthly_price: plan.monthlyPrice,
    currency: plan.currency,
    billing_cycle: plan.billingCycle,
    trial_days: plan.trialDays,
    user_limit: plan.userLimit,
    invoice_limit: plan.invoiceLimit,
    support_level: plan.supportLevel,
    modules: plan.modules,
    limits: plan.limits,
    display_order: index + 1,
    status: "active"
  }))).map(normalizeSubscriptionPlan);

  useEffect(() => {
    if (!editingPlan && planRows.length > 0) {
      setEditingPlan(planRows[0]);
    }
  }, [editingPlan, planRows]);

  const savePlanMutation = useMutation({
    mutationFn: async (plan) => {
      const payload = {
        plan_id: plan.id,
        plan_name: plan.name,
        monthly_price: plan.monthlyPrice === "" ? null : Number(plan.monthlyPrice),
        currency: plan.currency || "SAR",
        billing_cycle: plan.billingCycle || "monthly",
        trial_days: Number(plan.trialDays) || 14,
        user_limit: plan.userLimit,
        invoice_limit: plan.invoiceLimit,
        support_level: plan.supportLevel,
        modules: Array.isArray(plan.modules) ? plan.modules : String(plan.modules || "").split(",").map((item) => item.trim()).filter(Boolean),
        limits: {
          users: toLimitNumber(plan.userLimit),
          invoices_per_month: toLimitNumber(plan.invoiceLimit),
          tenants: 1
        },
        display_order: Number(plan.display_order) || 99,
        status: plan.status || "active"
      };

      const existing = await matrixSales.entities.SubscriptionPlan.filter({ plan_id: payload.plan_id });
      if (existing.length > 0) {
        return matrixSales.entities.SubscriptionPlan.update(existing[0].id, { ...existing[0], ...payload });
      }
      return matrixSales.entities.SubscriptionPlan.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["public-subscription-plans"] });
      toast({ title: "Plan saved", description: "Pricing updates now reflect on the public landing page." });
    },
    onError: (error) => {
      toast({ title: "Unable to save plan", description: error.message || "Please try again.", variant: "destructive" });
    }
  });

  const seedPlansMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(subscriptionPlans.map((plan, index) => savePlanMutation.mutateAsync({
        ...plan,
        display_order: index + 1
      })));
    },
    onSuccess: () => {
      toast({ title: "Default plans seeded", description: "Starter, Professional, and Enterprise plans are now database-backed." });
    }
  });

  const tenantList = toList(tenants);
  const subscriptionList = toList(subscriptions);

  const subscriptionByTenant = useMemo(() => {
    const map = new Map();
    subscriptionList.forEach((subscription) => {
      map.set(subscription.organization_id || subscription.tenant_id, subscription);
    });
    return map;
  }, [subscriptionList]);

  const rows = tenantList.map((tenant) => {
    const subscription = subscriptionByTenant.get(tenant.id) || {};
    return {
      ...tenant,
      tenant_name: tenant.company_legal_name || tenant.organization_name || tenant.company_name || tenant.trade_name || tenant.id,
      plan: subscription.plan_name || subscription.plan || tenant.selected_plan || "-",
      subscription_status: subscription.status || "not_started",
      trial_end_date: subscription.trial_end_date || "-",
      renewal_date: subscription.renewal_date || "-",
      monthly_price: subscription.monthly_price || 0
    };
  });

  const activeSubscriptions = subscriptionList.filter((item) => item.status === "active").length;
  const trialSubscriptions = subscriptionList.filter((item) => item.status === "trialing").length;
  const monthlyRevenue = subscriptionList
    .filter((item) => item.status === "active")
    .reduce((sum, item) => sum + (Number(item.monthly_price) || 0), 0);

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
        <p className="mt-1 text-slate-600">Platform-level tenant, subscription, onboarding, and usage overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Customers" value={tenantList.length} icon={Building2} trend="All tenants" color="blue" />
        <StatCard title="Active Subscriptions" value={activeSubscriptions} icon={CreditCard} trend="Paid accounts" color="emerald" />
        <StatCard title="Trial Users" value={trialSubscriptions} icon={Users} trend="Trialing tenants" color="amber" />
        <StatCard title="MRR Placeholder" value={`SAR ${monthlyRevenue.toLocaleString()}`} icon={BarChart3} trend="Active plans only" color="purple" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Customers
            {(tenantsLoading || subscriptionsLoading) && <span className="text-sm font-normal text-slate-500">Loading...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Unable to load owner dashboard data. Confirm the subscription migration and owner RLS policy are applied.
            </div>
          ) : (
            <DataTable
              data={rows}
              columns={[
                { header: "Tenant", key: "tenant_name" },
                { header: "Owner Email", key: "owner_email" },
                {
                  header: "Onboarding",
                  key: "onboarding_status",
                  render: (value) => <Badge className={statusClass(value)}>{value || "not_started"}</Badge>
                },
                { header: "Plan", key: "plan" },
                {
                  header: "Subscription",
                  key: "subscription_status",
                  render: (value) => <Badge className={statusClass(value)}>{value || "not_started"}</Badge>
                },
                { header: "Trial End", key: "trial_end_date" },
                { header: "Renewal", key: "renewal_date" },
                {
                  header: "Details",
                  key: "details",
                  sortable: false,
                  render: (_value, row) => (
                    <Button variant="outline" size="sm" onClick={() => setSelectedTenant(row)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  )
                }
              ]}
              searchFields={["tenant_name", "owner_email", "plan", "subscription_status", "onboarding_status"]}
              itemsPerPage={20}
              enableSorting={true}
            />
          )}
        </CardContent>
      </Card>

      {selectedTenant && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Tenant ID", selectedTenant.id],
              ["Company", selectedTenant.tenant_name],
              ["Owner", selectedTenant.owner_email || "-"],
              ["Contact", selectedTenant.contact_email || "-"],
              ["VAT", selectedTenant.vat_number || "-"],
              ["CR", selectedTenant.commercial_registration_number || "-"],
              ["Plan", selectedTenant.plan],
              ["Subscription", selectedTenant.subscription_status],
              ["Onboarding", selectedTenant.onboarding_status || "not_started"],
              ["City", selectedTenant.city || "-"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Plans & Pricing
            <div className="flex items-center gap-2">
              {plansLoading && <span className="text-sm font-normal text-slate-500">Loading...</span>}
              <Button variant="outline" size="sm" onClick={() => seedPlansMutation.mutate()} disabled={seedPlansMutation.isPending}>
                Seed Defaults
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
                render: (value, row) => row.monthlyPrice === null ? "Custom" : `${row.currency} ${Number(value || 0).toLocaleString()}`
              },
              { header: "Users", key: "userLimit" },
              { header: "Invoices", key: "invoiceLimit" },
              { header: "Support", key: "supportLevel" },
              {
                header: "Status",
                key: "status",
                render: (value) => <Badge className={statusClass(value)}>{value || "active"}</Badge>
              },
              {
                header: "Edit",
                key: "edit",
                sortable: false,
                render: (_value, row) => (
                  <Button variant="outline" size="sm" onClick={() => setEditingPlan(row)}>
                    Edit
                  </Button>
                )
              }
            ]}
            searchFields={["name", "supportLevel", "status"]}
            itemsPerPage={10}
            enableSorting={true}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Edit Plan</h3>
            {editingPlan ? (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Plan Name</Label>
                  <Input value={editingPlan.name || ""} onChange={(event) => setEditingPlan({ ...editingPlan, name: event.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monthly Price</Label>
                    <Input type="number" value={editingPlan.monthlyPrice ?? ""} onChange={(event) => setEditingPlan({ ...editingPlan, monthlyPrice: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <Input value={editingPlan.currency || "SAR"} onChange={(event) => setEditingPlan({ ...editingPlan, currency: event.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>User Limit</Label>
                    <Input value={editingPlan.userLimit ?? ""} onChange={(event) => setEditingPlan({ ...editingPlan, userLimit: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Invoice Limit</Label>
                    <Input value={editingPlan.invoiceLimit ?? ""} onChange={(event) => setEditingPlan({ ...editingPlan, invoiceLimit: event.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Trial Days</Label>
                    <Input type="number" value={editingPlan.trialDays ?? 14} onChange={(event) => setEditingPlan({ ...editingPlan, trialDays: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={editingPlan.status || "active"} onValueChange={(value) => setEditingPlan({ ...editingPlan, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Support Level</Label>
                  <Input value={editingPlan.supportLevel || ""} onChange={(event) => setEditingPlan({ ...editingPlan, supportLevel: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Modules</Label>
                  <Textarea
                    value={(editingPlan.modules || []).join(", ")}
                    onChange={(event) => setEditingPlan({ ...editingPlan, modules: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                    rows={3}
                  />
                </div>
                <Button className="w-full bg-[#24466f] hover:bg-[#193658]" disabled={savePlanMutation.isPending} onClick={() => savePlanMutation.mutate(editingPlan)}>
                  {savePlanMutation.isPending ? "Saving..." : "Save Pricing"}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a plan to edit pricing.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
