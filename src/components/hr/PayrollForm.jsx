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

const GOSI_MAX_WAGE = 45000;

export default function PayrollForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        payroll_number: item?.payroll_number || `PAY-${Date.now()}`,
        payroll_month: item?.payroll_month || new Date().toISOString().substring(0, 7),
        employee_id: item?.employee_id || '',
        employee_name: item?.employee_name || '',
        basic_salary: item?.basic_salary || 0,
        housing_allowance: item?.housing_allowance || 0,
        transport_allowance: item?.transport_allowance || 0,
        other_allowances: item?.other_allowances || 0,
        gross_earnings: item?.gross_earnings || 0,
        gosi_employee: item?.gosi_employee || 0,
        gosi_employer: item?.gosi_employer || 0,
        other_deductions: item?.other_deductions || 0,
        total_deductions: item?.total_deductions || 0,
        net_salary: item?.net_salary || 0,
        status: item?.status || 'draft',
        is_saudi: false
    });

    useEffect(() => {
        // Calculate GOSI and totals
        const basic = parseFloat(formData.basic_salary) || 0;
        const housing = parseFloat(formData.housing_allowance) || 0;
        const transport = parseFloat(formData.transport_allowance) || 0;
        const other = parseFloat(formData.other_allowances) || 0;
        
        const grossEarnings = basic + housing + transport + other;
        const gosiWage = Math.min(basic + housing, GOSI_MAX_WAGE);
        
        // Employee contribution: 10% for Saudi, 2% for non-Saudi
        const employeeRate = formData.is_saudi ? 10 : 2;
        const gosiEmployee = (gosiWage * employeeRate) / 100;
        
        // Employer contribution: 12% for Saudi, 2% for non-Saudi
        const employerRate = formData.is_saudi ? 12 : 2;
        const gosiEmployer = (gosiWage * employerRate) / 100;
        
        const otherDeductions = parseFloat(formData.other_deductions) || 0;
        const totalDeductions = gosiEmployee + otherDeductions;
        const netSalary = grossEarnings - totalDeductions;

        setFormData(prev => ({
            ...prev,
            gross_earnings: grossEarnings,
            gosi_employee: gosiEmployee,
            gosi_employer: gosiEmployer,
            total_deductions: totalDeductions,
            net_salary: netSalary
        }));
    }, [
        formData.basic_salary, 
        formData.housing_allowance, 
        formData.transport_allowance,
        formData.other_allowances,
        formData.other_deductions,
        formData.is_saudi
    ]);

    const handleEmployeeSelect = (empId) => {
        const emp = employees.find(e => e.employee_id === empId);
        if (emp) {
            setFormData(prev => ({
                ...prev,
                employee_id: empId,
                employee_name: emp.full_name || emp.employee_name,
                basic_salary: emp.basic_salary || 0,
                housing_allowance: emp.housing_allowance || 0,
                transport_allowance: emp.transport_allowance || 0,
                is_saudi: emp.nationality === 'Saudi' || emp.is_saudi
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            // Create payroll record
            const payrollResult = item 
                ? await matrixSales.entities.Payroll.update(item.id, data)
                : await matrixSales.entities.Payroll.create(data);

            // Auto-create GOSI contribution record if not already exists
            if (data.status === 'calculated' || data.status === 'paid') {
                const existingGOSI = await matrixSales.entities.GOSIContribution.filter({
                    month: data.payroll_month,
                    employee_id: data.employee_id
                });

                if (!existingGOSI || existingGOSI.length === 0) {
                    await matrixSales.entities.GOSIContribution.create({
                        contribution_id: `GOSI-${data.payroll_month}-${data.employee_id}`,
                        month: data.payroll_month,
                        employee_id: data.employee_id,
                        employee_name: data.employee_name,
                        is_saudi: data.is_saudi,
                        basic_salary: data.basic_salary,
                        housing_allowance: data.housing_allowance,
                        gosi_wage: Math.min(data.basic_salary + data.housing_allowance, GOSI_MAX_WAGE),
                        employee_contribution_rate: data.is_saudi ? 10 : 2,
                        employer_contribution_rate: data.is_saudi ? 12 : 2,
                        employee_contribution: data.gosi_employee,
                        employer_contribution: data.gosi_employer,
                        total_contribution: data.gosi_employee + data.gosi_employer,
                        occupational_hazards: data.is_saudi ? (Math.min(data.basic_salary + data.housing_allowance, GOSI_MAX_WAGE) * 0.75) / 100 : 0,
                        sanid_scheme: data.is_saudi ? (Math.min(data.basic_salary + data.housing_allowance, GOSI_MAX_WAGE) * 2) / 100 : 0,
                        contribution_type: 'regular',
                        payroll_reference: data.payroll_number,
                        status: 'calculated'
                    });
                }
            }

            return payrollResult;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
            queryClient.invalidateQueries({ queryKey: ['gosiContributions'] });
            toast({ title: "Success", description: "Payroll processed and GOSI contribution created" });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit' : 'Process'} Payroll
                        <Shield className="w-5 h-5 text-emerald-600" />
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payroll Number</Label>
                            <Input value={formData.payroll_number} disabled />
                        </div>
                        <div>
                            <Label>Payroll Month *</Label>
                            <Input
                                type="month"
                                value={formData.payroll_month}
                                onChange={(e) => setFormData({...formData, payroll_month: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Employee *</Label>
                        <Select value={formData.employee_id} onValueChange={handleEmployeeSelect} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(e => (
                                    <SelectItem key={e.id} value={e.employee_id}>
                                        {e.employee_id} - {e.full_name || e.employee_name} ({e.nationality})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold mb-3">Earnings</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Basic Salary (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.basic_salary}
                                    onChange={(e) => setFormData({...formData, basic_salary: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div>
                                <Label>Housing Allowance (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.housing_allowance}
                                    onChange={(e) => setFormData({...formData, housing_allowance: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div>
                                <Label>Transport Allowance (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.transport_allowance}
                                    onChange={(e) => setFormData({...formData, transport_allowance: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div>
                                <Label>Other Allowances (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.other_allowances}
                                    onChange={(e) => setFormData({...formData, other_allowances: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-lg font-bold">
                                <span>Gross Earnings:</span>
                                <span>SAR {formData.gross_earnings.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Deductions (Auto-calculated GOSI)
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>GOSI Employee ({formData.is_saudi ? '10%' : '2%'}):</span>
                                <span className="font-semibold">SAR {formData.gosi_employee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>GOSI Employer ({formData.is_saudi ? '12%' : '2%'}):</span>
                                <span className="font-semibold">SAR {formData.gosi_employer.toFixed(2)}</span>
                            </div>
                            <div className="pt-2">
                                <Label>Other Deductions (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.other_deductions}
                                    onChange={(e) => setFormData({...formData, other_deductions: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                                <span>Total Deductions:</span>
                                <span>SAR {formData.total_deductions.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex justify-between items-center text-2xl font-bold text-green-700">
                            <span>Net Salary:</span>
                            <span>SAR {formData.net_salary.toLocaleString()}</span>
                        </div>
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
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
                            {item ? 'Update' : 'Process'} Payroll
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}