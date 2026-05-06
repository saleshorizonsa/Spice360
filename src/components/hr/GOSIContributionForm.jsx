import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Shield } from "lucide-react";

const GOSI_MAX_WAGE = 45000; // SAR
const SAUDI_EMPLOYEE_RATE = 10;
const SAUDI_EMPLOYER_RATE = 12;
const NON_SAUDI_EMPLOYEE_RATE = 2;
const NON_SAUDI_EMPLOYER_RATE = 2;

export default function GOSIContributionForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        contribution_id: item?.contribution_id || `GOSI-${Date.now()}`,
        month: item?.month || new Date().toISOString().substring(0, 7),
        employee_id: item?.employee_id || '',
        employee_name: item?.employee_name || '',
        employee_iqama_number: item?.employee_iqama_number || '',
        nationality: item?.nationality || '',
        is_saudi: item?.is_saudi || false,
        basic_salary: item?.basic_salary || 0,
        housing_allowance: item?.housing_allowance || 0,
        gosi_wage: item?.gosi_wage || 0,
        employee_contribution_rate: item?.employee_contribution_rate || SAUDI_EMPLOYEE_RATE,
        employer_contribution_rate: item?.employer_contribution_rate || SAUDI_EMPLOYER_RATE,
        employee_contribution: item?.employee_contribution || 0,
        employer_contribution: item?.employer_contribution || 0,
        total_contribution: item?.total_contribution || 0,
        occupational_hazards: item?.occupational_hazards || 0,
        sanid_scheme: item?.sanid_scheme || 0,
        contribution_type: item?.contribution_type || 'regular',
        payroll_reference: item?.payroll_reference || '',
        department: item?.department || '',
        cost_center: item?.cost_center || '',
        branch_code: item?.branch_code || '',
        status: item?.status || 'calculated',
        submission_date: item?.submission_date || '',
        payment_date: item?.payment_date || '',
        payment_reference: item?.payment_reference || '',
        notes: item?.notes || ''
    });

    useEffect(() => {
        calculateContributions();
    }, [formData.basic_salary, formData.housing_allowance, formData.is_saudi]);

    const calculateContributions = () => {
        const totalWage = parseFloat(formData.basic_salary) + parseFloat(formData.housing_allowance);
        const gosiWage = Math.min(totalWage, GOSI_MAX_WAGE);
        
        const employeeRate = formData.is_saudi ? SAUDI_EMPLOYEE_RATE : NON_SAUDI_EMPLOYEE_RATE;
        const employerRate = formData.is_saudi ? SAUDI_EMPLOYER_RATE : NON_SAUDI_EMPLOYER_RATE;
        
        const employeeContrib = (gosiWage * employeeRate) / 100;
        const employerContrib = (gosiWage * employerRate) / 100;
        const occupationalHazards = formData.is_saudi ? (gosiWage * 0.75) / 100 : 0;
        const sanid = formData.is_saudi ? (gosiWage * 2) / 100 : 0;
        
        setFormData(prev => ({
            ...prev,
            gosi_wage: gosiWage,
            employee_contribution_rate: employeeRate,
            employer_contribution_rate: employerRate,
            employee_contribution: employeeContrib,
            employer_contribution: employerContrib,
            occupational_hazards: occupationalHazards,
            sanid_scheme: sanid,
            total_contribution: employeeContrib + employerContrib + occupationalHazards + sanid
        }));
    };

    const handleEmployeeSelect = (employeeId) => {
        const employee = employees.find(e => e.employee_id === employeeId);
        if (employee) {
            setFormData(prev => ({
                ...prev,
                employee_id: employee.employee_id,
                employee_name: employee.full_name,
                employee_iqama_number: employee.iqama_number || employee.national_id,
                nationality: employee.nationality,
                is_saudi: employee.nationality === 'Saudi',
                basic_salary: employee.basic_salary || 0,
                housing_allowance: employee.housing_allowance || 0,
                department: employee.department,
                cost_center: employee.cost_center,
                branch_code: employee.branch_code
            }));
        }
    };

    const mutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.GOSIContribution.update(item.id, data);
            }
            return matrixSales.entities.GOSIContribution.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gosiContributions'] });
            toast({
                title: "Success",
                description: `GOSI contribution ${item ? 'updated' : 'created'} successfully`,
            });
            onClose();
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit' : 'New'} GOSI Contribution
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Contribution ID</Label>
                            <Input value={formData.contribution_id} disabled />
                        </div>
                        <div>
                            <Label>Month *</Label>
                            <Input
                                type="month"
                                value={formData.month}
                                onChange={(e) => handleChange('month', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Type</Label>
                            <Select value={formData.contribution_type} onValueChange={(val) => handleChange('contribution_type', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="regular">Regular</SelectItem>
                                    <SelectItem value="arrears">Arrears</SelectItem>
                                    <SelectItem value="adjustment">Adjustment</SelectItem>
                                    <SelectItem value="final_settlement">Final Settlement</SelectItem>
                                </SelectContent>
                            </Select>
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
                                        {e.employee_id} - {e.full_name} ({e.nationality})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Iqama/National ID</Label>
                            <Input value={formData.employee_iqama_number} disabled />
                        </div>
                        <div>
                            <Label>Nationality</Label>
                            <Input value={formData.nationality} disabled />
                        </div>
                        <div>
                            <Label>Department</Label>
                            <Input value={formData.department} disabled />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold mb-3">Wage Components</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Basic Salary (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.basic_salary}
                                    onChange={(e) => handleChange('basic_salary', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Housing Allowance (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.housing_allowance}
                                    onChange={(e) => handleChange('housing_allowance', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>GOSI Wage (max 45,000)</Label>
                                <Input type="number" value={formData.gosi_wage.toFixed(2)} disabled />
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-semibold mb-3">Contribution Breakdown</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Employee Contribution ({formData.employee_contribution_rate}%)</Label>
                                <Input value={formData.employee_contribution.toFixed(2)} disabled />
                            </div>
                            <div>
                                <Label>Employer Contribution ({formData.employer_contribution_rate}%)</Label>
                                <Input value={formData.employer_contribution.toFixed(2)} disabled />
                            </div>
                            {formData.is_saudi && (
                                <>
                                    <div>
                                        <Label>Occupational Hazards (0.75%)</Label>
                                        <Input value={formData.occupational_hazards.toFixed(2)} disabled />
                                    </div>
                                    <div>
                                        <Label>SANID (2%)</Label>
                                        <Input value={formData.sanid_scheme.toFixed(2)} disabled />
                                    </div>
                                </>
                            )}
                            <div className="col-span-2">
                                <Label className="text-lg">Total Contribution (SAR)</Label>
                                <Input 
                                    value={formData.total_contribution.toFixed(2)} 
                                    disabled 
                                    className="text-lg font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="calculated">Calculated</SelectItem>
                                    <SelectItem value="submitted">Submitted</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Submission Date</Label>
                            <Input
                                type="date"
                                value={formData.submission_date}
                                onChange={(e) => handleChange('submission_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Payment Date</Label>
                            <Input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => handleChange('payment_date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payroll Reference</Label>
                            <Input
                                value={formData.payroll_reference}
                                onChange={(e) => handleChange('payroll_reference', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Payment Reference</Label>
                            <Input
                                value={formData.payment_reference}
                                onChange={(e) => handleChange('payment_reference', e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Contribution
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}