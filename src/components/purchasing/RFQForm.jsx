
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
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createNotification } from "../utils/notificationService";
import { useOrganization } from "../utils/OrganizationContext";
import { RefreshCw } from "lucide-react";

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

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateRFQNumber();
        }
    }, [item]);

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

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const prevStatus = item?.status;
            let rfq;
            if (item) {
                rfq = await matrixSales.entities.RFQ.update(item.id, data);
            } else {
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
                    toast({ title: "Purchase Order Created", description: `${poNumber} created as draft — add vendor to complete` });
                    if (currentUser?.email) {
                        createNotification({ userEmail: currentUser.email, notificationType: 'purchase_order_auto_created', priority: 'high', title: 'Purchase Order Auto-Created', message: `${poNumber} was created from awarded RFQ ${data.rfq_number} — add vendor to complete`, relatedEntity: 'PurchaseOrder', relatedDocumentNumber: poNumber, actionUrl: '/Purchasing' }).catch(() => {});
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
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
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
                            <Label>RFQ Number *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.rfq_number}
                                    onChange={(e) => handleChange('rfq_number', e.target.value)}
                                    required
                                    disabled={isGeneratingNumber}
                                    placeholder="RFQ-2025-0001"
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
                        <Label>PR Reference</Label>
                        <Select
                            value={formData.pr_reference}
                            onValueChange={handlePRSelect}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select PR (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {requisitions.filter(r => r.status === 'approved').map(pr => (
                                    <SelectItem key={pr.id} value={pr.pr_number}>
                                        {pr.pr_number} - {pr.material_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Material *</Label>
                        <Select
                            value={formData.material_code}
                            onValueChange={handleMaterialSelect}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                                {materials.map(m => (
                                    <SelectItem key={m.id} value={m.material_code}>
                                        {m.material_code} - {m.material_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
