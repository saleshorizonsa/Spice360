import React, { useEffect, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Building2, Globe, CreditCard, Phone, Save, RefreshCw, Image } from "lucide-react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

const COUNTRIES = ["Sri Lanka", "Saudi Arabia", "UAE", "Kuwait", "Bahrain", "Oman", "Qatar", "Egypt", "Jordan", "Lebanon", "Other"];
const CURRENCIES = [
    { value: "LKR", label: "LKR — Sri Lanka Rupee" },
    { value: "LKR", label: "SAR — Saudi Riyal" },
    { value: "USD", label: "USD — US Dollar" },
    { value: "EUR", label: "EUR — Euro" },
    { value: "AED", label: "AED — UAE Dirham" },
    { value: "KWD", label: "KWD — Kuwaiti Dinar" },
    { value: "GBP", label: "GBP — British Pound" },
];
const LANGUAGES = [
    { value: "en", label: "English" },
];
const FISCAL_MONTHS = [
    { value: "1", label: "January" }, { value: "2", label: "February" },
    { value: "3", label: "March" }, { value: "4", label: "April" },
    { value: "5", label: "May" }, { value: "6", label: "June" },
    { value: "7", label: "July" }, { value: "8", label: "August" },
    { value: "9", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
];

const EMPTY = {
    organization_name: "",
    company_legal_name: "",
    vat_number: "",
    tin_number: "",
    cr_number: "",
    country: "Sri Lanka",
    city: "",
    address: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    logo_url: "",
    currency: "LKR",
    preferred_language: "en",
    fiscal_year_start_month: "1",
    bank_name: "",
    bank_account_number: "",
    bank_iban: "",
    bank_swift: "",
    business_activity: "",
};

function Section({ title, icon: Icon, children }) {
    return (
        <Card className="border-slate-200">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <Icon className="h-4 w-4 text-blue-600" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
            </CardContent>
        </Card>
    );
}

function Field({ label, required, children, fullWidth }) {
    return (
        <div className={`space-y-1.5${fullWidth ? " sm:col-span-2" : ""}`}>
            <Label className="text-sm font-medium text-slate-700">
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
            </Label>
            {children}
        </div>
    );
}

export default function OrganizationSettings() {
    const { currentOrg, loading } = useOrganization();
    const { toast } = useToast();
    const [form, setForm] = useState(EMPTY);
    const [dirty, setDirty] = useState(false);
    useUnsavedChangesWarning(dirty);

    useEffect(() => {
        if (currentOrg) {
            setForm({ ...EMPTY, ...currentOrg });
            setDirty(false);
        }
    }, [currentOrg]);

    const set = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target ? e.target.value : e }));
        setDirty(true);
    };

    const saveMutation = useMutation({
        mutationFn: (data) => matrixSales.entities.Organization.update(currentOrg.id, data),
        onSuccess: () => {
            toast({ title: "Saved", description: "Organization settings updated successfully." });
            setDirty(false);
            window.dispatchEvent(new CustomEvent("matrixsales:organizations-changed"));
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message || "Failed to save settings.", variant: "destructive" });
        }
    });

    const handleSave = (e) => {
        e.preventDefault();
        if (!currentOrg?.id) {
            toast({ title: "No organization", description: "Create an organization first.", variant: "destructive" });
            return;
        }
        if (!form.organization_name?.trim()) {
            toast({ title: "Required", description: "Organization name is required.", variant: "destructive" });
            return;
        }
        saveMutation.mutate(form);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!currentOrg) {
        return (
            <div className="p-8 text-center text-slate-500">
                No organization found. Complete company onboarding first.
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Company details used on invoices, purchase orders, and printed documents.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={!dirty || saveMutation.isPending}
                    className="shrink-0 bg-blue-700 hover:bg-blue-800 text-white gap-2"
                >
                    {saveMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Save Changes
                </Button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
                {/* Company Identity */}
                <Section title="Company Identity" icon={Building2}>
                    <Field label="Organization Name" required>
                        <Input value={form.organization_name} onChange={set("organization_name")} placeholder="ACME Trading Co." />
                    </Field>
                    <Field label="Legal Company Name" fullWidth>
                        <Input value={form.company_legal_name} onChange={set("company_legal_name")} placeholder="ACME Trading Company Ltd." />
                    </Field>
                    <Field label="VAT Registration Number (IRD)">
                        <Input value={form.vat_number} onChange={set("vat_number")} placeholder="e.g. 000-000-000" />
                    </Field>
                    <Field label="Tax Identification Number (TIN)">
                        <Input value={form.tin_number} onChange={set("tin_number")} placeholder="e.g. 000000000" />
                    </Field>
                    <Field label="Business Registration Number (BRC)">
                        <Input value={form.cr_number} onChange={set("cr_number")} placeholder="e.g. PV/00000" />
                    </Field>
                    <Field label="Business Activity" fullWidth>
                        <Input value={form.business_activity} onChange={set("business_activity")} placeholder="Trading, Manufacturing, Services…" />
                    </Field>
                </Section>

                {/* Address & Contact */}
                <Section title="Address & Contact" icon={Phone}>
                    <Field label="Country">
                        <Select value={form.country} onValueChange={set("country")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="City">
                        <Input value={form.city} onChange={set("city")} placeholder="Colombo" />
                    </Field>
                    <Field label="Address" fullWidth>
                        <Textarea value={form.address} onChange={set("address")} placeholder="Street name, district, postal code…" rows={2} />
                    </Field>
                    <Field label="Contact Name">
                        <Input value={form.contact_name} onChange={set("contact_name")} placeholder="John Smith" />
                    </Field>
                    <Field label="Contact Email">
                        <Input type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="info@company.com" />
                    </Field>
                    <Field label="Contact Phone">
                        <Input value={form.contact_phone} onChange={set("contact_phone")} placeholder="+94 11 234 5678" />
                    </Field>
                    <Field label="Website">
                        <Input value={form.website} onChange={set("website")} placeholder="https://www.company.com" />
                    </Field>
                </Section>

                {/* Branding */}
                <Section title="Branding" icon={Image}>
                    <Field label="Logo URL" fullWidth>
                        <Input value={form.logo_url} onChange={set("logo_url")} placeholder="https://your-cdn.com/logo.png" />
                    </Field>
                    {form.logo_url && (
                        <div className="sm:col-span-2 flex items-center gap-4">
                            <img
                                src={form.logo_url}
                                alt="Logo preview"
                                className="h-12 max-w-[200px] object-contain rounded border border-slate-200 p-1"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                            <p className="text-xs text-slate-500">Logo shown on printed documents and invoices.</p>
                        </div>
                    )}
                </Section>

                {/* Localization */}
                <Section title="Localization & Currency" icon={Globe}>
                    <Field label="Default Currency">
                        <Select value={form.currency} onValueChange={set("currency")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Preferred Language">
                        <Select value={form.preferred_language} onValueChange={set("preferred_language")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Fiscal Year Start Month">
                        <Select value={String(form.fiscal_year_start_month)} onValueChange={set("fiscal_year_start_month")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {FISCAL_MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                </Section>

                {/* Banking */}
                <Section title="Bank Details (for documents)" icon={CreditCard}>
                    <Field label="Bank Name">
                        <Input value={form.bank_name} onChange={set("bank_name")} placeholder="Bank of Ceylon" />
                    </Field>
                    <Field label="Account Number">
                        <Input value={form.bank_account_number} onChange={set("bank_account_number")} placeholder="1234567890" />
                    </Field>
                    <Field label="IBAN / Account Reference">
                        <Input value={form.bank_iban} onChange={set("bank_iban")} placeholder="LK000000000000000000" />
                    </Field>
                    <Field label="SWIFT / BIC">
                        <Input value={form.bank_swift} onChange={set("bank_swift")} placeholder="BCEYLKLX" />
                    </Field>
                </Section>

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        disabled={!dirty || saveMutation.isPending}
                        className="bg-blue-700 hover:bg-blue-800 text-white gap-2"
                    >
                        {saveMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    );
}
