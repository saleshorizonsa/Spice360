import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function EOSForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        eos_number: '',
        employee_number: '',
        employee_name: '',
        join_date: '',
        last_working_date: '',
        termination_type: 'resignation',
        last_basic_salary: 0,
        years_of_service: 0,
        total_eos_amount: 0,
        final_settlement_amount: 0,
        status: 'draft'
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        if (formData.join_date && formData.last_working_date) {
            const join = new Date(formData.join_date);
            const end = new Date(formData.last_working_date);
            const years = (end - join) / (1000 * 60 * 60 * 24 * 365);
            
            let eosAmount = 0;
            if (years <= 5) {
                eosAmount = (formData.last_basic_salary / 2) * years;
            } else {
                eosAmount = (formData.last_basic_salary / 2) * 5 + formData.last_basic_salary * (years - 5);
            }

            setFormData(prev => ({
                ...prev,
                years_of_service: parseFloat(years.toFixed(2)),
                total_eos_amount: eosAmount,
                final_settlement_amount: eosAmount
            }));
        }
    }, [formData.join_date, formData.last_working_date, formData.last_basic_salary]);

    const handleEmployeeSelect = (empNumber) => {
        const emp = employees.find(e => e.employee_number === empNumber);
        if (emp) {
            setFormData(prev => ({
                ...prev,
                employee_number: empNumber,
                employee_name: emp.full_name,
                join_date: emp.join_date,
                last_basic_salary: emp.basic_salary || 0
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.EndOfService.update(item.id, data);
            }
            return matrixSales.entities.EndOfService.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['eos'] });
            toast({ title: "Success", description: "EOS calculation saved" });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'Calculate'} End of Service</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>EOS Number</Label>
                            <Input
                                value={formData.eos_number}
                                onChange={(e) => setFormData({...formData, eos_number: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Employee</Label>
                            <Select value={formData.employee_number} onValueChange={handleEmployeeSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.employee_number}>
                                            {e.employee_number} - {e.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Join Date</Label>
                            <Input
                                type="date"
                                value={formData.join_date}
                                onChange={(e) => setFormData({...formData, join_date: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Last Working Date</Label>
                            <Input
                                type="date"
                                value={formData.last_working_date}
                                onChange={(e) => setFormData({...formData, last_working_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Termination Type</Label>
                            <Select value={formData.termination_type} onValueChange={(val) => setFormData({...formData, termination_type: val})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="resignation">Resignation</SelectItem>
                                    <SelectItem value="termination_with_cause">Termination with Cause</SelectItem>
                                    <SelectItem value="termination_without_cause">Termination without Cause</SelectItem>
                                    <SelectItem value="contract_expiry">Contract Expiry</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Last Basic Salary</Label>
                            <Input
                                type="number"
                                value={formData.last_basic_salary}
                                onChange={(e) => setFormData({...formData, last_basic_salary: parseFloat(e.target.value) || 0})}
                                required
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded space-y-2">
                        <div className="flex justify-between">
                            <span>Years of Service:</span>
                            <span className="font-semibold">{formData.years_of_service} years</span>
                        </div>
                        <div className="flex justify-between text-lg border-t pt-2">
                            <span className="font-bold">Total EOS Amount:</span>
                            <span className="font-bold text-emerald-600">LKR {formData.total_eos_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg">
                            <span className="font-bold">Final Settlement:</span>
                            <span className="font-bold text-emerald-600">LKR {formData.final_settlement_amount.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Calculate'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}