import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Calculator } from "lucide-react";

export default function UnitConversionForm({ item, materialCode, onClose = () => {}, open = true }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        conversion_id: '',
        material_code: materialCode || '',
        material_name: '',
        from_unit: 'piece',
        to_unit: 'bundle',
        conversion_factor: 1,
        inverse_conversion_factor: 1,
        description: '',
        is_default: false,
        status: 'active',
        notes: ''
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else if (materialCode) {
            const material = materials.find(m => m.material_code === materialCode);
            if (material) {
                setFormData(prev => ({
                    ...prev,
                    material_name: material.material_name,
                    from_unit: material.unit_of_measure
                }));
            }
        }
    }, [item, materialCode, materials]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.UnitConversion.update(item.id, data);
            }
            return matrixSales.entities.UnitConversion.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unitConversions'] });
            toast({
                title: "Success",
                description: `Unit Conversion ${item ? 'updated' : 'created'} successfully`,
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Auto-generate conversion ID if not set
        if (!formData.conversion_id) {
            const id = `CONV-${formData.material_code}-${formData.from_unit}-${formData.to_unit}`.toUpperCase();
            formData.conversion_id = id;
        }

        // Auto-generate description
        if (!formData.description) {
            formData.description = `1 ${formData.to_unit} = ${formData.conversion_factor} ${formData.from_unit}`;
        }

        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            
            // Auto-calculate inverse factor
            if (field === 'conversion_factor' && value > 0) {
                updated.inverse_conversion_factor = 1 / value;
            }
            
            return updated;
        });
    };

    const unitOptions = [
        { value: 'piece', label: 'Piece (Pcs)' },
        { value: 'bundle', label: 'Bundle' },
        { value: 'box', label: 'Box' },
        { value: 'carton', label: 'Carton' },
        { value: 'pallet', label: 'Pallet' },
        { value: 'kg', label: 'Kilogram (kg)' },
        { value: 'ton', label: 'Ton' },
        { value: 'meter', label: 'Meter' },
        { value: 'sqm', label: 'Square Meter' },
        { value: 'liter', label: 'Liter' }
    ];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        {item ? 'Edit Unit Conversion' : 'New Unit Conversion'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material *</Label>
                            <Select 
                                value={formData.material_code} 
                                onValueChange={(val) => {
                                    handleChange('material_code', val);
                                    const material = materials.find(m => m.material_code === val);
                                    if (material) {
                                        handleChange('material_name', material.material_name);
                                        handleChange('from_unit', material.unit_of_measure);
                                    }
                                }}
                                required
                                disabled={!!materialCode}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materials.map(material => (
                                        <SelectItem key={material.material_code} value={material.material_code}>
                                            {material.material_code} - {material.material_name}
                                        </SelectItem>
                                    ))}
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
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>From Unit (Base) *</Label>
                            <Select 
                                value={formData.from_unit} 
                                onValueChange={(val) => handleChange('from_unit', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {unitOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>To Unit (Target) *</Label>
                            <Select 
                                value={formData.to_unit} 
                                onValueChange={(val) => handleChange('to_unit', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {unitOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Conversion Factor *</Label>
                            <Input
                                type="number"
                                step="0.0001"
                                value={formData.conversion_factor}
                                onChange={(e) => handleChange('conversion_factor', parseFloat(e.target.value) || 1)}
                                required
                                placeholder="e.g., 100 (1 bundle = 100 pieces)"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                1 {formData.to_unit} = {formData.conversion_factor} {formData.from_unit}
                            </p>
                        </div>
                        <div>
                            <Label>Inverse Factor (Auto-calculated)</Label>
                            <Input
                                type="number"
                                step="0.0001"
                                value={formData.inverse_conversion_factor.toFixed(4)}
                                disabled
                                className="bg-gray-50"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                1 {formData.from_unit} = {formData.inverse_conversion_factor.toFixed(4)} {formData.to_unit}
                            </p>
                        </div>
                    </div>

                    <div>
                        <Label>Description (Auto-generated)</Label>
                        <Input
                            value={formData.description || `1 ${formData.to_unit} = ${formData.conversion_factor} ${formData.from_unit}`}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Conversion description"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="is_default"
                            checked={formData.is_default}
                            onCheckedChange={(checked) => handleChange('is_default', checked)}
                        />
                        <label htmlFor="is_default" className="text-sm font-medium">
                            Set as default conversion for this material
                        </label>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">Common Conversions:</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• 1 Bundle = 100 Pieces (factor: 100)</li>
                            <li>• 1 Box = 12 Pieces (factor: 12)</li>
                            <li>• 1 Pallet = 1000 Pieces (factor: 1000)</li>
                            <li>• 1 Ton = 1000 kg (factor: 1000)</li>
                        </ul>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Conversion
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
