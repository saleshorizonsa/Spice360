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
import { useOrganization } from "../utils/OrganizationContext";

export default function CostPoolForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters', currentOrg?.id],
        queryFn: () => base44.entities.CostCenter.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        cost_pool_code: '',
        organization_id: currentOrg?.id || '',
        cost_pool_name: '',
        cost_pool_type: 'overhead',
        cost_center_code: '',
        allocation_base: 'labor_hours',
        budgeted_cost: 0,
        actual_cost: 0,
        budgeted_base_quantity: 0,
        actual_base_quantity: 0,
        overhead_rate: 0,
        fiscal_year: new Date().getFullYear().toString(),
        period: new Date().toISOString().slice(0, 7),
        status: 'active',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...item, organization_id: item.organization_id || currentOrg?.id });
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
        }
    }, [item, currentOrg]);

    // Calculate overhead rate
    useEffect(() => {
        const budgetedQty = parseFloat(formData.budgeted_base_quantity) || 0;
        const budgetedCost = parseFloat(formData.budgeted_cost) || 0;
        
        if (budgetedQty > 0) {
            const rate = budgetedCost / budgetedQty;
            setFormData(prev => ({ ...prev, overhead_rate: rate }));
        }
    }, [formData.budgeted_cost, formData.budgeted_base_quantity]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.CostPool.update(item.id, data);
            }
            return base44.entities.CostPool.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['costPools'] });
            toast({
                title: "Success",
                description: `Cost pool ${item ? 'updated' : 'created'} successfully`,
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Cost Pool' : 'New Cost Pool'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Cost Pool Code *</Label>
                            <Input
                                value={formData.cost_pool_code}
                                onChange={(e) => handleChange('cost_pool_code', e.target.value)}
                                required
                                placeholder="CP-001"
                            />
                        </div>
                        <div>
                            <Label>Cost Pool Name *</Label>
                            <Input
                                value={formData.cost_pool_name}
                                onChange={(e) => handleChange('cost_pool_name', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Cost Pool Type *</Label>
                            <Select value={formData.cost_pool_type} onValueChange={(val) => handleChange('cost_pool_type', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="overhead">Overhead</SelectItem>
                                    <SelectItem value="direct_labor">Direct Labor</SelectItem>
                                    <SelectItem value="direct_material">Direct Material</SelectItem>
                                    <SelectItem value="indirect">Indirect</SelectItem>
                                    <SelectItem value="administrative">Administrative</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                                <SelectItem value="square_footage">Square Footage</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Budgeted Cost (SAR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.budgeted_cost}
                                onChange={(e) => handleChange('budgeted_cost', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Actual Cost (SAR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.actual_cost}
                                onChange={(e) => handleChange('actual_cost', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Budgeted Base Quantity</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.budgeted_base_quantity}
                                onChange={(e) => handleChange('budgeted_base_quantity', e.target.value)}
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

                    <div className="bg-emerald-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Calculated Overhead Rate:</span>
                            <span className="text-2xl font-bold text-emerald-600">
                                SAR {formData.overhead_rate.toFixed(2)}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">per {formData.allocation_base.replace('_', ' ')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
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
                            {item ? 'Update' : 'Create'} Cost Pool
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}