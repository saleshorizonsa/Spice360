import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, CreditCard, Eye, Shield, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { matrixSales } from "@/api/matrixSalesClient";
import DataTable from "@/components/erp/DataTable";
import StatCard from "@/components/erp/StatCard";
import { useAuth } from "@/lib/AuthContext";
import { isPlatformOwnerEmail } from "@/lib/subscriptionPlans";

const toList = (value) => (Array.isArray(value) ? value : []);

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
  const isOwner = user?.is_platform_owner || isPlatformOwnerEmail(user?.email);

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
    </div>
  );
}
