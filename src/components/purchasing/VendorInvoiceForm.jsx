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
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";

export default function VendorInvoiceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: pos = [] } = useQuery({
        queryKey: ['purchaseOrders'],
        queryFn: () => matrixSales.entities.PurchaseOrder.list(),
        initialData: []
    });

    const { data: grns = [] } = useQuery({
        queryKey: ['grns'],
        queryFn: () => matrixSales.entities.GoodsReceiptNote.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        vendor_invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        po_number: '',
        grn_number: '',
        vendor_code: '',
        vendor_name: '',
        material_code: '',
        material_name: '',
        invoiced_quantity: 0,
        po_quantity: 0,
        grn_quantity: 0,
        unit_price: 0,
        po_unit_price: 0,
        subtotal: 0,
        freight_cost: 0,
        other_charges: 0,
        vat_amount: 0,
        total_amount: 0,
        po_total_amount: 0,
        currency: 'LKR',
        due_date: '',
        three_way_match_status: 'pending',
        quantity_variance: 0,
        price_variance: 0,
        variance_notes: '',
        status: 'pending_match',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        const subtotal = (formData.invoiced_quantity || 0) * (formData.unit_price || 0);
        const totalBeforeVat = subtotal + (formData.freight_cost || 0) + (formData.other_charges || 0);
        const vatAmount = totalBeforeVat * 0.15;
        const total = totalBeforeVat + vatAmount;

        const qtyVariance = (formData.invoiced_quantity || 0) - (formData.grn_quantity || 0);
        const priceVariance = ((formData.unit_price || 0) - (formData.po_unit_price || 0)) * (formData.invoiced_quantity || 0);

        // 3-way match logic
        let matchStatus = 'pending';
        if (formData.po_number && formData.grn_number) {
            const qtyTolerance = 0.05; // 5%
            const priceTolerance = 0.05; // 5%
            
            const qtyVariancePct = Math.abs(qtyVariance / (formData.grn_quantity || 1));
            const priceVariancePct = Math.abs(priceVariance / (formData.po_total_amount || 1));

            if (qtyVariancePct === 0 && priceVariancePct === 0) {
                matchStatus = 'matched';
            } else if (qtyVariancePct <= qtyTolerance && priceVariancePct <= priceTolerance) {
                matchStatus = 'variance_within_tolerance';
            } else {
                matchStatus = 'variance_exceeded';
            }
        }

        setFormData(prev => ({
            ...prev,
            subtotal,
            vat_amount: vatAmount,
            total_amount: total,
            quantity_variance: qtyVariance,
            price_variance: priceVariance,
            three_way_match_status: matchStatus
        }));
    }, [
        formData.invoiced_quantity, 
        formData.unit_price, 
        formData.freight_cost, 
        formData.other_charges,
        formData.grn_quantity,
        formData.po_unit_price,
        formData.po_number,
        formData.grn_number,
        formData.po_total_amount
    ]);

    const handlePOSelect = (poNumber) => {
        const po = pos.find(p => p.po_number === poNumber);
        const relatedGRNs = grns.filter(g => g.po_number === poNumber && g.status === 'posted');
        
        if (po) {
            setFormData(prev => ({
                ...prev,
                po_number: poNumber,
                vendor_code: po.vendor_code,
                vendor_name: po.vendor_name,
                material_code: po.material_code,
                material_name: po.material_name,
                po_quantity: po.quantity,
                po_unit_price: po.unit_price,
                po_total_amount: po.total_amount,
                unit_price: po.unit_price,
                grn_number: relatedGRNs.length > 0 ? relatedGRNs[0].grn_number : '',
                grn_quantity: relatedGRNs.length > 0 ? relatedGRNs[0].accepted_quantity : 0,
                invoiced_quantity: relatedGRNs.length > 0 ? relatedGRNs[0].accepted_quantity : po.quantity
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.VendorInvoice.update(item.id, data);
            }
            return matrixSales.entities.VendorInvoice.create(data);
        },
        onSuccess: async (savedInvoice) => {
            if (['approved', 'approved_for_payment'].includes(savedInvoice?.status) && !savedInvoice.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: '5001', account_name: 'Cost of Goods Sold', debit: savedInvoice.subtotal, credit: 0 },
                            { account_code: '2210', account_name: 'VAT Receivable', debit: savedInvoice.vat_amount || 0, credit: 0 },
                            { account_code: '2100', account_name: 'Trade Payables', debit: 0, credit: savedInvoice.total_amount }
                        ].filter(line => Number(line.debit || line.credit || 0) > 0),
                        referenceType: 'vendor_invoice',
                        referenceId: savedInvoice.vendor_invoice_number,
                        description: `Vendor invoice ${savedInvoice.vendor_invoice_number}`,
                        entryDate: savedInvoice.invoice_date,
                        entryType: 'invoice',
                        orgId: currentOrg?.id
                    });
                    await matrixSales.entities.VendorInvoice.update(savedInvoice.id, { ...savedInvoice, gl_posted: true });
                } catch (error) {
                    toast({ title: "Vendor invoice saved but GL posting failed", description: error.message, variant: "destructive" });
                }
            }
            queryClient.invalidateQueries({ queryKey: ['vendorInvoices'] });
            toast({
                title: "Success",
                description: `Vendor invoice ${item ? 'updated' : 'created'} successfully`,
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

    const receivedPOs = pos.filter(p => 
        p.status === 'partially_received' || 
        p.status === 'fully_received'
    );

    const matchStatusColor = {
        pending: 'bg-yellow-100 text-yellow-800',
        matched: 'bg-green-100 text-green-800',
        variance_within_tolerance: 'bg-blue-100 text-blue-800',
        variance_exceeded: 'bg-red-100 text-red-800',
        failed: 'bg-red-200 text-red-900'
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Vendor Invoice' : 'New Vendor Invoice (3-Way Match)'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Vendor Invoice Number *</Label>
                            <Input
                                value={formData.vendor_invoice_number}
                                onChange={(e) => handleChange('vendor_invoice_number', e.target.value)}
                                required
                                placeholder="Vendor's invoice number"
                            />
                        </div>
                        <div>
                            <Label>Invoice Date *</Label>
                            <Input
                                type="date"
                                value={formData.invoice_date}
                                onChange={(e) => handleChange('invoice_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Purchase Order *</Label>
                        <Select 
                            value={formData.po_number} 
                            onValueChange={handlePOSelect}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select PO with GRN" />
                            </SelectTrigger>
                            <SelectContent>
                                {receivedPOs.map(po => (
                                    <SelectItem key={po.id} value={po.po_number}>
                                        {po.po_number} - {po.vendor_name} - {po.material_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.po_number && (
                        <>
                            {/* 3-Way Match Status */}
                            <Alert className={`${matchStatusColor[formData.three_way_match_status] || 'bg-gray-50'} border-2`}>
                                <div className="flex items-start gap-3">
                                    {formData.three_way_match_status === 'matched' && <CheckCircle2 className="w-5 h-5" />}
                                    {formData.three_way_match_status === 'variance_within_tolerance' && <AlertCircle className="w-5 h-5" />}
                                    {formData.three_way_match_status === 'variance_exceeded' && <AlertTriangle className="w-5 h-5" />}
                                    <div className="flex-1">
                                        <p className="font-semibold">3-Way Match Status: {formData.three_way_match_status.replace(/_/g, ' ').toUpperCase()}</p>
                                        <AlertDescription>
                                            Quantity Variance: {formData.quantity_variance.toFixed(2)} | 
                                            Price Variance: LKR {formData.price_variance.toFixed(2)}
                                        </AlertDescription>
                                    </div>
                                </div>
                            </Alert>

                            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                                <h3 className="font-semibold">Reference Data</h3>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <Label className="text-xs">Vendor</Label>
                                        <p className="font-medium">{formData.vendor_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs">PO #</Label>
                                        <p className="font-medium">{formData.po_number}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs">GRN #</Label>
                                        <p className="font-medium">{formData.grn_number}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Quantities Comparison */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Quantity Matching</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-blue-50 rounded">
                                        <Label className="text-xs">PO Quantity</Label>
                                        <p className="text-lg font-bold">{formData.po_quantity}</p>
                                    </div>
                                    <div className="p-3 bg-green-50 rounded">
                                        <Label className="text-xs">GRN Quantity</Label>
                                        <p className="text-lg font-bold">{formData.grn_quantity}</p>
                                    </div>
                                    <div>
                                        <Label>Invoiced Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={formData.invoiced_quantity}
                                            onChange={(e) => handleChange('invoiced_quantity', parseFloat(e.target.value) || 0)}
                                            required
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Price Comparison */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Price Matching</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-blue-50 rounded">
                                        <Label className="text-xs">PO Unit Price</Label>
                                        <p className="text-lg font-bold">LKR {formData.po_unit_price.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <Label>Invoice Unit Price (LKR) *</Label>
                                        <Input
                                            type="number"
                                            value={formData.unit_price}
                                            onChange={(e) => handleChange('unit_price', parseFloat(e.target.value) || 0)}
                                            required
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Additional Charges */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Additional Charges</h3>
                                <div className="grid grid-cols-2 gap-4">
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
                                        <Label>Other Charges (LKR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.other_charges}
                                            onChange={(e) => handleChange('other_charges', parseFloat(e.target.value) || 0)}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="p-4 bg-emerald-50 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold">LKR {formData.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>VAT (15%):</span>
                                    <span className="font-semibold">LKR {formData.vat_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold border-t pt-2">
                                    <span>Total Amount:</span>
                                    <span>LKR {formData.total_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>PO Total:</span>
                                    <span>LKR {formData.po_total_amount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div>
                                <Label>Due Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => handleChange('due_date', e.target.value)}
                                    required
                                />
                            </div>

                            {formData.three_way_match_status === 'variance_exceeded' && (
                                <div>
                                    <Label>Variance Notes *</Label>
                                    <Textarea
                                        value={formData.variance_notes}
                                        onChange={(e) => handleChange('variance_notes', e.target.value)}
                                        rows={2}
                                        placeholder="Explain the variance..."
                                        required
                                    />
                                </div>
                            )}

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
                                        <SelectItem value="pending_match">Pending Match</SelectItem>
                                        <SelectItem value="matched">Matched</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                        <SelectItem value="approved_for_payment">Approved for Payment</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
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
                        </>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Invoice
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
