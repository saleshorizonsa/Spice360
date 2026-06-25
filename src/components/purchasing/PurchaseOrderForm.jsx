
import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Calculator, Paperclip } from "lucide-react";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createApprovalRequest, needsApproval } from "../utils/approvalWorkflow";
import { logAuditTrail } from "../utils/auditTrail";
import { useOrganization } from "../utils/OrganizationContext";
import DocumentList from "../shared/DocumentList";
import ReverseButton from "../shared/ReverseButton";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useTaxConfig } from "@/hooks/useTaxConfig";

export default function PurchaseOrderForm({ po, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrganization: currentOrg } = useOrganization();
    const taxConfig = useTaxConfig();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState("details");
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
                toast({
                    title: "Error",
                    description: "Failed to fetch user data. Please refresh.",
                    variant: "destructive"
                });
            }
        };
        fetchUser();
    }, [toast]);

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

    const { data: rfqs = [] } = useQuery({
        queryKey: ['rfqs'],
        queryFn: () => matrixSales.entities.RFQ.list(),
        initialData: []
    });

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters'],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        po_number: '',
        po_type: 'standard',
        po_date: new Date().toISOString().split('T')[0],
        pr_reference: '',
        rfq_reference: '',
        vendor_code: '',
        vendor_name: '',
        vendor_contact: '',
        vendor_email: '',
        vendor_phone: '',
        material_code: '',
        material_name: '',
        quantity: 0,
        quantity_received: 0,
        unit_of_measure: 'kg',
        unit_price: 0,
        subtotal: 0,
        tolerance_percent: 0,
        freight_cost: 0,
        duty_cost: 0,
        other_costs: 0,
        vat_percent: taxConfig.vat_standard_rate,
        vat_amount: 0,
        total_amount: 0,
        currency: 'LKR',
        exchange_rate: 1,
        payment_terms: 'net_30',
        delivery_date: '',
        delivery_address: '',
        cost_center: '',
        project_code: '',
        gl_account_code: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (po) {
            setFormData(po);
        } else {
            generatePONumber();
        }
    }, [po]);

    const generatePONumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('purchase_order');
            setFormData(prev => ({ ...prev, po_number: number }));
        } catch (error) {
            console.error("Error generating PO number:", error);
            toast({
                title: "Error",
                description: "Failed to generate PO number automatically. Please enter manually.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    useEffect(() => {
        const subtotal = (formData.quantity || 0) * (formData.unit_price || 0);
        const landedCosts = (formData.freight_cost || 0) + (formData.duty_cost || 0) + (formData.other_costs || 0);
        const totalBeforeVat = subtotal + landedCosts;
        const vatAmount = totalBeforeVat * ((formData.vat_percent || 0) / 100);
        const total = totalBeforeVat + vatAmount;
        
        setFormData(prev => ({
            ...prev,
            subtotal,
            vat_amount: vatAmount,
            total_amount: total
        }));
    }, [formData.quantity, formData.unit_price, formData.freight_cost, formData.duty_cost, formData.other_costs, formData.vat_percent]);

    const handleVendorSelect = (vendorCode) => {
        const vendor = vendors.find(v => v.vendor_code === vendorCode);
        if (vendor) {
            setFormData(prev => ({
                ...prev,
                vendor_code: vendorCode,
                vendor_name: vendor.vendor_name,
                vendor_contact: vendor.contact_person || '',
                vendor_email: vendor.email || '',
                vendor_phone: vendor.phone || '',
                payment_terms: vendor.payment_terms || 'net_30'
            }));
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
                unit_price: material.unit_cost || 0
            }));
        }
    };

    const handleRFQSelect = (rfqNumber) => {
        const rfq = rfqs.find(r => r.rfq_number === rfqNumber);
        if (rfq) {
            setFormData(prev => ({
                ...prev,
                rfq_reference: rfqNumber,
                material_code: rfq.material_code,
                material_name: rfq.material_name,
                quantity: rfq.quantity,
                unit_of_measure: rfq.unit_of_measure,
                delivery_date: rfq.required_date
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let purchaseOrder;
            const beforeData = po ? { ...po } : null;
            const auditSeverity = data.total_amount > 100000 ? 'warning' : 'info';
            
            if (po) {
                purchaseOrder = await matrixSales.entities.PurchaseOrder.update(po.id, data);
                
                await logAuditTrail({
                    entityType: 'purchase_order',
                    entityId: po.id,
                    documentNumber: data.po_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: auditSeverity
                });
            } else {
                purchaseOrder = await matrixSales.entities.PurchaseOrder.create(data);
                
                await logAuditTrail({
                    entityType: 'purchase_order',
                    entityId: purchaseOrder.id,
                    documentNumber: data.po_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: auditSeverity
                });

                const requiresApproval = await needsApproval(
                    'purchase_order',
                    purchaseOrder.total_amount,
                    currentOrg?.organization_code,
                    currentUser?.department
                );

                if (requiresApproval) {
                    const approvalRequest = await createApprovalRequest({
                        documentType: 'purchase_order',
                        documentNumber: purchaseOrder.po_number,
                        documentId: purchaseOrder.id,
                        amount: purchaseOrder.total_amount,
                        requestedBy: currentUser?.email,
                        requestedByName: currentUser?.full_name,
                        requestedByRole: currentUser?.approval_role || 'buyer',
                        branch: currentOrg?.organization_code,
                        department: currentUser?.department || 'Purchasing',
                        summary: `Purchase Order for ${purchaseOrder.vendor_name} - ${purchaseOrder.material_name} (${purchaseOrder.quantity} ${purchaseOrder.unit_of_measure})`
                    });

                    purchaseOrder = await matrixSales.entities.PurchaseOrder.update(purchaseOrder.id, {
                        status: 'pending_approval'
                    });
                    
                    await logAuditTrail({
                        entityType: 'purchase_order',
                        entityId: purchaseOrder.id,
                        documentNumber: purchaseOrder.po_number,
                        actionType: 'submit_for_approval',
                        afterData: { status: 'pending_approval' },
                        user: currentUser,
                        severity: 'info',
                        relatedDocumentType: 'approval_request',
                        relatedDocumentId: approvalRequest?.id
                    });
                }
            }

            return purchaseOrder;
        },
        onSuccess: (savedPO) => {
            queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
            queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            
            let descriptionMessage = po ? "Purchase order updated successfully" : "Purchase order created successfully";
            if (!po && savedPO.status === 'pending_approval') {
                descriptionMessage = "Purchase order created and submitted for approval.";
            }
            
            toast({
                title: "Success",
                description: descriptionMessage,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            console.error("Purchase Order save error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to save purchase order. Please try again.",
                variant: "destructive"
            });
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
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {po ? 'Edit Purchase Order' : 'New Purchase Order'}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-2 w-96">
                        <TabsTrigger value="details">PO Details</TabsTrigger>
                        <TabsTrigger value="documents">
                            <Paperclip className="w-4 h-4 mr-2" />
                            Documents
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Header */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>PO Number *</Label>
                                    <Input
                                        value={formData.po_number}
                                        onChange={(e) => handleChange('po_number', e.target.value)}
                                        required
                                        placeholder="PO-2025-0001"
                                        disabled={isGeneratingNumber || !!po}
                                    />
                                </div>
                                <div>
                                    <Label>PO Type</Label>
                                    <Select 
                                        value={formData.po_type} 
                                        onValueChange={(val) => handleChange('po_type', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">Standard</SelectItem>
                                            <SelectItem value="blanket">Blanket</SelectItem>
                                            <SelectItem value="subcontracting">Subcontracting</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>PO Date *</Label>
                                    <Input
                                        type="date"
                                        value={formData.po_date}
                                        onChange={(e) => handleChange('po_date', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* References */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>RFQ Reference</Label>
                                    <Select 
                                        value={formData.rfq_reference} 
                                        onValueChange={handleRFQSelect}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select RFQ (optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rfqs.filter(r => r.status === 'awarded').map(rfq => (
                                                <SelectItem key={rfq.id} value={rfq.rfq_number}>
                                                    {rfq.rfq_number} - {rfq.material_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>PR Reference</Label>
                                    <Input
                                        value={formData.pr_reference}
                                        onChange={(e) => handleChange('pr_reference', e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            {/* Vendor Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Vendor Information</h3>
                                <div>
                                    <Label>Vendor *</Label>
                                    <Select 
                                        value={formData.vendor_code} 
                                        onValueChange={handleVendorSelect}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.filter(v => v.status === 'active').map(v => (
                                                <SelectItem key={v.id} value={v.vendor_code}>
                                                    {v.vendor_code} - {v.vendor_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.vendor_code && (
                                    <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <Label className="text-xs">Contact</Label>
                                            <p className="text-sm">{formData.vendor_contact}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Email</Label>
                                            <p className="text-sm">{formData.vendor_email}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Phone</Label>
                                            <p className="text-sm">{formData.vendor_phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Material Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Material & Pricing</h3>
                                <div>
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

                                <div className="grid grid-cols-4 gap-4">
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
                                        <Label>UOM</Label>
                                        <Input
                                            value={formData.unit_of_measure}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <Label>Unit Price (LKR) *</Label>
                                        <Input
                                            type="number"
                                            value={formData.unit_price}
                                            onChange={(e) => handleChange('unit_price', parseFloat(e.target.value))}
                                            required
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <Label>Subtotal (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.subtotal.toFixed(2)}
                                            disabled
                                        />
                                    </div>
                                </div>

                                {/* Tolerance */}
                                <div className="grid grid-cols-3 gap-4 items-end">
                                    <div>
                                        <Label>Delivery Tolerance %</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={formData.tolerance_percent}
                                            onChange={(e) => handleChange('tolerance_percent', parseFloat(e.target.value) || 0)}
                                            placeholder="0 = exact match required"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Allowed over/under delivery (e.g. 5 = ±5% of PO qty)
                                        </p>
                                    </div>
                                    {formData.tolerance_percent > 0 && formData.quantity > 0 && (
                                        <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-xs font-semibold text-amber-800 mb-1">Accepted Delivery Range</p>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="text-amber-700">
                                                    Min: <strong>{(formData.quantity * (1 - formData.tolerance_percent / 100)).toFixed(3)} {formData.unit_of_measure}</strong>
                                                </span>
                                                <span className="text-gray-400">—</span>
                                                <span className="text-amber-700">
                                                    Max: <strong>{(formData.quantity * (1 + formData.tolerance_percent / 100)).toFixed(3)} {formData.unit_of_measure}</strong>
                                                </span>
                                                <span className="text-gray-400 text-xs">(PO: {formData.quantity} ±{formData.tolerance_percent}%)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Landed Costs */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
                                    <Calculator className="w-4 h-4" />
                                    Landed Costs
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Freight Cost (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.freight_cost}
                                            onChange={(e) => handleChange('freight_cost', parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <Label>Duty Cost (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.duty_cost}
                                            onChange={(e) => handleChange('duty_cost', parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <Label>Other Costs (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.other_costs}
                                            onChange={(e) => handleChange('other_costs', parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* VAT & Total */}
                            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>VAT %</Label>
                                        <Input
                                            type="number"
                                            value={formData.vat_percent}
                                            onChange={(e) => handleChange('vat_percent', parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <Label>VAT Amount (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.vat_amount.toFixed(2)}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <Label className="font-bold">Total Amount (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.total_amount.toFixed(2)}
                                            disabled
                                            className="font-bold text-lg"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Delivery & Terms */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Delivery Date *</Label>
                                    <Input
                                        type="date"
                                        value={formData.delivery_date}
                                        onChange={(e) => handleChange('delivery_date', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Payment Terms</Label>
                                    <Select 
                                        value={formData.payment_terms} 
                                        onValueChange={(val) => handleChange('payment_terms', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="net_30">Net 30</SelectItem>
                                            <SelectItem value="net_45">Net 45</SelectItem>
                                            <SelectItem value="net_60">Net 60</SelectItem>
                                            <SelectItem value="cod">COD</SelectItem>
                                            <SelectItem value="advance">Advance</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>Delivery Address</Label>
                                <Textarea
                                    value={formData.delivery_address}
                                    onChange={(e) => handleChange('delivery_address', e.target.value)}
                                    rows={2}
                                />
                            </div>

                            {/* Accounting */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Cost Center</Label>
                                    <Select 
                                        value={formData.cost_center} 
                                        onValueChange={(val) => handleChange('cost_center', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select cost center" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {costCenters.map(cc => (
                                                <SelectItem key={cc.id} value={cc.cost_center_code}>
                                                    {cc.cost_center_code} - {cc.cost_center_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>GL Account Code</Label>
                                    <Input
                                        value={formData.gl_account_code}
                                        onChange={(e) => handleChange('gl_account_code', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => handleChange('status', val)}
                                    disabled={!po}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="pending_approval">Pending Approval</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="sent_to_vendor">Sent to Vendor</SelectItem>
                                        <SelectItem value="acknowledged">Acknowledged</SelectItem>
                                        <SelectItem value="partially_received">Partially Received</SelectItem>
                                        <SelectItem value="fully_received">Fully Received</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Notes</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-between items-center">
                                <ReverseButton
                                    item={po}
                                    entityName="PurchaseOrder"
                                    queryKeys={['purchaseOrders']}
                                    onSuccess={onClose}
                                />
                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isGeneratingNumber || saveMutation.isPending}>
                                        {po ? 'Update' : 'Create'} PO
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="documents">
                        {po ? (
                            <DocumentList
                                relatedEntity="purchase_order"
                                relatedEntityId={po.id}
                                relatedDocumentNumber={po.po_number}
                            />
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Paperclip className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                <p>Save the purchase order first to upload documents</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
