import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileText, Calculator, Building2, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import DataTable from "@/components/erp/DataTable";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { postJournalEntry } from "@/components/utils/journalService";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import { useGLAccounts } from "@/hooks/useGLAccounts";

const fmt = (n) => `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── APIT progressive tax calculation ──────────────────────────────────────────
const APIT_BRACKETS = [
    { from: 0,       to: 1200000,  rate: 0,  taxOnLower: 0       },
    { from: 1200000, to: 1800000,  rate: 6,  taxOnLower: 0       },
    { from: 1800000, to: 3000000,  rate: 12, taxOnLower: 36000   },
    { from: 3000000, to: 4200000,  rate: 18, taxOnLower: 180000  },
    { from: 4200000, to: 6000000,  rate: 24, taxOnLower: 396000  },
    { from: 6000000, to: Infinity, rate: 36, taxOnLower: 828000  },
];

export function calculateAPIT(annualIncome) {
    if (annualIncome <= 1200000) return 0;
    for (const b of APIT_BRACKETS) {
        if (annualIncome <= b.to) {
            return b.taxOnLower + (annualIncome - b.from) * (b.rate / 100);
        }
    }
    const last = APIT_BRACKETS[APIT_BRACKETS.length - 1];
    return last.taxOnLower + (annualIncome - last.from) * (last.rate / 100);
}

export function calculateMonthlyAPIT(monthlyGross) {
    return calculateAPIT(monthlyGross * 12) / 12;
}

// ── WHT Form ──────────────────────────────────────────────────────────────────
function WHTForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const taxConfig = useTaxConfig();
    const gl = useGLAccounts();

    const WHT_RATES = {
        dividends:     taxConfig.wht_dividends,
        interest:      taxConfig.wht_interest,
        rent:          taxConfig.wht_rent,
        service_fees:  taxConfig.wht_service_fees,
        technical_fees: taxConfig.wht_service_fees, // no separate config key; mirrors service_fees
        commissions:   taxConfig.wht_commissions,
        construction:  taxConfig.wht_construction,
        royalties:     taxConfig.wht_service_fees,  // no separate config key; mirrors service_fees
    };

    const [form, setForm] = useState({
        wht_number: item?.wht_number || `WHT-${Date.now()}`,
        period_month: item?.period_month || new Date().toISOString().substring(0, 7),
        payee_name: item?.payee_name || "",
        payee_tin: item?.payee_tin || "",
        payment_type: item?.payment_type || "service_fees",
        gross_payment: item?.gross_payment || 0,
        wht_rate: item?.wht_rate ?? taxConfig.wht_service_fees,
        wht_amount: item?.wht_amount || 0,
        net_payment: item?.net_payment || 0,
        due_date: item?.due_date || "",
        status: item?.status || "draft",
        notes: item?.notes || "",
    });

    const handlePaymentTypeChange = (val) => {
        const rate = WHT_RATES[val] ?? taxConfig.wht_service_fees;
        const gross = parseFloat(form.gross_payment) || 0;
        const wht = (gross * rate) / 100;
        setForm(f => ({ ...f, payment_type: val, wht_rate: rate, wht_amount: wht, net_payment: gross - wht }));
    };

    const handleGrossChange = (val) => {
        const gross = parseFloat(val) || 0;
        const wht = (gross * form.wht_rate) / 100;
        setForm(f => ({ ...f, gross_payment: gross, wht_amount: wht, net_payment: gross - wht }));
    };

    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.SLWHTReturn.update(item.id, data)
            : matrixSales.entities.SLWHTReturn.create(data),
        onSuccess: async (saved) => {
            if (saved?.status === "submitted" && !saved.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: gl.apit_payable,    account_name: "WHT Payable (IRD)",      debit: 0, credit: saved.wht_amount },
                            { account_code: gl.wht_net_payable, account_name: "Trade Payables",         debit: 0, credit: saved.net_payment },
                            { account_code: gl.wht_expense,     account_name: "Gross Payment Expense",  debit: saved.gross_payment, credit: 0 },
                        ].filter(l => Number(l.debit || l.credit || 0) > 0),
                        referenceType: "wht",
                        referenceId: saved.wht_number,
                        description: `WHT on ${saved.payment_type} — ${saved.payee_name}`,
                        entryDate: `${saved.period_month}-01`,
                        entryType: "wht",
                        orgId: currentOrg?.id,
                        area: "gl",
                    });
                    await matrixSales.entities.SLWHTReturn.update(saved.id, { ...saved, gl_posted: true });
                } catch {}
            }
            queryClient.invalidateQueries({ queryKey: ["slWHT"] });
            toast({ title: "Saved", description: "WHT record saved." });
            onClose();
        },
    });

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Withholding Tax (WHT)</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>WHT Number</Label><Input value={form.wht_number} disabled /></div>
                        <div><Label>Period (Month) *</Label><Input type="month" value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))} required /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Payee Name *</Label><Input value={form.payee_name} onChange={e => setForm(f => ({ ...f, payee_name: e.target.value }))} required /></div>
                        <div><Label>Payee TIN</Label><Input value={form.payee_tin} onChange={e => setForm(f => ({ ...f, payee_tin: e.target.value }))} placeholder="Optional" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payment Type *</Label>
                            <Select value={form.payment_type} onValueChange={handlePaymentTypeChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="service_fees">Service Fees (14%)</SelectItem>
                                    <SelectItem value="technical_fees">Technical Fees (14%)</SelectItem>
                                    <SelectItem value="dividends">Dividends (14%)</SelectItem>
                                    <SelectItem value="interest">Interest (14%)</SelectItem>
                                    <SelectItem value="rent">Rent (14%)</SelectItem>
                                    <SelectItem value="royalties">Royalties (14%)</SelectItem>
                                    <SelectItem value="commissions">Commissions (5%)</SelectItem>
                                    <SelectItem value="construction">Construction Work (2.5%)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>WHT Rate (%)</Label><Input type="number" value={form.wht_rate} disabled /></div>
                    </div>
                    <div>
                        <Label>Gross Payment (LKR) *</Label>
                        <Input type="number" step="0.01" value={form.gross_payment} onChange={e => handleGrossChange(e.target.value)} required />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span>Gross Payment:</span><span className="font-semibold">{fmt(form.gross_payment)}</span></div>
                        <div className="flex justify-between text-red-700"><span>WHT Deducted ({form.wht_rate}%):</span><span className="font-semibold">− {fmt(form.wht_amount)}</span></div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Net to Payee:</span><span className="text-green-700">{fmt(form.net_payment)}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>IRD Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                        <div>
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="submitted">Submitted</SelectItem>
                                    <SelectItem value="paid">Paid to IRD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Save WHT</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── SSCL Form ─────────────────────────────────────────────────────────────────
// Activity fractions per SSCL Act: liable_turnover = gross * fraction; SSCL = liable * rate/100
const SSCL_FRACTIONS = {
    importation:      { label: "Importation",                               fraction: 1.00 },
    manufacture:      { label: "Manufacture / Production",                  fraction: 0.85 },
    distributor:      { label: "Sale by Registered Distributor / Producer", fraction: 0.25 },
    wholesale_retail: { label: "Wholesale / Retail",                        fraction: 0.50 },
};

function SSCLForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const taxConfig = useTaxConfig();
    const ssclRate = taxConfig.sscl_rate;
    const threshold = taxConfig.sscl_threshold_quarterly;

    const defaultActivity = item?.activity_type || "manufacture";

    const [form, setForm] = useState({
        sscl_number:      item?.sscl_number || `SSCL-${Date.now()}`,
        quarter:          item?.quarter || "",
        activity_type:    defaultActivity,
        taxable_turnover: item?.taxable_turnover || 0,    // gross turnover input
        exempt_turnover:  item?.exempt_turnover || 0,
        total_turnover:   item?.total_turnover || 0,
        liable_fraction:  item?.liable_fraction ?? SSCL_FRACTIONS[defaultActivity].fraction,
        liable_turnover:  item?.liable_turnover || 0,
        sscl_amount:      item?.sscl_amount || 0,
        due_date:         item?.due_date || "",
        status:           item?.status || "draft",
    });

    const recalc = (gross, exempt, activityType) => {
        const total = gross + exempt;
        const fraction = SSCL_FRACTIONS[activityType]?.fraction ?? 1.0;
        const liableTurnover = gross * fraction;
        const sscl = liableTurnover * (ssclRate / 100);
        setForm(f => ({
            ...f,
            taxable_turnover: gross,
            exempt_turnover:  exempt,
            total_turnover:   total,
            activity_type:    activityType,
            liable_fraction:  fraction,
            liable_turnover:  liableTurnover,
            sscl_amount:      sscl,
        }));
    };

    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.SLSSCLReturn.update(item.id, data)
            : matrixSales.entities.SLSSCLReturn.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["slSSCL"] });
            toast({ title: "Saved", description: "SSCL return saved." });
            onClose();
        },
    });

    const aboveThreshold = threshold > 0 && form.liable_turnover >= threshold;
    const currentFraction = SSCL_FRACTIONS[form.activity_type] ?? SSCL_FRACTIONS.manufacture;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Social Security Contribution Levy (SSCL)</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>SSCL Number</Label><Input value={form.sscl_number} disabled /></div>
                        <div><Label>Quarter *</Label><Input value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))} placeholder="e.g. 2024-Q1" required /></div>
                    </div>

                    <div>
                        <Label>Activity Type *</Label>
                        <Select value={form.activity_type} onValueChange={val => recalc(form.taxable_turnover, form.exempt_turnover, val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(SSCL_FRACTIONS).map(([key, { label, fraction }]) => (
                                    <SelectItem key={key} value={key}>
                                        {label} — {(fraction * 100).toFixed(0)}% liable
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Gross Turnover (LKR) *</Label>
                            <Input type="number" step="0.01" value={form.taxable_turnover}
                                onChange={e => recalc(parseFloat(e.target.value) || 0, form.exempt_turnover, form.activity_type)} />
                        </div>
                        <div>
                            <Label>Exempt Turnover (LKR)</Label>
                            <Input type="number" step="0.01" value={form.exempt_turnover}
                                onChange={e => recalc(form.taxable_turnover, parseFloat(e.target.value) || 0, form.activity_type)} />
                        </div>
                    </div>

                    {/* Auditable breakdown */}
                    <div className={`rounded-lg p-4 border space-y-2 text-sm ${aboveThreshold ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
                        {threshold > 0 && !aboveThreshold && (
                            <div className="flex items-center gap-2 text-green-700 font-semibold">
                                <CheckCircle2 className="w-4 h-4" />
                                Liable turnover below registration threshold — SSCL not applicable
                            </div>
                        )}
                        {aboveThreshold && (
                            <div className="flex items-center gap-2 text-orange-700 font-semibold mb-1">
                                <AlertCircle className="w-4 h-4" />
                                SSCL applies — liable turnover exceeds registration threshold
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>Gross Turnover:</span>
                            <span className="font-semibold">{fmt(form.taxable_turnover)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Liable Fraction ({currentFraction.label}):</span>
                            <span className="font-semibold">{(currentFraction.fraction * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Liable Turnover:</span>
                            <span className="font-semibold">{fmt(form.liable_turnover)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>SSCL @ {ssclRate}%:</span>
                            <span className="text-orange-700">{fmt(form.sscl_amount)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                        <div>
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="submitted">Submitted to IRD</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Save SSCL Return</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── VAT Return Form ───────────────────────────────────────────────────────────
function SLVATReturnForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const VAT_RATE = 18;

    const [form, setForm] = useState({
        vat_return_number: item?.vat_return_number || `SLVAT-${Date.now()}`,
        period_month: item?.period_month || new Date().toISOString().substring(0, 7),
        standard_rated_supplies: item?.standard_rated_supplies || 0,
        zero_rated_exports: item?.zero_rated_exports || 0,
        exempt_supplies: item?.exempt_supplies || 0,
        output_vat: item?.output_vat || 0,
        input_vat_purchases: item?.input_vat_purchases || 0,
        input_vat_imports: item?.input_vat_imports || 0,
        total_input_vat: item?.total_input_vat || 0,
        net_vat_payable: item?.net_vat_payable || 0,
        due_date: item?.due_date || "",
        status: item?.status || "draft",
    });

    const recalc = (updates) => {
        const next = { ...form, ...updates };
        const outputVAT = (parseFloat(next.standard_rated_supplies) || 0) * (VAT_RATE / 100);
        const totalInput = (parseFloat(next.input_vat_purchases) || 0) + (parseFloat(next.input_vat_imports) || 0);
        const netPayable = outputVAT - totalInput;
        setForm({ ...next, output_vat: outputVAT, total_input_vat: totalInput, net_vat_payable: netPayable });
    };

    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.SLVATReturn.update(item.id, data)
            : matrixSales.entities.SLVATReturn.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["slVAT"] });
            toast({ title: "Saved", description: "VAT return saved." });
            onClose();
        },
    });

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>VAT Return — Sri Lanka (18%)</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Return Number</Label><Input value={form.vat_return_number} disabled /></div>
                        <div><Label>Period (Month) *</Label><Input type="month" value={form.period_month} onChange={e => recalc({ period_month: e.target.value })} required /></div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-blue-900">Supplies (Output VAT)</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Standard Rated (18%) — LKR</Label>
                                <Input type="number" step="0.01" value={form.standard_rated_supplies}
                                    onChange={e => recalc({ standard_rated_supplies: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label>Zero Rated Exports (0%) — LKR</Label>
                                <Input type="number" step="0.01" value={form.zero_rated_exports}
                                    onChange={e => recalc({ zero_rated_exports: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label>Exempt Supplies — LKR</Label>
                                <Input type="number" step="0.01" value={form.exempt_supplies}
                                    onChange={e => recalc({ exempt_supplies: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t">
                            <span>Output VAT @ 18%:</span>
                            <span className="text-blue-700">{fmt(form.output_vat)}</span>
                        </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-green-900">Input VAT Claimable</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>VAT on Purchases — LKR</Label>
                                <Input type="number" step="0.01" value={form.input_vat_purchases}
                                    onChange={e => recalc({ input_vat_purchases: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label>VAT on Imports — LKR</Label>
                                <Input type="number" step="0.01" value={form.input_vat_imports}
                                    onChange={e => recalc({ input_vat_imports: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t">
                            <span>Total Input VAT:</span>
                            <span className="text-green-700">− {fmt(form.total_input_vat)}</span>
                        </div>
                    </div>

                    <div className={`rounded-lg p-4 border text-lg font-bold flex justify-between ${form.net_vat_payable >= 0 ? "bg-red-50 border-red-300 text-red-700" : "bg-green-50 border-green-300 text-green-700"}`}>
                        <span>{form.net_vat_payable >= 0 ? "Net VAT Payable to IRD:" : "VAT Refund Claimable:"}</span>
                        <span>{fmt(Math.abs(form.net_vat_payable))}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                        <div>
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="submitted">Submitted to IRD</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="refund_claimed">Refund Claimed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Save VAT Return</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── APIT Summary Card ─────────────────────────────────────────────────────────
function APISummary() {
    const [gross, setGross] = useState(0);
    const monthly = calculateMonthlyAPIT(gross);
    const annual = calculateAPIT(gross * 12);
    const epf = gross * 0.08;
    const etf = gross * 0.03;
    const net = gross - monthly - epf;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-emerald-600" />
                    APIT Calculator (Advanced Personal Income Tax)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                        <Label>Monthly Gross (LKR)</Label>
                        <Input type="number" step="1000" value={gross}
                            onChange={e => setGross(parseFloat(e.target.value) || 0)} placeholder="Enter monthly salary" />
                    </div>
                    <div>
                        <Label>Annual Income (LKR)</Label>
                        <Input value={`LKR ${(gross * 12).toLocaleString()}`} disabled />
                    </div>
                </div>

                {gross > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                            <h4 className="font-semibold text-slate-800">Monthly Deductions</h4>
                            <div className="flex justify-between"><span>APIT (income tax):</span><span className="font-semibold text-red-600">− {fmt(monthly)}</span></div>
                            <div className="flex justify-between"><span>EPF (8% employee):</span><span className="font-semibold text-amber-600">− {fmt(epf)}</span></div>
                            <div className="flex justify-between border-t pt-2 font-bold"><span>Net Take-Home:</span><span className="text-green-700">{fmt(net)}</span></div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                            <h4 className="font-semibold text-slate-800">Employer Cost</h4>
                            <div className="flex justify-between"><span>Gross Salary:</span><span>{fmt(gross)}</span></div>
                            <div className="flex justify-between"><span>EPF (12% employer):</span><span className="font-semibold text-blue-600">+ {fmt(gross * 0.12)}</span></div>
                            <div className="flex justify-between"><span>ETF (3% employer):</span><span className="font-semibold text-blue-600">+ {fmt(etf)}</span></div>
                            <div className="flex justify-between border-t pt-2 font-bold"><span>Total Employer Cost:</span><span>{fmt(gross + gross * 0.12 + etf)}</span></div>
                        </div>
                    </div>
                )}

                <div className="mt-4">
                    <h4 className="font-semibold text-slate-700 mb-2">APIT Tax Brackets (Annual Income)</h4>
                    <div className="overflow-x-auto">
                        <table className="text-xs w-full border-collapse">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="text-left p-2 border">Annual Income Range (LKR)</th>
                                    <th className="text-right p-2 border">Tax Rate</th>
                                    <th className="text-right p-2 border">Tax on Lower Bracket</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ["0 – 1,200,000", "Nil", "–"],
                                    ["1,200,001 – 1,800,000", "6%", "–"],
                                    ["1,800,001 – 3,000,000", "12%", "36,000"],
                                    ["3,000,001 – 4,200,000", "18%", "180,000"],
                                    ["4,200,001 – 6,000,000", "24%", "396,000"],
                                    ["Above 6,000,000", "36%", "828,000"],
                                ].map(([range, rate, base]) => (
                                    <tr key={range} className="border-b hover:bg-slate-50">
                                        <td className="p-2 border">{range}</td>
                                        <td className="p-2 border text-right font-semibold text-red-600">{rate}</td>
                                        <td className="p-2 border text-right">{base}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SriLankaTax() {
    const [activeTab, setActiveTab] = useState("vat");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const taxConfig = useTaxConfig();

    const { data: whtRecords = [] } = useQuery({
        queryKey: ["slWHT"],
        queryFn: () => matrixSales.entities.SLWHTReturn.list("-created_at"),
        initialData: [],
    });

    const { data: ssclRecords = [] } = useQuery({
        queryKey: ["slSSCL"],
        queryFn: () => matrixSales.entities.SLSSCLReturn.list("-created_at"),
        initialData: [],
    });

    const { data: vatRecords = [] } = useQuery({
        queryKey: ["slVAT"],
        queryFn: () => matrixSales.entities.SLVATReturn.list("-created_at"),
        initialData: [],
    });

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Deleted" }); },
    });

    const getBadge = (val) => {
        const colors = {
            draft: "bg-gray-100 text-gray-700",
            submitted: "bg-blue-100 text-blue-700",
            paid: "bg-green-100 text-green-700",
            refund_claimed: "bg-purple-100 text-purple-700",
        };
        return colors[val] || "bg-gray-100 text-gray-700";
    };

    const whtColumns = [
        { header: "WHT #", key: "wht_number" },
        { header: "Period", key: "period_month" },
        { header: "Payee", key: "payee_name" },
        { header: "Type", key: "payment_type" },
        { header: "Rate", key: "wht_rate", render: v => `${v}%` },
        { header: "Gross (LKR)", key: "gross_payment", render: v => Number(v || 0).toLocaleString() },
        { header: "WHT (LKR)", key: "wht_amount", render: v => Number(v || 0).toLocaleString() },
        { header: "Status", key: "status", isBadge: true },
    ];

    const ssclColumns = [
        { header: "SSCL #", key: "sscl_number" },
        { header: "Quarter", key: "quarter" },
        { header: "Taxable Turnover", key: "taxable_turnover", render: v => Number(v || 0).toLocaleString() },
        { header: `SSCL @ ${taxConfig.sscl_rate}%`, key: "sscl_amount", render: v => Number(v || 0).toLocaleString() },
        { header: "Status", key: "status", isBadge: true },
    ];

    const vatColumns = [
        { header: "Return #", key: "vat_return_number" },
        { header: "Period", key: "period_month" },
        { header: "Std Rated Supplies", key: "standard_rated_supplies", render: v => Number(v || 0).toLocaleString() },
        { header: "Output VAT", key: "output_vat", render: v => Number(v || 0).toLocaleString() },
        { header: "Input VAT", key: "total_input_vat", render: v => Number(v || 0).toLocaleString() },
        { header: "Net Payable", key: "net_vat_payable", render: v => Number(v || 0).toLocaleString() },
        { header: "Status", key: "status", isBadge: true },
    ];

    const handleCreate = () => { setEditingItem(null); setShowDialog(true); };
    const handleEdit = (item) => { setEditingItem(item); setShowDialog(true); };
    const handleClose = () => { setShowDialog(false); setEditingItem(null); };

    const getEntityName = () => {
        if (activeTab === "wht") return "SLWHTReturn";
        if (activeTab === "sscl") return "SLSSCLReturn";
        if (activeTab === "vat") return "SLVATReturn";
        return null;
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-8 h-8 text-emerald-600" />
                    Sri Lanka Taxation
                </h1>
                <p className="text-gray-600 mt-1">VAT (18%), WHT, SSCL ({taxConfig.sscl_rate}%), APIT, EPF/ETF compliance for Sri Lanka IRD</p>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                        <p className="text-xs text-gray-500">VAT Rate</p>
                        <p className="text-2xl font-bold text-blue-700">18%</p>
                        <p className="text-xs text-gray-500">Standard supply</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-4">
                        <p className="text-xs text-gray-500">EPF / ETF</p>
                        <p className="text-2xl font-bold text-emerald-700">20% + 3%</p>
                        <p className="text-xs text-gray-500">Employee + Employer</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="pt-4">
                        <p className="text-xs text-gray-500">SSCL Rate</p>
                        <p className="text-2xl font-bold text-orange-700">{taxConfig.sscl_rate}%</p>
                        <p className="text-xs text-gray-500">Liable turnover</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4">
                        <p className="text-xs text-gray-500">WHT (Service Fees)</p>
                        <p className="text-2xl font-bold text-red-700">{taxConfig.wht_service_fees}%</p>
                        <p className="text-xs text-gray-500">On payments &gt; LKR 50K/mo</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                    <TabsTrigger value="vat">VAT Returns</TabsTrigger>
                    <TabsTrigger value="wht">WHT</TabsTrigger>
                    <TabsTrigger value="sscl">SSCL</TabsTrigger>
                    <TabsTrigger value="apit">APIT Calculator</TabsTrigger>
                </TabsList>

                <TabsContent value="vat">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                VAT Returns (18% Standard Rate)
                            </CardTitle>
                            <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="w-4 h-4 mr-2" />New VAT Return
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                                VAT at 18% applies on domestic supplies. Exports are zero-rated (0%). Monthly VAT returns due by the 30th of the following month.
                            </div>
                            <DataTable data={vatRecords} columns={vatColumns} getBadgeColor={getBadge}
                                onEdit={handleEdit} onDelete={(item) => {
                                    if (confirm("Delete this VAT return?")) deleteMutation.mutate({ entity: "SLVATReturn", id: item.id });
                                }} exportFileName="sl-vat-returns" />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="wht">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Withholding Tax (WHT)
                            </CardTitle>
                            <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="w-4 h-4 mr-2" />New WHT Record
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                {[
                                    ["Dividends", "14%"], ["Interest", "14%"], ["Rent", "14%"],
                                    ["Service Fees", "14%"], ["Technical Fees", "14%"], ["Royalties", "14%"],
                                    ["Commissions", "5%"], ["Construction", "2.5%"],
                                ].map(([type, rate]) => (
                                    <div key={type} className="bg-slate-50 border rounded p-2 flex justify-between">
                                        <span className="text-gray-600">{type}</span>
                                        <span className="font-bold text-red-600">{rate}</span>
                                    </div>
                                ))}
                            </div>
                            <DataTable data={whtRecords} columns={whtColumns} getBadgeColor={getBadge}
                                onEdit={handleEdit} onDelete={(item) => {
                                    if (confirm("Delete this WHT record?")) deleteMutation.mutate({ entity: "SLWHTReturn", id: item.id });
                                }} exportFileName="sl-wht-records" />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sscl">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                Social Security Contribution Levy (SSCL)
                            </CardTitle>
                            <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="w-4 h-4 mr-2" />New SSCL Return
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                                SSCL at {taxConfig.sscl_rate}% applies on liable turnover (gross turnover × activity fraction). Quarterly returns due by the 20th of the month following the quarter.
                            </div>
                            <DataTable data={ssclRecords} columns={ssclColumns} getBadgeColor={getBadge}
                                onEdit={handleEdit} onDelete={(item) => {
                                    if (confirm("Delete this SSCL return?")) deleteMutation.mutate({ entity: "SLSSCLReturn", id: item.id });
                                }} exportFileName="sl-sscl-returns" />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="apit">
                    <APISummary />
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === "vat" && <SLVATReturnForm item={editingItem} onClose={handleClose} />}
            {showDialog && activeTab === "wht" && <WHTForm item={editingItem} onClose={handleClose} />}
            {showDialog && activeTab === "sscl" && <SSCLForm item={editingItem} onClose={handleClose} />}
        </div>
    );
}
