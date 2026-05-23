import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, CheckCircle2, FileCheck, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { matrixSales } from "@/api/matrixSalesClient";
import { useAuth } from "@/lib/AuthContext";
import BrandLogo from "@/components/BrandLogo";
import { getStoredSignupPlan, getSubscriptionPlan, normalizeSubscriptionPlan } from "@/lib/subscriptionPlans";
import { onboardingStatuses } from "@/lib/emailVerificationGate";

const steps = [
    { key: "email", label: "Email Verification", icon: CheckCircle2 },
    { key: "company", label: "Company Data", icon: Building2 },
    { key: "zatca", label: "ZATCA Setup", icon: FileCheck },
    { key: "modules", label: "Standard Modules", icon: Settings }
];

const documentSeriesTemplates = [
    ["quotation", "QT"],
    ["sales_order", "SO"],
    ["delivery", "DN"],
    ["invoice", "INV"],
    ["sales_return", "SR"],
    ["purchase_requisition", "PR"],
    ["purchase_order", "PO"],
    ["grn", "GRN"],
    ["vendor_invoice", "VINV"],
    ["journal_entry", "JE"],
    ["payment", "PAY"],
    ["stock_movement", "SM"],
    ["stock_transfer", "STO"],
    ["cycle_count", "CC"],
    ["production_order", "PRD"],
    ["work_order", "WO"],
    ["project", "PRJ"],
    ["inspection_lot", "IL"],
    ["capa", "CAPA"],
    ["coa", "COA"]
];

const roleTemplates = [
    { role_code: "TENANT_ADMIN", role_name: "Tenant Administrator", description: "Full administration for this tenant" },
    { role_code: "FIN_MGR", role_name: "Finance Manager", description: "Finance, ZATCA, period close, and reports" },
    { role_code: "SALES_MGR", role_name: "Sales Manager", description: "Sales orders, invoices, customers, and reports" },
    { role_code: "INV_CTRL", role_name: "Inventory Controller", description: "Stock, movements, cycle count, and warehouse reports" },
    { role_code: "HR_MGR", role_name: "HR Manager", description: "Employees, payroll, loans, and HR reports" }
];

const moduleDefaults = [
    "sales",
    "finance",
    "inventory",
    "purchasing",
    "operations",
    "hr",
    "projects",
    "zatca",
    "reports",
    "approvals",
    "admin"
];

const emptyCompanyForm = {
    company_legal_name: "",
    organization_name: "",
    organization_name_ar: "",
    commercial_registration_number: "",
    vat_number: "",
    country: "Saudi Arabia",
    city: "",
    address: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    business_activity: "",
    preferred_language: "en",
    currency: "SAR",
    fiscal_year_start_month: "1"
};

const emptyZatcaForm = {
    vat_registration_number: "",
    cr_number: "",
    organization_name: "",
    organization_name_ar: "",
    building_number: "",
    street_name: "",
    district: "",
    city: "",
    postal_code: "",
    device_name: "HORIZON_EGS_01",
    device_serial_number: "",
    invoice_type: "standard_tax_invoice",
    environment: "sandbox"
};

const getOrgName = (org) => org?.company_legal_name || org?.organization_name || org?.company_name || org?.trade_name;

const getActiveStep = (user, organization, zatcaConfig) => {
    if (!user?.email_verified) return "email";
    if (!organization || organization.onboarding_status === onboardingStatuses.COMPANY) return "company";
    if (!zatcaConfig || organization.onboarding_status === onboardingStatuses.ZATCA) return "zatca";
    if (organization.onboarding_status === onboardingStatuses.MODULES) return "modules";
    if (organization.onboarding_status === onboardingStatuses.READY) return "ready";
    return "company";
};

const isReadyTenant = (user, organization) =>
    Boolean(user?.email_verified && organization?.onboarding_status === onboardingStatuses.READY);

const upsertByField = async (entityName, field, value, payload) => {
    const existing = await matrixSales.entities[entityName].filter({ [field]: value });
    if (existing.length > 0) {
        return matrixSales.entities[entityName].update(existing[0].id, { ...existing[0], ...payload });
    }
    return matrixSales.entities[entityName].create(payload);
};

