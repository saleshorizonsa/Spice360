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
import SearchableSelect from "../shared/SearchableSelect";
import { useOrganization } from "../utils/OrganizationContext";
import { Calculator } from "lucide-react";

export default function ProductCostForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: products = [] } = useQuery({
        queryKey: ['products', currentOrg?.id],
        queryFn: () => base44.entities.Product.list(),
        initialData: []
    });

    const { data: boms = [] } = useQuery({
        queryKey: ['boms', currentOrg?.id],
        queryFn: () => base44.entities.BOM.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        product_cost_id: '',
        organization_id: currentOrg?.id || '',
        material_code: '',
        material_name: '',
        costing_method: 'standard',
        costing_version: 'V1',
        effective_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        direct_material_cost: 0,
        direct_labor_cost: 0,
        machine_cost: 0,
        variable_overhead: 0,
        fixed_overhead: 0,
        subcontractor_cost: 0,
        packaging_cost: 0,
        freight_cost: 0,
        other_costs: 0,
        total_cost_per_unit: 0,
        target_margin_percent: 20,
        suggested_selling_price: 0,
        actual_selling_price: 0,
        actual_margin_percent: 0,
        bom_reference: '',
        routing_reference: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...item, organization_id: item.organization_id || currentOrg?.id });
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
            const newId = `PC-${Date.now()}`;
            setFormData(prev => ({ ...prev, product_cost_id: newId }));
        }
    }, [item, currentOrg]);

    // Calculate totals whenever component costs change
    useEffect(() => {
        const totalCost = 
            (parseFloat(formData.direct_material_cost) || 0) +
            (parseFloat(formData.direct_labor_cost) || 0) +
            (parseFloat(formData.machine_cost) || 0) +
            (parseFloat(formData.variable_overhead) || 0) +
            (parseFloat(formData.fixed_overhead) || 0) +
            (parseFloat(formData.subcontractor_cost) || 0) +
            (parseFloat(formData.packaging_cost) || 0) +
            (parseFloat(formData.freight_cost) || 0) +
            (parseFloat(formData.other_costs) || 0);

        const targetMargin = parseFloat(formData.target_margin_percent) || 0;
        const suggestedPrice = totalCost * (1 + targetMargin / 100);

        const actualPrice = parseFloat(formData.actual_selling_price) || 0;
        const actualMargin = actualPrice > 0 ? ((actualPrice - totalCost) / actualPrice) * 100 : 0;

        setFormData(prev => ({
            ...prev,
            total_cost_per_unit: totalCost,
            suggested_selling_price: suggestedPrice,
            actual_margin_percent: actualMargin
        }));
    }, [
        formData.direct_material_cost,
        formData.direct_labor_cost,
        formData.machine_cost,
        formData.variable_overhead,
        formData.fixed_overhead,
        formData.subcontractor_cost,
        formData.packaging_cost,
        formData.freight_cost,
        formData.other_costs,
        formData.target_margin_percent,
        formData.actual_selling_price
    ]);

    const handleProductSelect = (productCode) => {
        const product = products.find(p => p.product_code === productCode);
        if (product) {
            setFormData(prev => ({
                ...prev,
                material_code: product.product_code,
                material_name: product.product_name,
                actual_selling_price: product.unit_price || 0
            }));
        }
    };

    const handleBOMSelect = async (bomNumber) => {
        setFormData(prev => ({ ...prev, bom_reference: bomNumber }));
        
        // Calculate material cost from BOM
        try {
            const bomItems = await base44.entities.BOMItem.filter({ bom_number: bomNumber });
            const materialCost = bomItems.reduce((sum, item) => {
                const material = products.find(p => p.product_code === item.material_code);
                const unitCost = material?.unit_cost || 0;
                return sum + (unitCost * (item.quantity || 0) * (1 + (item.scrap_factor_percent || 0) / 100));
            }, 0);
            
            setFormData(prev => ({ ...prev, direct_material_cost: materialCost }));
            
            toast({
                title: "BOM Loaded",
                description: `Material cost calculated from BOM: SAR ${materialCost.toFixed(2)}`,
                variant: "default"
            });
        } catch (error) {
            console.error("Error loading BOM:", error);
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.ProductCost.update(item.id, data);
            }
            return base44.entities.ProductCost.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productCosts'] });
            toast({
                title: "Success",
                description: `Product cost ${item ? 'updated' : 'calculated'} successfully`,
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

    const productOptions = products.map(p => ({
        value: p.product_code,
        label: `${p.product_code} - ${p.product_name}`
    }));

    const bomOptions = boms.map(b => ({
        value: b.bom_number,
        label: `${b.bom_number} - ${b.product_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        {item ? 'Edit Product Cost' : 'Calculate Product Cost'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <SearchableSelect
                                label="Product *"
                                value={formData.material_code}
                                onValueChange={handleProductSelect}
                                options={productOptions}
                                placeholder="Select product..."
                                searchPlaceholder="Search products..."
                            />
                        </div>
                        <div>
                            <Label>Costing Method</Label>
                            <Select value={formData.costing_method} onValueChange={(val) => handleChange('costing_method', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="standard">Standard Costing</SelectItem>
                                    <SelectItem value="actual">Actual Costing</SelectItem>
                                    <SelectItem value="average">Average Costing</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Version</Label>
                            <Input
                                value={formData.costing_version}
                                onChange={(e) => handleChange('costing_version', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Effective Date *</Label>
                            <Input
                                type="date"
                                value={formData.effective_date}
                                onChange={(e) => handleChange('effective_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Expiry Date</Label>
                            <Input
                                type="date"
                                value={formData.expiry_date}
                                onChange={(e) => handleChange('expiry_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                label="BOM Reference"
                                value={formData.bom_reference}
                                onValueChange={handleBOMSelect}
                                options={bomOptions}
                                placeholder="Select BOM..."
                                searchPlaceholder="Search BOMs..."
                            />
                        </div>
                    </div>

                    {/* Cost Components */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Cost Components</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Direct Material Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.direct_material_cost}
                                    onChange={(e) => handleChange('direct_material_cost', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Direct Labor Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.direct_labor_cost}
                                    onChange={(e) => handleChange('direct_labor_cost', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Machine Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.machine_cost}
                                    onChange={(e) => handleChange('machine_cost', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Variable Overhead (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.variable_overhead}
                                    onChange={(e) => handleChange('variable_overhead', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Fixed Overhead (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.fixed_overhead}
                                    onChange={(e) => handleChange('fixed_overhead', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Subcontractor Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.subcontractor_cost}
                                    onChange={(e) => handleChange('subcontractor_cost', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Packaging Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.packaging_cost}
                                    onChange={(e) => handleChange('packaging_cost', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Freight Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.freight_cost}
                                    onChange={(e) => handleChange('freight_cost', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Other Costs (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.other_costs}
                                    onChange={(e) => handleChange('other_costs', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Totals & Pricing */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center text-lg font-semibold border-b pb-2">
                            <span>Total Cost Per Unit:</span>
                            <span className="text-emerald-600">SAR {formData.total_cost_per_unit.toFixed(2)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Target Margin %</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={formData.target_margin_percent}
                                    onChange={(e) => handleChange('target_margin_percent', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Suggested Selling Price</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.suggested_selling_price.toFixed(2)}
                                    disabled
                                    className="bg-blue-50 font-semibold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Actual Selling Price</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.actual_selling_price}
                                    onChange={(e) => handleChange('actual_selling_price', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Actual Margin %</Label>
                                <Input
                                    type="number"
                                    value={formData.actual_margin_percent.toFixed(2)}
                                    disabled
                                    className="bg-green-50 font-semibold"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="superseded">Superseded</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Routing Reference</Label>
                            <Input
                                value={formData.routing_reference}
                                onChange={(e) => handleChange('routing_reference', e.target.value)}
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
                            {item ? 'Update' : 'Calculate'} Cost
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}