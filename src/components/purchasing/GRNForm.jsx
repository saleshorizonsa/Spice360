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
import { Package, RefreshCw } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { processGoodsReceipt } from "../utils/inventoryIntegration";
import { logAuditTrail } from "../utils/auditTrail";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

export default function GRNForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [isDirty, setIsDirty] = useState(false);
    useUnsavedChangesWarning(isDirty);
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

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

    const { data: purchaseOrders = [] } = useQuery({
        queryKey: ['purchaseOrders', currentOrg?.id],
        queryFn: () => matrixSales.entities.PurchaseOrder.list('-po_date'),
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
        grn_number: '',
        organization_id: currentOrg?.id || '',
        grn_date: new Date().toISOString().split('T')[0],
        po_number: '',
        vendor_code: '',
        vendor_name: '',
        material_code: '',
        material_name: '',
        quantity_ordered: 0,
        quantity_received: 0,
        unit_of_measure: '',
        unit_price: 0,
        total_value: 0,
        receipt_date: new Date().toISOString().split('T')[0],
        receiving_location: '',
        storage_bin: '',
        batch_number: '',
        quality_status: 'pending',
        received_by: currentUser?.full_name || '',
        delivery_note: '',
        vehicle_number: '',
        status: 'draft',
        stock_posted: false,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({
                ...item,
                organization_id: item.organization_id || currentOrg?.id
            });
        } else {
            setFormData(prev => ({ 
                ...prev, 
                organization_id: currentOrg?.id,
                received_by: currentUser?.full_name || ''
            }));
            generateGRNNumber();
        }
    }, [item, currentOrg, currentUser]);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            total_value: prev.quantity_received * prev.unit_price
        }));
    }, [formData.quantity_received, formData.unit_price]);

    const generateGRNNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('grn');
            setFormData(prev => ({ ...prev, grn_number: number }));
        } catch (error) {
            console.error("Error generating GRN number:", error);
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    const handlePOSelect = (poNumber) => {
        const po = purchaseOrders.find(p => p.po_number === poNumber);
        if (po) {
            setFormData(prev => ({
                ...prev,
                po_number: poNumber,
                vendor_code: po.vendor_code,
                vendor_name: po.vendor_name,
                material_code: po.material_code,
                material_name: po.material_name,
                quantity_ordered: po.quantity,
                unit_of_measure: po.unit_of_measure,
                unit_price: po.unit_price
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let grn;
            const beforeData = item ? { ...item } : null;

            if (item) {
                grn = await matrixSales.entities.GoodsReceiptNote.update(item.id, data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'grn',
                    entityId: item.id,
                    documentNumber: data.grn_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                grn = await matrixSales.entities.GoodsReceiptNote.create(data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'grn',
                    entityId: grn.id,
                    documentNumber: data.grn_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: 'info',
                    relatedDocumentType: 'purchase_order',
                    relatedDocumentId: data.po_number
                });
            }

            return grn;
        },
        onSuccess: async (savedGRN) => {
            // Auto-post to stock when creating a new GRN
            if (!item && savedGRN?.id && savedGRN?.receiving_location) {
                try {
                    // Use savedGRN (the stored record) to avoid stale closure issues
                    await processGoodsReceipt(savedGRN, currentUser);
                    await matrixSales.entities.GoodsReceiptNote.update(savedGRN.id, {
                        stock_posted: true,
                        status: 'completed'
                    });
                } catch (postErr) {
                    console.error('Auto post-to-stock failed:', postErr);
                    toast({
                        title: "GRN Created",
                        description: "GRN saved but stock posting failed. Use 'Post to Stock' to retry.",
                        variant: "destructive"
                    });
                    queryClient.invalidateQueries({ queryKey: ['grns'] });
                    onClose();
                    return;
                }
            }
            queryClient.invalidateQueries({ queryKey: ['grns'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "GRN updated" : "GRN created and stock posted",
            });
            onClose();
        }
    });

    const handlePostToStock = async () => {
        if (!formData.receiving_location) {
            toast({
                title: "Error",
                description: "Please select a receiving location before posting to stock",
                variant: "destructive"
            });
            return;
        }

        setIsPosting(true);
        try {
            // Process goods receipt
            await processGoodsReceipt(formData, currentUser);

            // Update GRN
            await matrixSales.entities.GoodsReceiptNote.update(item?.id || formData.id, {
                stock_posted: true,
                status: 'completed'
            });

            // Update PO quantity received
            const pos = await matrixSales.entities.PurchaseOrder.filter({ po_number: formData.po_number });
            if (pos && pos.length > 0) {
                const po = pos[0];
                await matrixSales.entities.PurchaseOrder.update(po.id, {
                    quantity_received: (po.quantity_received || 0) + formData.quantity_received
                });
            }

            queryClient.invalidateQueries();
            toast({
                title: "Success",
                description: "Stock posted successfully. Inventory updated.",
            });
            onClose();
        } catch (error) {
            console.error('Error posting stock:', error);
            toast({
                title: "Error",
                description: "Failed to post stock. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsPosting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.receiving_location) {
            toast({
                title: "Receiving Location Required",
                description: "Please select a receiving location before saving the GRN.",
                variant: "destructive"
            });
            return;
        }
        if (!formData.quantity_received || formData.quantity_received <= 0) {
            toast({
                title: "Quantity Required",
                description: "Please enter the received quantity before saving.",
                variant: "destructive"
            });
            return;
        }
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const approvedPOs = purchaseOrders.filter(po => 
        po.status === 'approved' || po.status === 'sent_to_vendor'
    );

    const poOptions = approvedPOs.map(po => ({
        value: po.po_number,
        label: `${po.po_number} - ${po.vendor_name} - ${po.material_name}`
    }));

    const locationOptions = locations.map(l => ({
        value: l.location_code,
        label: `${l.location_code} - ${l.location_name}`
    }));

    const binOptions = bins.filter(b => b.warehouse_code === formData.receiving_location).map(b => ({
        value: b.bin_code,
        label: `${b.bin_code} - ${b.bin_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Goods Receipt Note' : 'New Goods Receipt Note'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* GRN Header */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">GRN Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>GRN Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.grn_number}
                                        onChange={(e) => handleChange('grn_number', e.target.value)}
                                        required
                                        disabled={isGeneratingNumber}
                                    />
                                    {!item && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateGRNNumber}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>GRN Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.grn_date}
                                    onChange={(e) => handleChange('grn_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Receipt Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.receipt_date}
                                    onChange={(e) => handleChange('receipt_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* PO Reference */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Purchase Order Reference</h3>
                        <SearchableSelect
                            label="Purchase Order *"
                            value={formData.po_number}
                            onValueChange={handlePOSelect}
                            options={poOptions}
                            placeholder="Select purchase order..."
                            searchPlaceholder="Search POs..."
                        />
                    </div>

                    {/* Material & Quantities */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Material & Quantities</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Material Name</Label>
                                <Input
                                    value={formData.material_name}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label>Vendor Name</Label>
                                <Input
                                    value={formData.vendor_name}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Ordered Quantity</Label>
                                <Input
                                    type="number"
                                    value={formData.quantity_ordered}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label>Received Quantity *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.quantity_received}
                                    onChange={(e) => handleChange('quantity_received', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Unit Price (LKR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.unit_price}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Storage Location */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Storage Location</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <SearchableSelect
                                label="Receiving Location *"
                                value={formData.receiving_location}
                                onValueChange={(val) => handleChange('receiving_location', val)}
                                options={locationOptions}
                                placeholder="Select warehouse..."
                                searchPlaceholder="Search warehouses..."
                            />
                            <SearchableSelect
                                label="Storage Bin"
                                value={formData.storage_bin}
                                onValueChange={(val) => handleChange('storage_bin', val)}
                                options={binOptions}
                                placeholder="Select bin..."
                                searchPlaceholder="Search bins..."
                            />
                            <div>
                                <Label>Batch/Lot Number</Label>
                                <Input
                                    value={formData.batch_number}
                                    onChange={(e) => handleChange('batch_number', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Quality Status</Label>
                                <Select 
                                    value={formData.quality_status} 
                                    onValueChange={(val) => handleChange('quality_status', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="passed">Passed</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="quarantine">Quarantine</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Delivery Note #</Label>
                                <Input
                                    value={formData.delivery_note}
                                    onChange={(e) => handleChange('delivery_note', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Vehicle Number</Label>
                                <Input
                                    value={formData.vehicle_number}
                                    onChange={(e) => handleChange('vehicle_note', e.target.value)}
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

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <Label className="text-lg">Total Receipt Value</Label>
                            <div className="text-2xl font-bold text-emerald-600 mt-2">
                                LKR {formData.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between gap-3 pt-4 border-t">
                        <div>
                            {item && !item.stock_posted && (
                                <Button
                                    type="button"
                                    onClick={handlePostToStock}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                    disabled={isPosting}
                                >
                                    {isPosting ? 'Posting...' : 'Post to Stock'}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                {item ? 'Update' : 'Create'} GRN
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}