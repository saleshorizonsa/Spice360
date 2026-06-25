import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Shield } from "lucide-react";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import { useGLAccounts } from "@/hooks/useGLAccounts";

// Fallback APIT brackets — used only when SLTaxConfiguration.apit_brackets is unavailable
const APIT_BRACKETS_FALLBACK = [
    { from: 0,       to: 1200000,  rate: 0,  tax_on_lower: 0      },
    { from: 1200000, to: 1800000,  rate: 6,  tax_on_lower: 0      },
    { from: 1800000, to: 3000000,  rate: 12, tax_on_lower: 36000  },
    { from: 3000000, to: 4200000,  rate: 18, tax_on_lower: 180000 },
    { from: 4200000, to: 6000000,  rate: 24, tax_on_lower: 396000 },
    { from: 6000000, to: Infinity, rate: 36, tax_on_lower: 828000 },
];

// brackets param: array of {from, to, rate, tax_on_lower} from SLTaxConfiguration
function calcAPIT(annualIncome, brackets) {
    if (!brackets || brackets.length === 0) return 0;
    if (annualIncome <= (brackets[0]?.to ?? 0)) return 0;
    for (const b of brackets) {
        if (annualIncome <= (b.to ?? Infinity)) {
            return (b.tax_on_lower ?? b.taxOnLower ?? 0) + (annualIncome - b.from) * (b.rate / 100);
        }
    }
    const last = brackets[brackets.length - 1];
    return (last.tax_on_lower ?? last.taxOnLower ?? 0) + (annualIncome - last.from) * (last.rate / 100);
}

function calcMonthlyAPIT(monthlyGross, brackets) {
    return calcAPIT(monthlyGross * 12, brackets) / 12;
}

