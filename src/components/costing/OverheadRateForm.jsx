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
import { useOrganization } from "../utils/OrganizationContext";

export default function OverheadRateForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters', currentOrg?.id],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const { data: costPools = [] } = useQuery({
        queryKey: ['costPools', currentOrg?.id],
        queryFn: () => matrixSales.entities.CostPool.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        rate_id: '',
        organization_id: currentOrg?.id || '',
        rate_name: '',
        rate_type: 'plantwide',
        cost_center_code: '',
        cost_pool_code: '',
        allocation_base: 'labor_hours',
        budgeted_overhead: 0,
        budgeted_base_quantity: 0,
        predetermined_rate: 0,
        actual_overhead: 0,
        actual_base_quantity: 0,
        actual_rate: 0,
        applied_overhead: 0,
        under_over_applied: 0,
        fiscal_year: new Date().getFullYear().toString(),
        period: new Date().toISOString().slice(0, 7),
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...item, organization_id: item.organization_id || currentOrg?.id });
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
            const newId = `OR-${Date.now()}`;
            setFormData(prev => ({ ...prev, rate_id: newId }));
        }
    }, [item, currentOrg]);

    // Calculate predetermined rate
    useEffect(() => {
        const budgetedQty = parseFloat(formData.budgeted_base_quantity) || 0;
        const budgetedOverhead = parseFloat(formData.budgeted_overhead) || 0;
        
        if (budgetedQty > 0) {
            const rate = budgetedOverhead / budgetedQty;
            setFormData(prev => ({ ...prev, predetermined_rate: rate }));
        }
    }, [formData.budgeted_overhead, formData.budgeted_base_quantity]);

    // Calculate actual rate
    useEffect(() => {
        const actualQty = parseFloat(formData.actual_base_quantity) || 0;
        const actualOverhead = parseFloat(formData.actual_overhead) || 0;
        
        if (actualQty > 0) {
            const rate = actualOverhead / actualQty;
            setFormData(prev => ({ ...prev, actual_rate: rate }));
        }
    }, [formData.actual_overhead, formData.actual_base_quantity]);

    // Calculate under/over applied
    useEffect(() => {
        const actualOverhead = parseFloat(formData.actual_overhead) || 0;
        const appliedOverhead = parseFloat(formData.applied_overhead) || 0;
        const underOver = actualOverhead - appliedOverhead;
        setFormData(prev => ({ ...prev, under_over_applied: underOver }));
    }, [formData.actual_overhead, formData.applied_overhead]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.OverheadRate.update(item.id, data);
            }
            return matrixSales.entities.OverheadRate.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['overheadRates'] });
            toast({
                title: "Success",
                description: `Overhead rate ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Overhead Rate' : 'New Overhead Rate'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Rate Name *</Label>
                            <Input
                                value={formData.rate_name}
                                onChange={(e) => handleChange('rate_name', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Rate Type *</Label>
                            <Select value={formData.rate_type} onValueChange={(val) => handleChange('rate_type', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="plantwide">Plantwide Rate</SelectItem>
                                    <SelectItem value="departmental">Departmental Rate</SelectItem>
                                    <SelectItem value="activity_based">Activity-Based Rate</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Cost Center</Label>
                            <Select value={formData.cost_center_code} onValueChange={(val) => handleChange('cost_center_code', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select cost center" />
                                </SelectTrigger>
                                <SelectContent>
                                    {costCenters.map(cc => (
                                        <SelectItem key={cc.id} value={cc.cost_center_code}>
                                            {cc.cost_center_code} - {cc.cost_center_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Cost Pool</Label>
                            <Select value={formData.cost_pool_code} onValueChange={(val) => handleChange('cost_pool_code', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select cost pool" />
                                </SelectTrigger>
                                <SelectContent>
                                    {costPools.map(cp => (
                                        <SelectItem key={cp.id} value={cp.cost_pool_code}>
                                            {cp.cost_pool_code} - {cp.cost_pool_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Allocation Base *</Label>
                        <Select value={formData.allocation_base} onValueChange={(val) => handleChange('allocation_base', val)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="labor_hours">Labor Hours</SelectItem>
                                <SelectItem value="machine_hours">Machine Hours</SelectItem>
                                <SelectItem value="units_produced">Units Produced</SelectItem>
                                <SelectItem value="direct_labor_cost">Direct Labor Cost</SelectItem>
                                <SelectItem value="material_cost">Material Cost</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Budgeted (Predetermined)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Budgeted Overhead (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.budgeted_overhead}
                                    onChange={(e) => handleChange('budgeted_overhead', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Budgeted Base Quantity</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.budgeted_base_quantity}
                                    onChange={(e) => handleChange('budgeted_base_quantity', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">Predetermined Rate:</span>
                                <span className="text-xl font-bold text-blue-600">
                                    SAR {formData.predetermined_rate.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Actual</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Actual Overhead (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.actual_overhead}
                                    onChange={(e) => handleChange('actual_overhead', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Actual Base Quantity</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.actual_base_quantity}
                                    onChange={(e) => handleChange('actual_base_quantity', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">Actual Rate:</span>
                                <span className="text-xl font-bold text-green-600">
                                    SAR {formData.actual_rate.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Applied Overhead (SAR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.applied_overhead}
                                onChange={(e) => handleChange('applied_overhead', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Under/Over Applied (SAR)</Label>
                            <Input
                                type="number"
                                value={formData.under_over_applied.toFixed(2)}
                                disabled
                                className={`font-semibold ${formData.under_over_applied < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Fiscal Year</Label>
                            <Input
                                value={formData.fiscal_year}
                                onChange={(e) => handleChange('fiscal_year', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Period (YYYY-MM)</Label>
                            <Input
                                type="month"
                                value={formData.period}
                                onChange={(e) => handleChange('period', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Effective From</Label>
                            <Input
                                type="date"
                                value={formData.effective_from}
                                onChange={(e) => handleChange('effective_from', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Effective To</Label>
                            <Input
                                type="date"
                                value={formData.effective_to}
                                onChange={(e) => handleChange('effective_to', e.target.value)}
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

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Overhead Rate
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}