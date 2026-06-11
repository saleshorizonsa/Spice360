import React, { useState, useEffect } from "react";
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

export default function EPFETFForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const taxConfig = useTaxConfig();

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: [],
    });

    const [form, setForm] = useState({
        contribution_id: item?.contribution_id || `EPF-${Date.now()}`,
        period_month: item?.period_month || new Date().toISOString().substring(0, 7),
        employee_id: item?.employee_id || "",
        employee_name: item?.employee_name || "",
        epf_number: item?.epf_number || "",
        gross_salary: item?.gross_salary || 0,
        epf_employee: item?.epf_employee || 0,
        epf_employer: item?.epf_employer || 0,
        etf_employer: item?.etf_employer || 0,
        total_epf: item?.total_epf || 0,
        total_employer_cost: item?.total_employer_cost || 0,
        due_date: item?.due_date || "",
        status: item?.status || "draft",
    });

    useEffect(() => {
        const gross = parseFloat(form.gross_salary) || 0;
        const epfEmp = (gross * taxConfig.epf_employee_rate) / 100;
        const epfEmployer = (gross * taxConfig.epf_employer_rate) / 100;
        const etfEmployer = (gross * taxConfig.etf_employer_rate) / 100;
        setForm(f => ({
            ...f,
            epf_employee: epfEmp,
            epf_employer: epfEmployer,
            etf_employer: etfEmployer,
            total_epf: epfEmp + epfEmployer,
            total_employer_cost: epfEmployer + etfEmployer,
        }));
    }, [form.gross_salary, taxConfig.epf_employee_rate, taxConfig.epf_employer_rate, taxConfig.etf_employer_rate]);

    const handleEmployeeSelect = (empId) => {
        const emp = employees.find(e => e.employee_id === empId);
        if (emp) {
            setForm(f => ({
                ...f,
                employee_id: empId,
                employee_name: emp.full_name || emp.employee_name,
                epf_number: emp.epf_number || "",
                gross_salary: emp.basic_salary || 0,
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.SLEPFContribution.update(item.id, data)
            : matrixSales.entities.SLEPFContribution.create(data),
        onSuccess: async (saved) => {
            if ((saved?.status === "submitted" || saved?.status === "paid") && !saved.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: "5100", account_name: "Salaries & Wages", debit: saved.gross_salary, credit: 0 },
                            { account_code: "5210", account_name: "EPF Employer Contribution", debit: saved.epf_employer, credit: 0 },
                            { account_code: "5220", account_name: "ETF Employer Contribution", debit: saved.etf_employer, credit: 0 },
                            { account_code: "2420", account_name: "EPF Payable", debit: 0, credit: saved.total_epf },
                            { account_code: "2430", account_name: "ETF Payable", debit: 0, credit: saved.etf_employer },
                        ].filter(l => Number(l.debit || l.credit || 0) > 0),
                        referenceType: "epf_etf",
                        referenceId: saved.contribution_id,
                        description: `EPF/ETF — ${saved.employee_name} ${saved.period_month}`,
                        entryDate: `${saved.period_month}-01`,
                        entryType: "payroll",
                        orgId: currentOrg?.id,
                    });
                    await matrixSales.entities.SLEPFContribution.update(saved.id, { ...saved, gl_posted: true });
                } catch (err) {
                    toast({ title: "Saved but GL posting failed", description: err.message, variant: "destructive" });
                }
            }
            queryClient.invalidateQueries({ queryKey: ["epfContributions"] });
            toast({ title: "Success", description: "EPF/ETF contribution saved." });
            onClose();
        },
    });

    const fmt = (n) => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 });

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        EPF / ETF Contribution
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Contribution ID</Label><Input value={form.contribution_id} disabled /></div>
                        <div>
                            <Label>Period (Month) *</Label>
                            <Input type="month" value={form.period_month}
                                onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))} required />
                        </div>
                    </div>

                    <div>
                        <Label>Employee *</Label>
                        <Select value={form.employee_id} onValueChange={handleEmployeeSelect} required>
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>EPF Member Number</Label>
                            <Input value={form.epf_number}
                                onChange={e => setForm(f => ({ ...f, epf_number: e.target.value }))}
                                placeholder="EPF registration #" />
                        </div>
                        <div>
                            <Label>Gross Salary (LKR) *</Label>
                            <Input type="number" step="0.01" value={form.gross_salary}
                                onChange={e => setForm(f => ({ ...f, gross_salary: parseFloat(e.target.value) || 0 }))} required />
                        </div>
                    </div>

                    {/* EPF Breakdown */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2 text-sm">
                        <h4 className="font-semibold text-emerald-900 mb-3">EPF Contributions (Employee Provident Fund)</h4>
                        <div className="flex justify-between">
                            <span>Employee Contribution ({taxConfig.epf_employee_rate}% of gross):</span>
                            <span className="font-semibold text-red-600">LKR {fmt(form.epf_employee)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Employer Contribution ({taxConfig.epf_employer_rate}% of gross):</span>
                            <span className="font-semibold text-blue-600">LKR {fmt(form.epf_employer)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                            <span>Total EPF (20% of gross):</span>
                            <span>LKR {fmt(form.total_epf)}</span>
                        </div>
                    </div>

                    {/* ETF Breakdown */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
                        <h4 className="font-semibold text-blue-900 mb-3">ETF (Employee Trust Fund) — Employer Only</h4>
                        <div className="flex justify-between">
                            <span>Employer ETF ({taxConfig.etf_employer_rate}% of gross):</span>
                            <span className="font-semibold text-blue-600">LKR {fmt(form.etf_employer)}</span>
                        </div>
                        <p className="text-xs text-blue-700">No employee deduction. Employer bears full ETF cost.</p>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-50 border rounded-lg p-4 space-y-2 text-sm">
                        <h4 className="font-semibold">Summary</h4>
                        <div className="flex justify-between"><span>Employee deduction (EPF 8%):</span><span className="font-semibold text-red-600">− LKR {fmt(form.epf_employee)}</span></div>
                        <div className="flex justify-between"><span>Total employer cost (EPF 12% + ETF 3%):</span><span className="font-semibold text-blue-600">LKR {fmt(form.total_employer_cost)}</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Due Date</Label>
                            <Input type="date" value={form.due_date}
                                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="submitted">Submitted to EPF Board</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? "Update" : "Save"} EPF/ETF
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
