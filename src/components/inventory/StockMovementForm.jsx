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
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { logAuditTrail } from "../utils/auditTrail";

export default function StockMovementForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    // Get current user
    const [currentUser, setCurrentUser] = useState(null);
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: materials = [] } = useQuery({
        queryKey: ['materials', currentOrg?.id],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: locations = [] } = useQuery({
        queryKey: ['locations', currentOrg?.id],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    const { data: bins = [] } = useQuery({
        queryKey: ['bins', currentOrg?.id],
        queryFn: () => matrixSales.entities.WarehouseBin.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        movement_number: '',
        organization_id: currentOrg?.id || '',
        movement_date: new Date().toISOString().split('T')[0],
        movement_type: 'goods_receipt',
        material_code: '',
        material_name: '',
        batch_number: '',
        quantity: 0,
        unit_of_measure: '',
        from_warehouse: '',
        from_bin: '',
        to_warehouse: '',
        to_bin: '',
        reference_document: '',
        reason: '',
        cost_per_unit: 0,
        total_value: 0,
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({
                ...item,
                organization_id: item.organization_id || currentOrg?.id
            });
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
            generateMovementNumber();
        }
    }, [item, currentOrg]);

    useEffect(() => {
        // Calculate total value
        const total = formData.quantity * formData.cost_per_unit;
        setFormData(prev => ({ ...prev, total_value: total }));
    }, [formData.quantity, formData.cost_per_unit]);

    const generateMovementNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('stock_movement');
            setFormData(prev => ({ ...prev, movement_number: number }));
        } catch (error) {
            console.error("Error generating movement number:", error);
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    const handleMaterialSelect = (materialCode) => {
        const material = materials.find(m => m.material_code === materialCode);
        if (material) {
            setFormData(prev => ({
                ...prev,
                material_code: materialCode,
                material_name: material.material_name,
                unit_of_measure: material.unit_of_measure,
                cost_per_unit: material.unit_cost || 0
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let movement;
            const beforeData = item ? { ...item } : null;

            if (item) {
                movement = await matrixSales.entities.StockMovement.update(item.id, data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'stock_movement',
                    entityId: item.id,
                    documentNumber: data.movement_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                movement = await matrixSales.entities.StockMovement.create(data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'stock_movement',
                    entityId: movement.id,
                    documentNumber: data.movement_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: data.quantity > 1000 ? 'warning' : 'info'
                });

                // If movement is posted, update stock levels
                if (data.status === 'posted') {
                    await updateStockLevels(movement);
                }
            }

            return movement;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movements'] });
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "Stock movement updated" : "Stock movement created",
            });
            onClose();
        }
    });

    const updateStockLevels = async (movement) => {
        try {
            // Get or create stock level records
            if (movement.movement_type === 'goods_receipt') {
                await updateOrCreateStockLevel(
                    movement.material_code,
                    movement.to_warehouse,
                    movement.to_bin,
                    movement.batch_number,
                    movement.quantity,
                    'increase'
                );
            } else if (movement.movement_type === 'goods_issue') {
                await updateOrCreateStockLevel(
                    movement.material_code,
                    movement.from_warehouse,
                    movement.from_bin,
                    movement.batch_number,
                    movement.quantity,
                    'decrease'
                );
            } else if (movement.movement_type === 'transfer') {
                // Decrease from source
                await updateOrCreateStockLevel(
                    movement.material_code,
                    movement.from_warehouse,
                    movement.from_bin,
                    movement.batch_number,
                    movement.quantity,
                    'decrease'
                );
                // Increase to destination
                await updateOrCreateStockLevel(
                    movement.material_code,
                    movement.to_warehouse,
                    movement.to_bin,
                    movement.batch_number,
                    movement.quantity,
                    'increase'
                );
            }
        } catch (error) {
            console.error('Error updating stock levels:', error);
        }
    };

    const updateOrCreateStockLevel = async (materialCode, warehouse, bin, batch, quantity, operation) => {
        const material = materials.find(m => m.material_code === materialCode);
        
        // Find existing stock level
        const existingStock = await matrixSales.entities.StockLevel.filter({
            material_code: materialCode,
            warehouse_code: warehouse,
            bin_code: bin,
            batch_number: batch
        });

        if (existingStock && existingStock.length > 0) {
            // Update existing
            const stock = existingStock[0];
            const newQty = operation === 'increase' 
                ? (stock.quantity || 0) + quantity 
                : (stock.quantity || 0) - quantity;
            const newAvailable = newQty - (stock.reserved_quantity || 0);

            await matrixSales.entities.StockLevel.update(stock.id, {
                quantity: newQty,
                available_quantity: newAvailable,
                total_value: newQty * (stock.unit_cost || 0),
                last_movement_date: new Date().toISOString().split('T')[0]
            });
        } else {
            // Create new stock level
            await matrixSales.entities.StockLevel.create({
                organization_id: currentOrg?.id,
                material_code: materialCode,
                material_name: material?.material_name || '',
                warehouse_code: warehouse,
                warehouse_name: locations.find(l => l.location_code === warehouse)?.location_name || warehouse,
                bin_code: bin,
                batch_number: batch,
                quantity: operation === 'increase' ? quantity : 0,
                reserved_quantity: 0,
                available_quantity: operation === 'increase' ? quantity : 0,
                unit_of_measure: material?.unit_of_measure || '',
                unit_cost: material?.unit_cost || 0,
                total_value: quantity * (material?.unit_cost || 0),
                last_movement_date: new Date().toISOString().split('T')[0],
                status: 'available'
            });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const materialOptions = materials.map(m => ({
        value: m.material_code,
        label: `${m.material_code} - ${m.material_name}`
    }));

    const locationOptions = locations.map(l => ({
        value: l.location_code,
        label: `${l.location_code} - ${l.location_name}`
    }));

    const binOptions = bins.map(b => ({
        value: b.bin_code,
        label: `${b.bin_code} - ${b.bin_name} (${b.warehouse_name})`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Stock Movement' : 'New Stock Movement'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Movement Header */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Movement Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Movement Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.movement_number}
                                        onChange={(e) => handleChange('movement_number', e.target.value)}
                                        required
                                        disabled={isGeneratingNumber}
                                    />
                                    {!item && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateMovementNumber}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>Movement Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.movement_date}
                                    onChange={(e) => handleChange('movement_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Movement Type *</Label>
                                <Select 
                                    value={formData.movement_type} 
                                    onValueChange={(val) => handleChange('movement_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="goods_receipt">Goods Receipt</SelectItem>
                                        <SelectItem value="goods_issue">Goods Issue</SelectItem>
                                        <SelectItem value="transfer">Transfer</SelectItem>
                                        <SelectItem value="adjustment">Adjustment</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                        <SelectItem value="return">Return</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Material Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Material Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SearchableSelect
                                label="Material *"
                                value={formData.material_code}
                                onValueChange={handleMaterialSelect}
                                options={materialOptions}
                                placeholder="Select material..."
                                searchPlaceholder="Search materials..."
                            />
                            <div>
                                <Label>Batch/Lot Number</Label>
                                <Input
                                    value={formData.batch_number}
                                    onChange={(e) => handleChange('batch_number', e.target.value)}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Quantity *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantity}
                                    onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Unit of Measure</Label>
                                <Input
                                    value={formData.unit_of_measure}
                                    onChange={(e) => handleChange('unit_of_measure', e.target.value)}
                                    disabled
                                />
                            </div>
                            <div>
                                <Label>Unit Cost (LKR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.cost_per_unit}
                                    onChange={(e) => handleChange('cost_per_unit', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Location Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Location Details</h3>
                        
                        {(formData.movement_type === 'goods_issue' || formData.movement_type === 'transfer') && (
                            <div className="grid grid-cols-2 gap-4">
                                <SearchableSelect
                                    label="From Warehouse *"
                                    value={formData.from_warehouse}
                                    onValueChange={(val) => handleChange('from_warehouse', val)}
                                    options={locationOptions}
                                    placeholder="Select warehouse..."
                                    searchPlaceholder="Search warehouses..."
                                />
                                <SearchableSelect
                                    label="From Bin"
                                    value={formData.from_bin}
                                    onValueChange={(val) => handleChange('from_bin', val)}
                                    options={binOptions.filter(b => b.warehouse_code === formData.from_warehouse)}
                                    placeholder="Select bin..."
                                    searchPlaceholder="Search bins..."
                                />
                            </div>
                        )}

                        {(formData.movement_type === 'goods_receipt' || formData.movement_type === 'transfer') && (
                            <div className="grid grid-cols-2 gap-4">
                                <SearchableSelect
                                    label="To Warehouse *"
                                    value={formData.to_warehouse}
                                    onValueChange={(val) => handleChange('to_warehouse', val)}
                                    options={locationOptions}
                                    placeholder="Select warehouse..."
                                    searchPlaceholder="Search warehouses..."
                                />
                                <SearchableSelect
                                    label="To Bin"
                                    value={formData.to_bin}
                                    onValueChange={(val) => handleChange('to_bin', val)}
                                    options={binOptions.filter(b => b.warehouse_code === formData.to_warehouse)}
                                    placeholder="Select bin..."
                                    searchPlaceholder="Search bins..."
                                />
                            </div>
                        )}
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Reference Document</Label>
                                <Input
                                    value={formData.reference_document}
                                    onChange={(e) => handleChange('reference_document', e.target.value)}
                                    placeholder="PO/SO/STO/Production Order #"
                                />
                            </div>
                            <div>
                                <Label>Status *</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => handleChange('status', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="posted">Posted</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Reason</Label>
                            <Input
                                value={formData.reason}
                                onChange={(e) => handleChange('reason', e.target.value)}
                                placeholder="Reason for movement"
                            />
                        </div>

                        <div>
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <Label className="text-lg">Total Movement Value</Label>
                            <div className="text-2xl font-bold text-emerald-600 mt-2">
                                LKR {formData.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Movement
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}