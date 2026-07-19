
import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createNotification } from "../utils/notificationService";
import { useOrganization } from "../utils/OrganizationContext";
import { RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DocumentFlow from "../shared/DocumentFlow";

export default function RFQForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const { currentOrg } = useOrganization();
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    useEffect(() => {
        matrixSales.auth.me().then(u => setCurrentUser(u)).catch(() => {});
    }, []);

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => matrixSales.entities.Vendor.list(),
        initialData: []
    });

    const { data: requisitions = [] } = useQuery({
        queryKey: ['requisitions'],
        queryFn: () => matrixSales.entities.PurchaseRequisition.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        rfq_number: '',
        rfq_date: new Date().toISOString().split('T')[0],
        pr_reference: '',
        material_code: '',
        material_name: '',
        quantity: 0,
        unit_of_measure: 'kg',
        required_date: '',
        closing_date: '',
        suppliers_invited: [],
        vendor_code: '',
        vendor_name: '',
        specifications: '',
        status: 'draft',
        notes: ''
    });

    const generateRFQNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('rfq');
            setFormData(prev => ({ ...prev, rfq_number: number }));
        } catch (error) {
            console.error("Error generating RFQ number:", error);
            toast({
                title: "Warning",
                description: "Could not auto-generate RFQ number.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    // suppliers_invited round-trips through jsonb and may come back as a JSON string
    const normalizeSuppliers = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value) {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return value.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        return [];
    };

    useEffect(() => {
        if (item) {
            setFormData({ ...item, suppliers_invited: normalizeSuppliers(item.suppliers_invited) });
        }
    }, [item]);

    const vendorName = (code) =>
        vendors.find(v => v.vendor_code === code)?.vendor_name || code;

    const handleInviteSupplier = (vendorCode) => {
        if (!vendorCode || formData.suppliers_invited.includes(vendorCode)) return;
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            suppliers_invited: [...prev.suppliers_invited, vendorCode]
        }));
    };

    const handleRemoveSupplier = (vendorCode) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            suppliers_invited: prev.suppliers_invited.filter(c => c !== vendorCode),
            // dropping the awarded vendor from the invite list clears the award
            ...(prev.vendor_code === vendorCode ? { vendor_code: '', vendor_name: '' } : {})
        }));
    };

    const handleAwardVendor = (vendorCode) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            vendor_code: vendorCode,
            vendor_name: vendorCode ? vendorName(vendorCode) : ''
        }));
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

    const handlePRSelect = (prNumber) => {
        const pr = requisitions.find(r => r.pr_number === prNumber);
        if (pr) {
            setFormData(prev => ({
                ...prev,
                pr_reference: prNumber,
                material_code: pr.material_code,
                material_name: pr.material_name,
                quantity: pr.quantity_required,
                unit_of_measure: pr.unit_of_measure,
                required_date: pr.required_date
            }));
        }
    };

    const prOptions = useMemo(() =>
        requisitions
            .filter(r => r.status === 'approved')
            .map(pr => ({
                value: pr.pr_number,
                label: `${pr.pr_number} - ${pr.material_name}`
            })),
        [requisitions]
    );

    const materialOptions = useMemo(() =>
        materials.map(m => ({
            value: m.material_code,
            label: `${m.material_code} - ${m.material_name}`
        })),
        [materials]
    );

    const activeVendors = useMemo(() =>
        vendors.filter(v => v.status !== 'inactive' && v.status !== 'blocked'),
        [vendors]
    );

    // Vendors not yet invited — the "invite another supplier" picker
    const inviteOptions = useMemo(() =>
        activeVendors
            .filter(v => !formData.suppliers_invited.includes(v.vendor_code))
            .map(v => ({
                value: v.vendor_code,
                label: `${v.vendor_code} - ${v.vendor_name}`
            })),
        [activeVendors, formData.suppliers_invited]
    );

    // You can only award the RFQ to a supplier you invited
    const awardOptions = useMemo(() =>
        formData.suppliers_invited.map(code => ({
            value: code,
            label: `${code} - ${vendorName(code)}`
        })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formData.suppliers_invited, vendors]
    );

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const prevStatus = item?.status;
            let rfq;
            if (item) {
                rfq = await matrixSales.entities.RFQ.update(item.id, data);
            } else {
                // Claim the sequence number here, not on form open — an abandoned
                // form must not consume a number.
                data = {
                    ...data,
                    rfq_number: data.rfq_number?.trim() || await getNextDocumentNumber('rfq'),
                };
                rfq = await matrixSales.entities.RFQ.create(data);
            }

            // Auto-create Purchase Order draft when RFQ is awarded (non-fatal)
            const isAwarded = prevStatus !== 'awarded' && data.status === 'awarded';
            if (isAwarded) {
                try {
                    const poNumber = await getNextDocumentNumber('purchase_order');
                    await matrixSales.entities.PurchaseOrder.create({
                        po_number:       poNumber,
                        po_date:         new Date().toISOString().slice(0, 10),
                        organization_id: currentOrg?.id,
                        rfq_reference:   data.rfq_number,
                        pr_reference:    data.pr_reference || '',
                        vendor_code:     data.vendor_code || '',
                        vendor_name:     data.vendor_name || '',
                        material_code:   data.material_code,
                        material_name:   data.material_name,
                        quantity:        data.quantity,
                        unit_of_measure: data.unit_of_measure || '',
                        required_date:   data.required_date || '',
                        unit_price:      0,
                        total_amount:    0,
                        status:          'draft',
                        notes:           `Auto-created from RFQ ${data.rfq_number}`,
                    });
                    toast({ title: "Purchase Order Created", description: `${poNumber} created as draft for ${data.vendor_name} — add pricing to complete` });
                    if (currentUser?.email) {
                        createNotification({ userEmail: currentUser.email, notificationType: 'purchase_order_auto_created', priority: 'high', title: 'Purchase Order Auto-Created', message: `${poNumber} was created from awarded RFQ ${data.rfq_number} for ${data.vendor_name} — add pricing to complete`, relatedEntity: 'PurchaseOrder', relatedDocumentNumber: poNumber, actionUrl: '/Purchasing' }).catch(() => {});
                    }
                } catch (_) { /* non-fatal */ }
            }

            return rfq;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rfqs'] });
            queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
            toast({
                title: "Success",
                description: `RFQ ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            console.error("Error saving RFQ:", error);
            toast({
                title: "Error",
                description: `Failed to save RFQ: ${error.message || 'Unknown error'}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // An awarded RFQ becomes a PO, and a PO without a vendor is unusable.
        if (formData.status === 'awarded' && !formData.vendor_code) {
            toast({
                title: "Awarded Vendor Required",
                description: "Select the vendor this RFQ is awarded to before saving.",
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

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit RFQ' : 'New Request for Quotation'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>RFQ Number</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.rfq_number}
                                    onChange={(e) => handleChange('rfq_number', e.target.value)}
                                    disabled={isGeneratingNumber}
                                    placeholder={item ? '' : 'Auto-generated on save'}
                                />
                                {!item && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generateRFQNumber}
                                        disabled={isGeneratingNumber}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label>RFQ Date *</Label>
                            <Input
                                type="date"
                                value={formData.rfq_date}
                                onChange={(e) => handleChange('rfq_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <SearchableSelect
                            label="PR Reference"
                            mode="client"
                            value={formData.pr_reference}
                            onChange={handlePRSelect}
                            options={prOptions}
                            placeholder="Select PR (optional)"
                            clearable
                        />
                    </div>

                    <div className="space-y-2">
                        <SearchableSelect
                            label="Material *"
                            mode="client"
                            value={formData.material_code}
                            onChange={handleMaterialSelect}
                            options={materialOptions}
                            placeholder="Select material"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Quantity *</Label>
                            <Input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => handleChange('quantity', parseFloat(e.target.value))}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <Label>Unit of Measure</Label>
                            <Input
                                value={formData.unit_of_measure}
                                disabled
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

                    <div>
                        <Label>Closing Date *</Label>
                        <Input
                            type="date"
                            value={formData.closing_date}
                            onChange={(e) => handleChange('closing_date', e.target.value)}
                            required
                        />
                    </div>

                    {/* Vendors */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Vendors</h3>

                        <div>
                            <SearchableSelect
                                label="Suppliers Invited"
                                mode="client"
                                value=""
                                onChange={handleInviteSupplier}
                                options={inviteOptions}
                                placeholder="Select a vendor to invite…"
                                searchPlaceholder="Search vendors…"
                                emptyText={
                                    activeVendors.length === 0
                                        ? "No active vendors. Add one under Admin → Vendors."
                                        : "All active vendors are already invited."
                                }
                            />

                            {formData.suppliers_invited.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {formData.suppliers_invited.map(code => (
                                        <Badge key={code} variant="secondary" className="gap-1 pr-1 py-1">
                                            {code} - {vendorName(code)}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSupplier(code)}
                                                aria-label={`Remove ${code}`}
                                                className="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 mt-2">
                                    No suppliers invited yet. Invite at least one before sending this RFQ.
                                </p>
                            )}
                        </div>

                        <div>
                            <SearchableSelect
                                label={`Awarded Vendor${formData.status === 'awarded' ? ' *' : ''}`}
                                mode="client"
                                value={formData.vendor_code}
                                onChange={handleAwardVendor}
                                options={awardOptions}
                                placeholder="Select the winning vendor"
                                searchPlaceholder="Search invited suppliers…"
                                emptyText="Invite suppliers above before awarding."
                                clearable
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Used to create the Purchase Order when this RFQ is set to Awarded.
                            </p>
                        </div>
                    </div>

                    <div>
                        <Label>Specifications</Label>
                        <Textarea
                            value={formData.specifications}
                            onChange={(e) => handleChange('specifications', e.target.value)}
                            rows={3}
                            placeholder="Technical specifications and requirements"
                        />
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
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="awarded">Awarded</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    {item && (
                        <div className="border-t pt-4">
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                                    Document Flow
                                </summary>
                                <DocumentFlow seedType="RFQ" seedNumber={item.rfq_number} />
                            </details>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} RFQ
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
