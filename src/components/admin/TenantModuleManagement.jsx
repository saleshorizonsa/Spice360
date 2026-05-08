import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw, Save, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { matrixSales } from "@/api/matrixSalesClient";
import { useOrganization } from "@/components/utils/OrganizationContext";
import {
  businessTypes,
  getBusinessTypeLabel,
  getDefaultModulesForBusinessType,
  getEnabledModuleKeys,
  getEnabledModulesForOrganization,
  moduleCatalog
} from "@/lib/tenantModules";

export default function TenantModuleManagement() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [businessType, setBusinessType] = useState(currentOrg?.business_type || "it_services");
  const [modules, setModules] = useState(() => getEnabledModulesForOrganization(currentOrg));

  React.useEffect(() => {
    setBusinessType(currentOrg?.business_type || "it_services");
    setModules(getEnabledModulesForOrganization(currentOrg));
  }, [currentOrg]);

  const enabledCount = useMemo(() => getEnabledModuleKeys(modules).length, [modules]);

  const applyBusinessType = (nextType) => {
    setBusinessType(nextType);
    setModules(getDefaultModulesForBusinessType(nextType));
  };

  const toggleModule = (moduleKey) => {
    setModules((prev) => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  };

  const save = async () => {
    if (!currentOrg?.id) {
      toast({ title: "No tenant selected", description: "Select a tenant before saving modules.", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      const enabledModules = getEnabledModuleKeys(modules);
      await matrixSales.entities.Organization.update(currentOrg.id, {
        ...currentOrg,
        business_type: businessType,
        tenant_modules: modules,
        module_config: modules,
        enabled_modules: enabledModules,
        product_positioning: "zatca_recurring_billing_for_saudi_it_services"
      });

      const existingConfigs = await matrixSales.entities.IntegrationConfig.filter({ config_id: `modules-${currentOrg.id}` }).catch(() => []);
      const payload = {
        config_id: `modules-${currentOrg.id}`,
        integration_name: "tenant_modules",
        business_type: businessType,
        tenant_modules: modules,
        enabled_modules: enabledModules,
        dashboard_tabs: enabledModules,
        status: "active",
        tenant_id: currentOrg.id,
        organization_id: currentOrg.id
      };
      if (existingConfigs.length > 0) {
        await matrixSales.entities.IntegrationConfig.update(existingConfigs[0].id, { ...existingConfigs[0], ...payload });
      } else {
        await matrixSales.entities.IntegrationConfig.create(payload);
      }

      window.dispatchEvent(new CustomEvent("matrixsales:organizations-changed"));
      queryClient.invalidateQueries();
      toast({ title: "Modules saved", description: "Tenant navigation and dashboards now follow the selected modules." });
    } catch (error) {
      toast({ title: "Unable to save modules", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[#24466f]" />
              Tenant Modules
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Focus the tenant on recurring billing, service contracts, ZATCA, WhatsApp, and customer portal workflows.
            </p>
          </div>
          <Badge className="w-fit bg-emerald-600">{enabledCount} enabled</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Business type</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {businessTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => applyBusinessType(type.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  businessType === type.value
                    ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Current positioning: {getBusinessTypeLabel(businessType)}. IT Services disables manufacturing, deep inventory, production planning, and supply chain by default.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {moduleCatalog.map((moduleItem) => {
            const enabled = Boolean(modules[moduleItem.key]);
            return (
              <div key={moduleItem.key} className="flex items-start justify-between gap-4 rounded-xl border bg-white p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{moduleItem.label}</p>
                    {enabled && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{moduleItem.description}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={() => toggleModule(moduleItem.key)} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => applyBusinessType(businessType)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to business type
          </Button>
          <Button type="button" onClick={save} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save modules"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
