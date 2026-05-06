import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function LoanAdvanceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        loan_number: '',
        employee_number: '',
        employee_name: '',
        loan_type: 'loan',
        loan_amount: 0,
        number_of_installments: 12,
        installment_amount: 0,
        amount_remaining: 0,
        reason: '',
        status: 'pending'
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        const installment = formData.number_of_installments > 0 
            ? formData.loan_amount / formData.number_of_installments 
            : 0;
        setFormData(prev => ({
            ...prev,
            installment_amount: installment,
            amount_remaining: prev.loan_amount
        }));
    }, [formData.loan_amount, formData.number_of_installments]);

    const handleEmployeeSelect = (empNumber) => {
        const emp = employees.find(e => e.employee_number === empNumber);
        if (emp) {
            setFormData(prev => ({
                ...prev,
                employee_number: empNumber,
                employee_name: emp.full_name
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.LoanAdvance.update(item.id, data);
            }
            return base44.entities.LoanAdvance.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loans'] });
            toast({ title: "Success", description: "Loan/advance saved" });
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
                    <DialogTitle>{item ? 'Edit' : 'New'} Loan/Advance</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Loan Number</Label>
                            <Input
                                value={formData.loan_number}
                                onChange={(e) => setFormData({...formData, loan_number: e.target.value})}
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

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Type</Label>
                            <Select value={formData.loan_type} onValueChange={(val) => setFormData({...formData, loan_type: val})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="loan">Loan</SelectItem>
                                    <SelectItem value="advance">Advance</SelectItem>
                                    <SelectItem value="emergency">Emergency</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Amount (SAR)</Label>
                            <Input
                                type="number"
                                value={formData.loan_amount}
                                onChange={(e) => setFormData({...formData, loan_amount: parseFloat(e.target.value) || 0})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Installments</Label>
                            <Input
                                type="number"
                                value={formData.number_of_installments}
                                onChange={(e) => setFormData({...formData, number_of_installments: parseInt(e.target.value) || 1})}
                                required
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded">
                        <div className="flex justify-between">
                            <span>Monthly Installment:</span>
                            <span className="font-bold text-lg">SAR {formData.installment_amount.toFixed(2)}</span>
                        </div>
                    </div>

                    <div>
                        <Label>Reason</Label>
                        <Textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}