const ensureTenantUser = async (user, organization) => {
    return upsertByField("User", "email", user.email, {
        auth_user_id: user.id,
        email: user.email,
        full_name: user.full_name || user.email,
        role: "admin",
        status: "active",
        tenant_id: organization.id,
        organization_id: organization.id,
        organization_name: getOrgName(organization)
    });
};

const seedTenantDefaults = async (organization, user) => {
    localStorage.setItem("selected_organization_id", organization.id);
    const currentYear = new Date().getFullYear().toString().slice(-2);

    await ensureTenantUser(user, organization);

    await Promise.all(roleTemplates.map((role) => upsertByField("Role", "role_code", role.role_code, {
        ...role,
        status: "active",
        is_system_role: true,
        tenant_id: organization.id,
        organization_id: organization.id
    })));

    await Promise.all(documentSeriesTemplates.map(([documentType, prefix]) => upsertByField(
        "DocumentNumberSeries",
        "series_id",
        `${organization.id}-${prefix}-${currentYear}`,
        {
            series_id: `${organization.id}-${prefix}-${currentYear}`,
            document_type: documentType,
            prefix,
            branch_code: "ALL",
            fiscal_year: currentYear,
            current_number: 0,
            starting_number: 1,
            number_width: 6,
            format_pattern: "{PREFIX}-{BR}-{FY}-{NNNNNN}",
            status: "active",
            auto_generate: true,
            tenant_id: organization.id,
            organization_id: organization.id
        }
    )));

    await upsertByField("IntegrationConfig", "config_id", `modules-${organization.id}`, {
        config_id: `modules-${organization.id}`,
        integration_name: "standard_modules",
        enabled_modules: moduleDefaults,
        dashboard_tabs: moduleDefaults,
        status: "active",
        tenant_id: organization.id,
        organization_id: organization.id
    });
};

const createTenantSubscription = async (organization, planId) => {
    let plan = getSubscriptionPlan(planId);
    try {
        const dbPlans = await matrixSales.entities.SubscriptionPlan.filter({ plan_id: planId });
        if (dbPlans.length > 0) {
            plan = normalizeSubscriptionPlan(dbPlans[0]);
        }
    } catch (error) {
        console.warn("Using fallback plan during onboarding:", error);
    }
    const startDate = new Date();
    const trialEndDate = new Date(startDate);
    trialEndDate.setDate(trialEndDate.getDate() + (plan.trialDays || 14));
    const renewalDate = new Date(trialEndDate);
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const payload = {
        subscription_id: `SUB-${organization.id}`,
        tenant_id: organization.id,
        organization_id: organization.id,
        tenant_name: getOrgName(organization),
        plan: plan.id,
        plan_name: plan.name,
        status: "trialing",
        start_date: startDate.toISOString().slice(0, 10),
        trial_end_date: trialEndDate.toISOString().slice(0, 10),
        renewal_date: renewalDate.toISOString().slice(0, 10),
        billing_cycle: plan.billingCycle,
        monthly_price: plan.monthlyPrice,
        currency: plan.currency,
        limits: plan.limits,
        included_modules: plan.modules,
        support_level: plan.supportLevel
    };

    const existing = await matrixSales.entities.Subscription.filter({ subscription_id: payload.subscription_id });
    if (existing.length > 0) {
        return matrixSales.entities.Subscription.update(existing[0].id, { ...existing[0], ...payload });
    }
    return matrixSales.entities.Subscription.create(payload);
};

