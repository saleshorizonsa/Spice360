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

export default function BOMForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        bom_number: '',
        bom_name: '',
        product_code: '',
        product_name: '',
        version: '1',
        base_quantity: 1,
        unit_of_measure: 'kg',
        bom_type: 'production',
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleProductSelect = (productCode) => {
        const product = materials.find(m => m.material_code === productCode);
        if (product) {
            setFormData(prev => ({
                ...prev,
                product_code: productCode,
                product_name: product.material_name,
                unit_of_measure: product.unit_of_measure
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.BOM.update(item.id, data);
            }
            return matrixSales.entities.BOM.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['boms'] });
            toast({
                title: "Success",
                description: `BOM ${item ? 'updated' : 'created'} successfully`,
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit BOM' : 'New Bill of Material'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>BOM Number *</Label>
                            <Input 
                                value={formData.bom_number}
                                onChange={(e) => handleChange('bom_number', e.target.value)}
                                required
                                placeholder="BOM-001"
                            />
                        </div>
                        <div>
                            <Label>BOM Name *</Label>
                            <Input 
                                value={formData.bom_name}
                                onChange={(e) => handleChange('bom_name', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Product *</Label>
                            <Select 
                                value={formData.product_code} 
                                onValueChange={handleProductSelect}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materials.filter(m => m.material_type === 'finished_product' || m.material_type === 'semi_finished').map(m => (
                                        <SelectItem key={m.id} value={m.material_code}>
                                            {m.material_code} - {m.material_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Version</Label>
                            <Input 
                                value={formData.version}
                                onChange={(e) => handleChange('version', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Base Quantity *</Label>
                            <Input 
                                type="number"
                                value={formData.base_quantity}
                                onChange={(e) => handleChange('base_quantity', parseFloat(e.target.value) || 1)}
                                required
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>Unit of Measure</Label>
                            <Input 
                                value={formData.unit_of_measure}
                                disabled
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>BOM Type</Label>
                            <Select 
                                value={formData.bom_type} 
                                onValueChange={(val) => handleChange('bom_type', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="production">Production</SelectItem>
                                    <SelectItem value="assembly">Assembly</SelectItem>
                                    <SelectItem value="engineering">Engineering</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => handleChange('status', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="obsolete">Obsolete</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Valid From *</Label>
                            <Input 
                                type="date"
                                value={formData.valid_from}
                                onChange={(e) => handleChange('valid_from', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Valid To</Label>
                            <Input 
                                type="date"
                                value={formData.valid_to}
                                onChange={(e) => handleChange('valid_to', e.target.value)}
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
                            {item ? 'Update' : 'Create'} BOM
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}