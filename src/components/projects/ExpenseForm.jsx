import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useTaxConfig } from "@/hooks/useTaxConfig";

export default function ExpenseForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const taxConfig = useTaxConfig();

    const [formData, setFormData] = useState({
        expense_number: '',
        project_code: '',
        project_name: '',
        employee_number: '',
        employee_name: '',
        expense_date: new Date().toISOString().split('T')[0],
        expense_category: 'travel',
        description: '',
        amount: 0,
        currency: 'LKR',
        vat_amount: 0,
        total_amount: 0,
        billable: true,
        markup_percent: 0,
        billing_amount: 0,
        receipt_attached: false,
        status: 'draft',
        notes: ''
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => matrixSales.entities.Project.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.ProjectExpense.update(item.id, data);
            }
            return matrixSales.entities.ProjectExpense.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Success",
                description: `Expense ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            
            // Auto-calculate VAT and totals
            if (field === 'amount') {
                updated.vat_amount = value * (taxConfig.vat_standard_rate / 100);
                updated.total_amount = value + updated.vat_amount;
                if (updated.billable) {
                    updated.billing_amount = updated.total_amount * (1 + (updated.markup_percent / 100));
                }
            }
            
            if (field === 'markup_percent') {
                if (updated.billable) {
                    updated.billing_amount = updated.total_amount * (1 + (value / 100));
                }
            }
            
            if (field === 'billable') {
                if (value) {
                    updated.billing_amount = updated.total_amount * (1 + (updated.markup_percent / 100));
                } else {
                    updated.billing_amount = 0;
                }
            }
            
            return updated;
        });
    };

    const handleProjectSelect = (projectCode) => {
        const project = projects.find(p => p.project_code === projectCode);
        if (project) {
            setFormData(prev => ({
                ...prev,
                project_code: projectCode,
                project_name: project.project_name
            }));
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Project Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Expense Number *</Label>
                            <Input
                                value={formData.expense_number}
                                onChange={(e) => handleChange('expense_number', e.target.value)}
                                required
                                placeholder="EXP-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>Expense Date *</Label>
                            <Input
                                type="date"
                                value={formData.expense_date}
                                onChange={(e) => handleChange('expense_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Project *</Label>
                        <Select
                            value={formData.project_code}
                            onValueChange={handleProjectSelect}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(project => (
                                    <SelectItem key={project.id} value={project.project_code}>
                                        {project.project_code} - {project.project_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Employee Number *</Label>
                            <Input
                                value={formData.employee_number}
                                onChange={(e) => handleChange('employee_number', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Employee Name *</Label>
                            <Input
                                value={formData.employee_name}
                                onChange={(e) => handleChange('employee_name', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Expense Category *</Label>
                        <Select
                            value={formData.expense_category}
                            onValueChange={(val) => handleChange('expense_category', val)}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="travel">Travel</SelectItem>
                                <SelectItem value="accommodation">Accommodation</SelectItem>
                                <SelectItem value="meals">Meals</SelectItem>
                                <SelectItem value="transportation">Transportation</SelectItem>
                                <SelectItem value="materials">Materials</SelectItem>
                                <SelectItem value="subcontractor">Subcontractor</SelectItem>
                                <SelectItem value="equipment">Equipment</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Description *</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            required
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Amount (LKR) *</Label>
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <Label>VAT (15%)</Label>
                            <Input
                                type="number"
                                value={formData.vat_amount}
                                disabled
                                className="bg-gray-100"
                            />
                        </div>
                        <div>
                            <Label>Total Amount</Label>
                            <Input
                                type="number"
                                value={formData.total_amount}
                                disabled
                                className="bg-gray-100"
                            />
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Billable to Customer</Label>
                            <Switch
                                checked={formData.billable}
                                onCheckedChange={(checked) => handleChange('billable', checked)}
                            />
                        </div>

                        {formData.billable && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Markup Percentage (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.markup_percent}
                                        onChange={(e) => handleChange('markup_percent', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <Label>Billing Amount (LKR)</Label>
                                    <Input
                                        type="number"
                                        value={formData.billing_amount}
                                        disabled
                                        className="bg-gray-100"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <Label>Receipt Attached</Label>
                        <Switch
                            checked={formData.receipt_attached}
                            onCheckedChange={(checked) => handleChange('receipt_attached', checked)}
                        />
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Expense
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}