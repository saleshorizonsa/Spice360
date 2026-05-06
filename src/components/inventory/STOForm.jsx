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

export default function STOForm({ item, onClose }) {
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

    const [formData, setFormData] = useState({
        sto_number: '',
        organization_id: currentOrg?.id || '',
        sto_date: new Date().toISOString().split('T')[0],
        from_warehouse_code: '',
        from_warehouse_name: '',
        to_warehouse_code: '',
        to_warehouse_name: '',
        material_code: '',
        material_name: '',
        quantity_requested: 0,
        quantity_shipped: 0,
        quantity_received: 0,
        unit_of_measure: '',
        required_date: '',
        shipment_date: '',
        receipt_date: '',
        shipping_method: '',
        tracking_number: '',
        status: 'draft',
        priority: 'normal',
        reason: '',
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
            generateSTONumber();
        }
    }, [item, currentOrg]);

    const generateSTONumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('stock_transfer');
            setFormData(prev => ({ ...prev, sto_number: number }));
        } catch (error) {
            console.error("Error generating STO number:", error);
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
                unit_of_measure: material.unit_of_measure
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let sto;
            const beforeData = item ? { ...item } : null;

            if (item) {
                sto = await matrixSales.entities.StockTransferOrder.update(item.id, data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'stock_transfer',
                    entityId: item.id,
                    documentNumber: data.sto_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                sto = await matrixSales.entities.StockTransferOrder.create(data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'stock_transfer',
                    entityId: sto.id,
                    documentNumber: data.sto_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: data.quantity_requested > 1000 ? 'warning' : 'info'
                });
            }

            return sto;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stos'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "STO updated" : "STO created",
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

    const materialOptions = materials.map(m => ({
        value: m.material_code,
        label: `${m.material_code} - ${m.material_name}`
    }));

    const locationOptions = locations.map(l => ({
        value: l.location_code,
        label: `${l.location_code} - ${l.location_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Stock Transfer Order' : 'New Stock Transfer Order'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* STO Header */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Transfer Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>STO Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.sto_number}
                                        onChange={(e) => handleChange('sto_number', e.target.value)}
                                        required
                                        disabled={isGeneratingNumber}
                                    />
                                    {!item && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateSTONumber}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>STO Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.sto_date}
                                    onChange={(e) => handleChange('sto_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Required Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.required_date}
                                    onChange={(e) => handleChange('required_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Warehouse Transfer */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Warehouse Transfer</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SearchableSelect
                                label="From Warehouse *"
                                value={formData.from_warehouse_code}
                                onValueChange={(val) => {
                                    const loc = locations.find(l => l.location_code === val);
                                    handleChange('from_warehouse_code', val);
                                    handleChange('from_warehouse_name', loc?.location_name || '');
                                }}
                                options={locationOptions}
                                placeholder="Select source warehouse..."
                                searchPlaceholder="Search warehouses..."
                            />
                            <SearchableSelect
                                label="To Warehouse *"
                                value={formData.to_warehouse_code}
                                onValueChange={(val) => {
                                    const loc = locations.find(l => l.location_code === val);
                                    handleChange('to_warehouse_code', val);
                                    handleChange('to_warehouse_name', loc?.location_name || '');
                                }}
                                options={locationOptions}
                                placeholder="Select destination warehouse..."
                                searchPlaceholder="Search warehouses..."
                            />
                        </div>
                    </div>

                    {/* Material & Quantities */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Material & Quantities</h3>
                        <SearchableSelect
                            label="Material *"
                            value={formData.material_code}
                            onValueChange={handleMaterialSelect}
                            options={materialOptions}
                            placeholder="Select material..."
                            searchPlaceholder="Search materials..."
                        />

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Requested Quantity *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantity_requested}
                                    onChange={(e) => handleChange('quantity_requested', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Shipped Quantity</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantity_shipped}
                                    onChange={(e) => handleChange('quantity_shipped', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Received Quantity</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantity_received}
                                    onChange={(e) => handleChange('quantity_received', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
                        <div className="grid grid-cols-3 gap-4">
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
                                        <SelectItem value="submitted">Submitted</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="in_transit">In Transit</SelectItem>
                                        <SelectItem value="received">Received</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Priority</Label>
                                <Select 
                                    value={formData.priority} 
                                    onValueChange={(val) => handleChange('priority', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Tracking Number</Label>
                                <Input
                                    value={formData.tracking_number}
                                    onChange={(e) => handleChange('tracking_number', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Reason for Transfer</Label>
                            <Input
                                value={formData.reason}
                                onChange={(e) => handleChange('reason', e.target.value)}
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
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} STO
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}