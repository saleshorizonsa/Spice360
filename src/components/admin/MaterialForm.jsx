import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { validateDuplicateItemCode } from "@/lib/itemSelection";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import SearchableSelect from "@/components/ui/SearchableSelect";

export default function MaterialForm({ material, initialValues = {}, onClose, onSaved }) {
    const taxConfig = useTaxConfig();
    const [formData, setFormData] = useState(material || {
        material_code: "",
        material_name: "",
        material_type: "raw_material",
        unit_of_measure: "kg",
        unit_price: 0,
        unit_cost: 0,
        current_stock: 0,
        reorder_point: 0,
        max_stock_level: 0,
        group_code: "",
        subgroup_code: "",
        location_code: "",
        supplier_code: "",
        supplier_name: "",
        lead_time_days: 0,
        specifications: "",
        vat_rate: taxConfig.vat_standard_rate,
        inventory_tracking_enabled: true,
        status: "active"
    });
    const [validationErrors, setValidationErrors] = useState({});

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: materialGroups = [] } = useQuery({
        queryKey: ['materialGroups'],
        queryFn: () => matrixSales.entities.MaterialGroup.list(),
        initialData: []
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => matrixSales.entities.Vendor.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const materialGroupOptions = useMemo(() =>
        materialGroups.map(group => ({
            value: group.group_code,
            label: group.group_name
        })),
        [materialGroups]
    );

    const vendorOptions = useMemo(() =>
        vendors.map(vendor => ({
            value: vendor.vendor_code,
            label: vendor.vendor_code + " - " + vendor.vendor_name
        })),
        [vendors]
    );

    React.useEffect(() => {
        if (!material && Object.keys(initialValues || {}).length > 0) {
            setFormData(prev => ({ ...prev, ...initialValues }));
        }
    }, [initialValues, material]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (material?.id) {
                return matrixSales.entities.Material.update(material.id, data);
            } else {
                return matrixSales.entities.Material.create(data);
            }
        },
        onSuccess: (savedMaterial) => {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            toast({
                title: "Success",
                description: `Material ${material?.id ? 'updated' : 'created'} successfully`,
            });
            onSaved?.(savedMaterial);
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || `Failed to ${material?.id ? 'update' : 'create'} material`,
                variant: "destructive",
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const errors = {};

        if (!formData.material_code?.trim()) errors.material_code = "Material code is required.";
        if (!formData.material_name?.trim()) errors.material_name = "Material name is required.";
        if (!formData.unit_of_measure) errors.unit_of_measure = "Unit of measure is required.";
        if (validateDuplicateItemCode(materials, formData.material_code, material?.id)) {
            errors.material_code = "This item code already exists for this tenant.";
        }

        setValidationErrors(errors);
        if (Object.keys(errors).length > 0) return;

        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{material?.id ? 'Edit' : 'New'} Material</CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material Code *</Label>
                            <Input
                                value={formData.material_code}
                                onChange={(e) => handleChange('material_code', e.target.value.toUpperCase())}
                                placeholder="M001"
                                required
                                disabled={!!material?.id}
                            />
                            {validationErrors.material_code && (
                                <p className="mt-1 text-xs text-red-600">{validationErrors.material_code}</p>
                            )}
                        </div>
                        <div>
                            <Label>Material Name *</Label>
                            <Input
                                value={formData.material_name}
                                onChange={(e) => handleChange('material_name', e.target.value)}
                                placeholder="PVC Pipe 50mm"
                                required
                            />
                            {validationErrors.material_name && (
                                <p className="mt-1 text-xs text-red-600">{validationErrors.material_name}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material Type *</Label>
                            <Select value={formData.material_type} onValueChange={(val) => handleChange('material_type', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="raw_material">Raw Material</SelectItem>
                                    <SelectItem value="finished_product">Finished Product</SelectItem>
                                    <SelectItem value="semi_finished">Semi-Finished</SelectItem>
                                    <SelectItem value="consumable">Consumable</SelectItem>
                                    <SelectItem value="spare_part">Spare Part</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Unit of Measure *</Label>
                            <Select value={formData.unit_of_measure} onValueChange={(val) => handleChange('unit_of_measure', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                                    <SelectItem value="liter">Liter</SelectItem>
                                    <SelectItem value="ton">Ton</SelectItem>
                                    <SelectItem value="meter">Meter</SelectItem>
                                    <SelectItem value="piece">Piece</SelectItem>
                                    <SelectItem value="sqm">Square Meter</SelectItem>
                                    <SelectItem value="box">Box</SelectItem>
                                    <SelectItem value="pallet">Pallet</SelectItem>
                                </SelectContent>
                            </Select>
                            {validationErrors.unit_of_measure && (
                                <p className="mt-1 text-xs text-red-600">{validationErrors.unit_of_measure}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Unit Price (LKR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.unit_price}
                                onChange={(e) => handleChange('unit_price', parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <Label>Unit Cost (LKR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.unit_cost}
                                onChange={(e) => handleChange('unit_cost', parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <Label>Current Stock</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.current_stock}
                                onChange={(e) => handleChange('current_stock', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>VAT Rate (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.vat_rate}
                                onChange={(e) => handleChange('vat_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <Label>Inventory Tracking</Label>
                            <Select
                                value={formData.inventory_tracking_enabled ? "enabled" : "disabled"}
                                onValueChange={(val) => handleChange('inventory_tracking_enabled', val === "enabled")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="enabled">Enabled</SelectItem>
                                    <SelectItem value="disabled">Disabled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Reorder Point</Label>
                            <Input
                                type="number"
                                value={formData.reorder_point}
                                onChange={(e) => handleChange('reorder_point', parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <Label>Max Stock Level</Label>
                            <Input
                                type="number"
                                value={formData.max_stock_level}
                                onChange={(e) => handleChange('max_stock_level', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material Group</Label>
                            <SearchableSelect
                                mode="client"
                                value={formData.group_code}
                                onChange={(val) => handleChange('group_code', val)}
                                options={materialGroupOptions}
                                placeholder="Select group"
                                searchPlaceholder="Search groups..."
                                clearable
                            />
                        </div>
                        <div>
                            <Label>Primary Supplier</Label>
                            <SearchableSelect
                                mode="client"
                                value={formData.supplier_code}
                                onChange={(val) => {
                                    handleChange('supplier_code', val);
                                    const vendor = vendors.find(v => v.vendor_code === val);
                                    if (vendor) handleChange('supplier_name', vendor.vendor_name);
                                }}
                                options={vendorOptions}
                                placeholder="Select supplier"
                                searchPlaceholder="Search suppliers..."
                                clearable
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Lead Time (Days)</Label>
                            <Input
                                type="number"
                                value={formData.lead_time_days}
                                onChange={(e) => handleChange('lead_time_days', parseInt(e.target.value))}
                            />
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
                                    <SelectItem value="discontinued">Discontinued</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Specifications</Label>
                        <Textarea
                            value={formData.specifications}
                            onChange={(e) => handleChange('specifications', e.target.value)}
                            placeholder="Technical specifications, dimensions, etc."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Material
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