function OnboardingShell({ activeStep, children }) {
    const activeIndex = Math.max(0, steps.findIndex((step) => step.key === activeStep));
    const progress = activeStep === "ready" ? 100 : ((activeIndex + 1) / steps.length) * 100;

    return (
        <div className="min-h-screen bg-[#f5f7fb] px-4 py-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                        <BrandLogo imageClassName="h-12" />
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">Tenant onboarding</p>
                        <p className="text-xs text-slate-500">Complete setup before opening the workspace</p>
                    </div>
                </div>

                <Card className="border-slate-200 shadow-xl shadow-slate-200/60">
                    <CardContent className="space-y-5 p-5">
                        <Progress value={progress} />
                        <div className="grid gap-3 md:grid-cols-4">
                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const done = index < activeIndex || activeStep === "ready";
                                const current = step.key === activeStep;
                                return (
                                    <div
                                        key={step.key}
                                        className={`rounded-xl border p-3 ${current ? "border-[#24466f] bg-[#eef3f9]" : done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Icon className="h-4 w-4 text-[#24466f]" />}
                                            <span className="text-sm font-semibold text-slate-900">{step.label}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {children}
            </div>
        </div>
    );
}

function EmailVerificationStep() {
    const { user, resendVerificationEmail, logout, checkAppState } = useAuth();
    const { toast } = useToast();
    const [isSending, setIsSending] = useState(false);

    const resend = async () => {
        try {
            setIsSending(true);
            await resendVerificationEmail(user?.email);
            toast({ title: "Verification sent", description: "Check your inbox for the HORIZON verification link." });
        } catch (error) {
            toast({ title: "Unable to resend", description: error.message || "Try again later.", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#24466f]" />
                    Verify your email
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                    We need to verify <strong>{user?.email}</strong> before creating your tenant workspace.
                    Open the verification link from Supabase, then return here and refresh the status.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={resend} disabled={isSending} className="bg-[#24466f] hover:bg-[#193658]">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {isSending ? "Sending..." : "Resend verification"}
                    </Button>
                    <Button variant="outline" onClick={checkAppState}>Refresh status</Button>
                    <Button variant="ghost" onClick={() => logout()}>Logout</Button>
                </div>
            </CardContent>
        </Card>
    );
}

function CompanyStep({ user, organization, onSaved }) {
    const { toast } = useToast();
    const [formData, setFormData] = useState(() => ({ ...emptyCompanyForm, ...(organization || {}) }));
    const [isSaving, setIsSaving] = useState(false);

    const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

    const save = async (event) => {
        event.preventDefault();
        const required = ["company_legal_name", "commercial_registration_number", "vat_number", "country", "city", "address", "contact_email", "business_activity", "currency"];
        const missing = required.filter((field) => !formData[field]);
        if (missing.length > 0) {
            toast({ title: "Missing company data", description: "Complete all required company fields.", variant: "destructive" });
            return;
        }

        try {
            setIsSaving(true);
            const payload = {
                ...formData,
                organization_name: formData.organization_name || formData.company_legal_name,
                company_code: formData.company_code || `TEN-${Date.now()}`,
                owner_user_id: user.id,
                created_by_user_id: user.id,
                owner_email: user.email,
                created_by_email: user.email,
                admin_emails: [user.email],
                authorized_user_ids: [user.id],
                email_verified: true,
                status: "active",
                selected_plan: getStoredSignupPlan(),
                onboarding_status: onboardingStatuses.ZATCA
            };
            const saved = organization
                ? await matrixSales.entities.Organization.update(organization.id, payload)
                : await matrixSales.entities.Organization.create(payload);
            const tenantReady = await matrixSales.entities.Organization.update(saved.id, {
                ...saved,
                tenant_id: saved.id,
                organization_id: saved.id,
                onboarding_status: onboardingStatuses.ZATCA
            });
            localStorage.setItem("selected_organization_id", tenantReady.id);
            await createTenantSubscription(tenantReady, getStoredSignupPlan());
            window.dispatchEvent(new CustomEvent("matrixsales:organizations-changed"));
            toast({ title: "Company profile saved", description: "Continue with ZATCA setup." });
            onSaved?.();
        } catch (error) {
            toast({ title: "Unable to save company", description: error.message || "Please try again.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mandatory company data</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={save} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Company Legal Name *</Label>
                            <Input value={formData.company_legal_name} onChange={(e) => update("company_legal_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Commercial Registration Number *</Label>
                            <Input value={formData.commercial_registration_number} onChange={(e) => update("commercial_registration_number", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>VAT Number *</Label>
                            <Input value={formData.vat_number} onChange={(e) => update("vat_number", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Business Activity *</Label>
                            <Input value={formData.business_activity} onChange={(e) => update("business_activity", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Country *</Label>
                            <Input value={formData.country} onChange={(e) => update("country", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>City *</Label>
                            <Input value={formData.city} onChange={(e) => update("city", e.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Address *</Label>
                            <Textarea value={formData.address} onChange={(e) => update("address", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Email *</Label>
                            <Input type="email" value={formData.contact_email} onChange={(e) => update("contact_email", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Phone</Label>
                            <Input value={formData.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Preferred Language</Label>
                            <Select value={formData.preferred_language} onValueChange={(value) => update("preferred_language", value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="ar">Arabic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Currency *</Label>
                            <Select value={formData.currency} onValueChange={(value) => update("currency", value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SAR">SAR</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="AED">AED</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button type="submit" disabled={isSaving} className="bg-[#24466f] hover:bg-[#193658]">
                        {isSaving ? "Saving..." : "Save and continue"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function ZatcaStep({ organization, existingConfig, onSaved }) {
    const { toast } = useToast();
    const [formData, setFormData] = useState(() => ({
        ...emptyZatcaForm,
        organization_name: getOrgName(organization) || "",
        vat_registration_number: organization?.vat_number || "",
        cr_number: organization?.commercial_registration_number || "",
        city: organization?.city || "",
        ...(existingConfig || {})
    }));
    const [isSaving, setIsSaving] = useState(false);
    const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

    const save = async (event) => {
        event.preventDefault();
        const required = ["vat_registration_number", "cr_number", "organization_name", "building_number", "street_name", "district", "city", "device_serial_number"];
        const missing = required.filter((field) => !formData[field]);
        if (missing.length > 0 || !/^\d{15}$/.test(formData.vat_registration_number)) {
            toast({
                title: "ZATCA setup incomplete",
                description: "Complete all required fields and use a 15 digit VAT registration number.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSaving(true);
            localStorage.setItem("selected_organization_id", organization.id);
            const payload = {
                ...formData,
                config_id: `zatca-${organization.id}`,
                tenant_id: organization.id,
                organization_id: organization.id,
                organization_name: formData.organization_name,
                status: "active",
                onboarding_status: "ready"
            };
            const existing = await matrixSales.entities.ZATCAConfiguration.filter({ config_id: payload.config_id });
            if (existing.length > 0) {
                await matrixSales.entities.ZATCAConfiguration.update(existing[0].id, { ...existing[0], ...payload });
            } else {
                await matrixSales.entities.ZATCAConfiguration.create(payload);
            }
            await matrixSales.entities.Organization.update(organization.id, {
                ...organization,
                onboarding_status: onboardingStatuses.MODULES,
                zatca_setup_complete: true
            });
            toast({ title: "ZATCA setup saved", description: "Configure standard modules to finish onboarding." });
            onSaved?.();
        } catch (error) {
            toast({ title: "Unable to save ZATCA setup", description: error.message || "Please try again.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>ZATCA compliance setup</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={save} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>VAT Registration Number *</Label>
                            <Input maxLength={15} value={formData.vat_registration_number} onChange={(e) => update("vat_registration_number", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Commercial Registration *</Label>
                            <Input value={formData.cr_number} onChange={(e) => update("cr_number", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Organization Name *</Label>
                            <Input value={formData.organization_name} onChange={(e) => update("organization_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Organization Name Arabic</Label>
                            <Input dir="rtl" value={formData.organization_name_ar} onChange={(e) => update("organization_name_ar", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Building Number *</Label>
                            <Input value={formData.building_number} onChange={(e) => update("building_number", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Street Name *</Label>
                            <Input value={formData.street_name} onChange={(e) => update("street_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>District *</Label>
                            <Input value={formData.district} onChange={(e) => update("district", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>City *</Label>
                            <Input value={formData.city} onChange={(e) => update("city", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Postal Code</Label>
                            <Input maxLength={5} value={formData.postal_code} onChange={(e) => update("postal_code", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Environment</Label>
                            <Select value={formData.environment} onValueChange={(value) => update("environment", value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sandbox">Sandbox</SelectItem>
                                    <SelectItem value="simulation">Simulation</SelectItem>
                                    <SelectItem value="production">Production</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>EGS Device Name *</Label>
                            <Input value={formData.device_name} onChange={(e) => update("device_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>EGS Device Serial Number *</Label>
                            <Input value={formData.device_serial_number} onChange={(e) => update("device_serial_number", e.target.value)} placeholder="1-HORIZON|2-WEB|3-001" />
                        </div>
                    </div>
                    <Button type="submit" disabled={isSaving} className="bg-[#24466f] hover:bg-[#193658]">
                        {isSaving ? "Saving..." : "Save ZATCA setup"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function ModulesStep({ user, organization, onSaved }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const finish = async () => {
        try {
            setIsSaving(true);
            await seedTenantDefaults(organization, user);
            await matrixSales.entities.Organization.update(organization.id, {
                ...organization,
                onboarding_status: onboardingStatuses.READY,
                modules_configuration_complete: true,
                enabled_modules: moduleDefaults,
                onboarding_completed_at: new Date().toISOString()
            });
            window.dispatchEvent(new CustomEvent("matrixsales:organizations-changed"));
            toast({ title: "Workspace ready", description: "Your tenant setup is complete." });
            onSaved?.();
        } catch (error) {
            toast({ title: "Unable to configure modules", description: error.message || "Please try again.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    Standard modules configuration
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                    HORIZON will seed default roles, tenant-specific document numbering, reports, dashboards,
                    and standard modules for <strong>{getOrgName(organization)}</strong>.
                </p>
                <div className="flex flex-wrap gap-2">
                    {moduleDefaults.map((moduleName) => (
                        <span key={moduleName} className="rounded-full bg-[#eef3f9] px-3 py-1 text-sm font-semibold text-[#24466f]">
                            {moduleName}
                        </span>
                    ))}
                </div>
                <Button onClick={finish} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isSaving ? "Configuring..." : "Configure modules and open Dashboard"}
                </Button>
            </CardContent>
        </Card>
    );
}

export function useTenantReadiness() {
    const { user, isAuthenticated } = useAuth();
    const query = useQuery({
        queryKey: ["tenant-onboarding", user?.id, user?.email],
        enabled: Boolean(isAuthenticated && user?.email_verified),
        queryFn: async () => {
            const organizations = await matrixSales.entities.Organization.list();
            const selectedId = localStorage.getItem("selected_organization_id");
            const organization = organizations.find((org) => org.id === selectedId) || organizations[0] || null;
            if (organization) {
                localStorage.setItem("selected_organization_id", organization.id);
            }
            const zatcaConfigs = organization
                ? await matrixSales.entities.ZATCAConfiguration.filter({ organization_id: organization.id }).catch(() => [])
                : [];
            return {
                organization,
                zatcaConfig: zatcaConfigs[0] || null
            };
        },
        initialData: { organization: null, zatcaConfig: null }
    });

    const activeStep = getActiveStep(user, query.data?.organization, query.data?.zatcaConfig);
    return {
        ...query,
        activeStep,
        ready: isReadyTenant(user, query.data?.organization)
    };
}

export default function TenantOnboardingWizard({ onComplete }) {
    const { user } = useAuth();
    const readiness = useTenantReadiness();
    const queryClient = useQueryClient();

    const refresh = async () => {
        await queryClient.invalidateQueries({ queryKey: ["tenant-onboarding"] });
        await readiness.refetch();
    };

    const activeStep = useMemo(() => readiness.activeStep, [readiness.activeStep]);

    React.useEffect(() => {
        if (activeStep === "ready") {
            onComplete?.();
        }
    }, [activeStep, onComplete]);

    if (readiness.isLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-[#f5f7fb]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#24466f]" />
            </div>
        );
    }

    if (activeStep === "ready") return null;

    return (
        <OnboardingShell activeStep={activeStep}>
            {activeStep === "email" && <EmailVerificationStep />}
            {activeStep === "company" && (
                <CompanyStep user={user} organization={readiness.data?.organization} onSaved={refresh} />
            )}
            {activeStep === "zatca" && (
                <ZatcaStep organization={readiness.data?.organization} existingConfig={readiness.data?.zatcaConfig} onSaved={refresh} />
            )}
            {activeStep === "modules" && (
                <ModulesStep user={user} organization={readiness.data?.organization} onSaved={() => {
                    refresh();
                    onComplete?.();
                }} />
            )}
        </OnboardingShell>
    );
}