export default function PayrollForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const taxConfig = useTaxConfig();
    const gl = useGLAccounts();

    // Memoised on JSON equality so array identity stays stable between renders
    const brackets = useMemo(() => {
        const cb = taxConfig.apit_brackets;
        if (Array.isArray(cb) && cb.length > 0) return cb;
        console.warn('[APIT] apit_brackets missing from SLTaxConfiguration — using hardcoded fallback');
        return APIT_BRACKETS_FALLBACK;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(taxConfig.apit_brackets)]);

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: [],
    });

    const [formData, setFormData] = useState({
        payroll_number: item?.payroll_number || `PAY-${Date.now()}`,
        payroll_month: item?.payroll_month || new Date().toISOString().substring(0, 7),
        employee_id: item?.employee_id || "",
        employee_name: item?.employee_name || "",
        epf_number: item?.epf_number || "",
        basic_salary: item?.basic_salary || 0,
        transport_allowance: item?.transport_allowance || 0,
        other_allowances: item?.other_allowances || 0,
        gross_earnings: item?.gross_earnings || 0,
        epf_employee: item?.epf_employee || 0,
        epf_employer: item?.epf_employer || 0,
        etf_employer: item?.etf_employer || 0,
        apit_tax: item?.apit_tax || 0,
        other_deductions: item?.other_deductions || 0,
        total_deductions: item?.total_deductions || 0,
        net_salary: item?.net_salary || 0,
        status: item?.status || "draft",
    });

    useEffect(() => {
        const basic = parseFloat(formData.basic_salary) || 0;
        const transport = parseFloat(formData.transport_allowance) || 0;
        const other = parseFloat(formData.other_allowances) || 0;

        const gross = basic + transport + other;
        const epfEmp = (gross * taxConfig.epf_employee_rate) / 100;
        const epfEmployer = (gross * taxConfig.epf_employer_rate) / 100;
        const etf = (gross * taxConfig.etf_employer_rate) / 100;
        const apit = calcMonthlyAPIT(gross, brackets);
        const otherDed = parseFloat(formData.other_deductions) || 0;
        const totalDed = epfEmp + apit + otherDed;
        const net = gross - totalDed;

        setFormData(prev => ({
            ...prev,
            gross_earnings: gross,
            epf_employee: epfEmp,
            epf_employer: epfEmployer,
            etf_employer: etf,
            apit_tax: apit,
            total_deductions: totalDed,
            net_salary: net,
        }));
    }, [
        formData.basic_salary,
        formData.transport_allowance,
        formData.other_allowances,
        formData.other_deductions,
        taxConfig.epf_employee_rate,
        taxConfig.epf_employer_rate,
        taxConfig.etf_employer_rate,
        brackets,
    ]);

    const handleEmployeeSelect = (empId) => {
        const emp = employees.find(e => e.employee_id === empId);
        if (emp) {
            setFormData(prev => ({
                ...prev,
                employee_id: empId,
                employee_name: emp.full_name || emp.employee_name,
                epf_number: emp.epf_number || "",
                basic_salary: emp.basic_salary || 0,
                transport_allowance: emp.transport_allowance || 0,
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const result = item
                ? await matrixSales.entities.Payroll.update(item.id, data)
                : await matrixSales.entities.Payroll.create(data);

            // Auto-create EPF contribution record when payroll is calculated/paid
            if (data.status === "calculated" || data.status === "paid") {
                const existing = await matrixSales.entities.SLEPFContribution.filter({
                    period_month: data.payroll_month,
                    employee_id: data.employee_id,
                });
                if (!existing || existing.length === 0) {
                    await matrixSales.entities.SLEPFContribution.create({
                        contribution_id: `EPF-${data.payroll_month}-${data.employee_id}`,
                        period_month: data.payroll_month,
                        employee_id: data.employee_id,
                        employee_name: data.employee_name,
                        epf_number: data.epf_number,
                        gross_salary: data.gross_earnings,
                        epf_employee: data.epf_employee,
                        epf_employer: data.epf_employer,
                        etf_employer: data.etf_employer,
                        total_epf: data.epf_employee + data.epf_employer,
                        total_employer_cost: data.epf_employer + data.etf_employer,
                        payroll_reference: data.payroll_number,
                        status: "calculated",
                    });
                }
            }

            return result;
        },
        onSuccess: async (saved) => {
            if (saved?.status === "approved" && !saved.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: gl.salaries_expense,  account_name: "Salaries & Wages",           debit: saved.gross_earnings,                  credit: 0 },
                            { account_code: gl.epf_employer_exp,  account_name: "EPF Employer Contribution",  debit: saved.epf_employer,                    credit: 0 },
                            { account_code: gl.etf_employer_exp,  account_name: "ETF Employer Contribution",  debit: saved.etf_employer,                    credit: 0 },
                            { account_code: gl.salaries_payable,  account_name: "Salaries Payable",           debit: 0, credit: saved.net_salary },
                            { account_code: gl.epf_payable,       account_name: "EPF Payable",               debit: 0, credit: saved.epf_employee + saved.epf_employer },
                            { account_code: gl.etf_payable,       account_name: "ETF Payable",               debit: 0, credit: saved.etf_employer },
                            { account_code: gl.apit_payable,      account_name: "APIT Payable (IRD)",        debit: 0, credit: saved.apit_tax },
                        ].filter(l => Number(l.debit || l.credit || 0) > 0),
                        referenceType: "payroll",
                        referenceId: saved.payroll_number,
                        description: `Payroll ${saved.payroll_number} — ${saved.employee_name}`,
                        entryDate: `${saved.payroll_month}-01`,
                        entryType: "payroll",
                        orgId: currentOrg?.id,
                        area: "gl",
                    });
                    await matrixSales.entities.Payroll.update(saved.id, { ...saved, gl_posted: true });
                } catch (err) {
                    toast({ title: "Payroll saved but GL posting failed", description: err.message, variant: "destructive" });
                }
            }
            queryClient.invalidateQueries({ queryKey: ["payrolls"] });
            queryClient.invalidateQueries({ queryKey: ["epfContributions"] });
            toast({ title: "Success", description: "Payroll processed successfully." });
            onClose();
        },
    });

    const fmt = (n) => `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? "Edit" : "Process"} Payroll
                        <Shield className="w-5 h-5 text-emerald-600" />
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Payroll Number</Label><Input value={formData.payroll_number} disabled /></div>
                        <div>
                            <Label>Payroll Month *</Label>
                            <Input type="month" value={formData.payroll_month}
                                onChange={e => setFormData(f => ({ ...f, payroll_month: e.target.value }))} required />
                        </div>
                    </div>

                    <div>
                        <Label>Employee *</Label>
                        <Select value={formData.employee_id} onValueChange={handleEmployeeSelect} required>
                            <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                            <SelectContent>
                                {employees.map(e => (
                                    <SelectItem key={e.id} value={e.employee_id}>
                                        {e.employee_id} — {e.full_name || e.employee_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Earnings */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold mb-3">Earnings (LKR)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Basic Salary</Label>
                                <Input type="number" step="0.01" value={formData.basic_salary}
                                    onChange={e => setFormData(f => ({ ...f, basic_salary: parseFloat(e.target.value) || 0 }))} />
                            </div>
                            <div>
                                <Label>Transport Allowance</Label>
                                <Input type="number" step="0.01" value={formData.transport_allowance}
                                    onChange={e => setFormData(f => ({ ...f, transport_allowance: parseFloat(e.target.value) || 0 }))} />
                            </div>
                            <div>
                                <Label>Other Allowances</Label>
                                <Input type="number" step="0.01" value={formData.other_allowances}
                                    onChange={e => setFormData(f => ({ ...f, other_allowances: parseFloat(e.target.value) || 0 }))} />
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex justify-between text-lg font-bold">
                            <span>Gross Earnings:</span>
                            <span>{fmt(formData.gross_earnings)}</span>
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200 space-y-2 text-sm">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Statutory Deductions (Auto-calculated)
                        </h4>
                        <div className="flex justify-between">
                            <span>EPF Employee ({taxConfig.epf_employee_rate}%):</span>
                            <span className="font-semibold text-red-700">− {fmt(formData.epf_employee)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>APIT (income tax):</span>
                            <span className="font-semibold text-red-700">− {fmt(formData.apit_tax)}</span>
                        </div>
                        <div className="pt-2">
                            <Label>Other Deductions</Label>
                            <Input type="number" step="0.01" value={formData.other_deductions}
                                onChange={e => setFormData(f => ({ ...f, other_deductions: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2 text-base">
                            <span>Total Deductions:</span>
                            <span>{fmt(formData.total_deductions)}</span>
                        </div>
                    </div>

                    {/* Employer costs (informational) */}
                    <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-2">
                        <h4 className="font-semibold text-slate-700">Employer Statutory Cost (not deducted from employee)</h4>
                        <div className="flex justify-between">
                            <span>EPF Employer ({taxConfig.epf_employer_rate}%):</span>
                            <span className="font-semibold text-blue-600">{fmt(formData.epf_employer)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>ETF Employer ({taxConfig.etf_employer_rate}%):</span>
                            <span className="font-semibold text-blue-600">{fmt(formData.etf_employer)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                            <span>Total Employer Cost:</span>
                            <span>{fmt(formData.gross_earnings + formData.epf_employer + formData.etf_employer)}</span>
                        </div>
                    </div>

                    {/* Net */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex justify-between items-center text-2xl font-bold text-green-700">
                        <span>Net Salary:</span>
                        <span>{fmt(formData.net_salary)}</span>
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={val => setFormData(f => ({ ...f, status: val }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="calculated">Calculated</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? "Update" : "Process"} Payroll
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
