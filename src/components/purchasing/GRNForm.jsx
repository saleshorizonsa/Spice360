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
import { Badge } from "@/components/ui/badge";
import { Package, RefreshCw, AlertTriangle } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import {
    processGoodsReceipt,
    reverseGoodsReceipt,
    rollbackPurchaseOrderReceipt,
    assertGoodsReceiptReversible
} from "../utils/inventoryIntegration";
import ReverseButton from "../shared/ReverseButton";
import { logAuditTrail } from "../utils/auditTrail";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { postJournalEntry } from "../utils/journalService";
import { useGLAccounts } from "@/hooks/useGLAccounts";

export default function GRNForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
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
        lot_manufactured_date: '',
        expiry_date: '',
        phyto_cert_no: '',
        origin_country: 'Sri Lanka',
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
                // Claim the sequence number here, not on form open — an abandoned
                // form must not consume a number.
                data = {
                    ...data,
                    grn_number: data.grn_number?.trim() || await getNextDocumentNumber('grn'),
                };
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
        onError: (error) => {
            console.error('GRN save error:', error);
            toast({
                title: "Save Failed",
                description: error?.message || "Failed to save GRN. Please try again.",
                variant: "destructive"
            });
        },
        onSuccess: () => {
            // A GRN is never posted on save — it is created as a draft so it can be
            // reviewed and corrected first. Stock, GL and the PO are only touched by
            // the explicit "Post GRN" action below.
            queryClient.invalidateQueries({ queryKey: ['grns'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item
                    ? "GRN updated"
                    : "GRN saved as draft. Reopen it to review and post to stock.",
            });
            onClose();
        }
    });

    /**
     * Complete the GRN. This is the ONLY path that touches stock, the GL and the PO
     * — saving merely stores a reviewable draft. It persists any edits made in the
     * form first, so what you reviewed is what gets posted.
     */
    const handlePostToStock = async () => {
        const grnId = item?.id || formData.id;
        if (!grnId) {
            toast({
                title: "Save First",
                description: "Save the GRN as a draft before posting it.",
                variant: "destructive"
            });
            return;
        }
        if (item?.stock_posted) {
            toast({
                title: "Already Posted",
                description: "This GRN has already been posted to stock.",
                variant: "destructive"
            });
            return;
        }
        if (!formData.receiving_location) {
            toast({
                title: "Receiving Location Required",
                description: "Select a receiving location before posting to stock.",
                variant: "destructive"
            });
            return;
        }
        if (!formData.quantity_received || formData.quantity_received <= 0) {
            toast({
                title: "Quantity Required",
                description: "Enter the received quantity before posting to stock.",
                variant: "destructive"
            });
            return;
        }

        setIsPosting(true);
        try {
            // 1. Persist whatever is on screen, so the posted stock matches the
            //    reviewed document rather than the last-saved version.
            const posted = { ...formData, stock_posted: true, status: 'completed' };
            await matrixSales.entities.GoodsReceiptNote.update(grnId, posted);

            // 2. Move the stock. Fatal — if this fails, nothing below should run.
            await processGoodsReceipt(posted, currentUser);

            // 3. Inventory GL: Dr. Inventory, Cr. GRNI (Goods Received Not Invoiced).
            //    Non-fatal: inventory accounts may not be configured yet.
            try {
                const grnValue = (parseFloat(posted.quantity_received || posted.quantity) || 0)
                    * (parseFloat(posted.unit_cost || posted.unit_price) || 0);
                if (grnValue > 0) {
                    await postJournalEntry({
                        lines: [
                            { account_code: gl.inventory, account_name: 'Inventory',                   debit: grnValue, credit: 0 },
                            { account_code: gl.grni,      account_name: 'Goods Received Not Invoiced', debit: 0, credit: grnValue },
                        ],
                        referenceType: 'grn',
                        referenceId:   posted.grn_number,
                        description:   `Goods receipt ${posted.grn_number}`,
                        entryDate:     posted.grn_date || new Date().toISOString().split('T')[0],
                        entryType:     'goods_receipt',
                        orgId:         currentOrg?.id,
                        area:          "inventory"
                    });
                }
            } catch (_) { /* non-fatal — accounts may not be set up */ }

            // 4. Roll the receipt up to the PO; auto-close when fully received. Non-fatal.
            try {
                const pos = await matrixSales.entities.PurchaseOrder.filter({ po_number: posted.po_number });
                if (pos?.length > 0) {
                    const po = pos[0];
                    const newQtyReceived = (parseFloat(po.quantity_received) || 0) + (parseFloat(posted.quantity_received) || 0);
                    const isFullyReceived = newQtyReceived >= (parseFloat(po.quantity) || 0) - 0.001;
                    await matrixSales.entities.PurchaseOrder.update(po.id, {
                        quantity_received: newQtyReceived,
                        ...(isFullyReceived && !['closed', 'cancelled'].includes(po.status)
                            ? { status: 'fully_received' }
                            : {}),
                    });
                }
            } catch (_) { /* non-fatal */ }

            await logAuditTrail({
                entityType: 'grn',
                entityId: grnId,
                documentNumber: posted.grn_number,
                actionType: 'post_to_stock',
                beforeData: item,
                afterData: posted,
                user: currentUser,
                severity: 'warning',
                relatedDocumentType: 'purchase_order',
                relatedDocumentId: posted.po_number
            }).catch(() => {});

            queryClient.invalidateQueries();
            toast({
                title: "GRN Posted",
                description: `${posted.grn_number} completed. Inventory updated.`,
            });
            onClose();
        } catch (error) {
            console.error('Error posting stock:', error);
            toast({
                title: "Post Failed",
                description: error?.message || "Failed to post stock. The GRN remains a draft.",
                variant: "destructive"
            });
        } finally {
            setIsPosting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // A draft is a work-in-progress: it can be saved incomplete and corrected
        // later. The fields required to move stock are enforced at POST time instead.
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // A posted GRN has already moved stock and hit the GL, so its fields are locked.
    // Correcting it means reversing it, not editing it behind inventory's back.
    const isPosted = Boolean(item?.stock_posted);

    // Any PO still open for receiving. Previously this only allowed
    // 'approved'/'sent_to_vendor', which hid every PO — new POs are created as
    // 'draft' and stay there unless an approval matrix moves them on.
    const NON_RECEIVABLE_PO_STATUSES = ['fully_received', 'closed', 'cancelled'];

    const receivablePOs = purchaseOrders.filter(po =>
        !NON_RECEIVABLE_PO_STATUSES.includes(po.status)
    );

    const poOptions = receivablePOs.map(po => ({
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
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Goods Receipt Note' : 'New Goods Receipt Note'}
                        {item && (
                            isPosted ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Posted
                                </Badge>
                            ) : (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                                    Draft
                                </Badge>
                            )
                        )}
                    </DialogTitle>
                </DialogHeader>

                {item && !isPosted && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-sm text-amber-800">
                            This GRN is a <strong>draft</strong> — no stock has moved yet. Review the
                            quantities and storage location, then use <strong>Post GRN</strong> to
                            complete it and update inventory.
                        </p>
                    </div>
                )}

                {isPosted && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <Package className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <p className="text-sm text-emerald-800">
                            This GRN has been posted and inventory was updated, so it can no longer be
                            edited. Use <strong>Reverse GRN</strong> if it was posted in error.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Once posted, every field is read-only — a posted GRN must be
                        reversed, not quietly edited out from under inventory. */}
                    <fieldset disabled={isPosted} className="space-y-6 m-0 p-0 border-0 disabled:opacity-70">
                    {/* GRN Header */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">GRN Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>GRN Number</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.grn_number}
                                        onChange={(e) => handleChange('grn_number', e.target.value)}
                                        disabled={isGeneratingNumber}
                                        placeholder={item ? '' : 'Auto-generated on save'}
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

                        {/* Lot Details */}
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-teal-800">Lot / Traceability Details</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Manufactured Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.lot_manufactured_date}
                                        onChange={(e) => handleChange('lot_manufactured_date', e.target.value)}
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
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Phytosanitary Cert #</Label>
                                    <Input
                                        value={formData.phyto_cert_no}
                                        onChange={(e) => handleChange('phyto_cert_no', e.target.value)}
                                        placeholder="e.g. PC-2025-00123"
                                    />
                                </div>
                                <div>
                                    <Label>Country of Origin</Label>
                                    <Input
                                        value={formData.origin_country}
                                        onChange={(e) => handleChange('origin_country', e.target.value)}
                                        placeholder="Sri Lanka"
                                    />
                                </div>
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
                                    onChange={(e) => handleChange('vehicle_number', e.target.value)}
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
                    </fieldset>

                    <div className="flex justify-between gap-3 pt-4 border-t">
                        <div className="flex gap-2">
                            <ReverseButton
                                item={item}
                                entityName="GoodsReceiptNote"
                                queryKeys={['grns']}
                                onSuccess={onClose}
                                preflight={() => assertGoodsReceiptReversible(item)}
                                preAction={async () => {
                                    // Put the stock back, then take the receipt back off the
                                    // PO so it no longer claims the goods arrived.
                                    if (item?.stock_posted) {
                                        await reverseGoodsReceipt(formData, currentUser);
                                    }
                                    await rollbackPurchaseOrderReceipt(formData);
                                }}
                                label="Reverse GRN"
                                journalReferenceType="grn"
                                journalReferenceId={item?.grn_number}
                            />
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                                {isPosted ? 'Close' : 'Cancel'}
                            </Button>

                            {!isPosted && (
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={saveMutation.isPending || isPosting}
                                >
                                    {saveMutation.isPending
                                        ? 'Saving…'
                                        : item ? 'Save Draft' : 'Save as Draft'}
                                </Button>
                            )}

                            {/* The GRN is only completed here — this is what moves stock,
                                posts the GL entry and updates the PO. */}
                            {item && !isPosted && (
                                <Button
                                    type="button"
                                    onClick={handlePostToStock}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    disabled={isPosting || saveMutation.isPending}
                                >
                                    {isPosting ? 'Posting…' : 'Post GRN'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}