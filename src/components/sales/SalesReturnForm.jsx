import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import ReverseButton from "../shared/ReverseButton";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";

export default function SalesReturnForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
    const taxConfig = useTaxConfig();

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => matrixSales.entities.Invoice.list('-invoice_date'),
        initialData: []
    });

    const [formData, setFormData] = useState({
        return_number: '',
        invoice_number: '',
        sales_order_number: '',
        customer_code: '',
        customer_name: '',
        return_date: new Date().toISOString().split('T')[0],
        return_reason: 'defective',
        return_reason_details: '',
        product_code: '',
        product_name: '',
        quantity_returned: 0,
        unit_price: 0,
        subtotal: 0,
        vat_percent: taxConfig.vat_standard_rate,
        vat_amount: 0,
        total_return_amount: 0,
        credit_note_number: '',
        credit_note_issued: false,
        stock_returned: false,
        stock_return_date: '',
        inspection_result: 'pending',
        status: 'requested',
        approved_by: '',
        approval_date: '',
        notes: '',
        notes_ar: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        const subtotal = (formData.quantity_returned || 0) * (formData.unit_price || 0);
        const vatAmount = subtotal * ((formData.vat_percent || 0) / 100);
        const total = subtotal + vatAmount;
        setFormData(prev => ({ 
            ...prev, 
            subtotal, 
            vat_amount: vatAmount,
            total_return_amount: total 
        }));
    }, [formData.quantity_returned, formData.unit_price, formData.vat_percent]);

    const handleInvoiceSelect = (invoiceNumber) => {
        const selectedInvoice = invoices.find(i => i.invoice_number === invoiceNumber);
        if (selectedInvoice) {
            setFormData(prev => ({
                ...prev,
                invoice_number: invoiceNumber,
                sales_order_number: selectedInvoice.sales_order_number || '',
                customer_code: selectedInvoice.customer_code || '',
                customer_name: selectedInvoice.customer_name,
                product_code: selectedInvoice.product_code,
                product_name: selectedInvoice.product_name,
                quantity_returned: selectedInvoice.quantity,
                unit_price: selectedInvoice.unit_price,
                vat_percent: selectedInvoice.vat_percent ?? taxConfig.vat_standard_rate,
                notes: `Return for Invoice: ${invoiceNumber}`
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.SalesReturn.update(item.id, data);
            }
            return matrixSales.entities.SalesReturn.create(data);
        },
        onSuccess: async (savedReturn) => {
            // Post GL credit note entry when return is approved
            if (savedReturn?.status === 'approved' && !savedReturn.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: gl.sales_revenue,  account_name: 'Sales Revenue',    debit: savedReturn.subtotal,         credit: 0 },
                            { account_code: gl.vat_output,     account_name: 'VAT Payable',      debit: savedReturn.vat_amount || 0,  credit: 0 },
                            { account_code: gl.ar_receivables, account_name: 'Trade Receivables', debit: 0, credit: savedReturn.total_return_amount }
                        ].filter(line => Number(line.debit || line.credit || 0) > 0),
                        referenceType: 'sales_return',
                        referenceId:   savedReturn.return_number,
                        description:   `Sales return / credit note ${savedReturn.return_number}`,
                        entryDate:     savedReturn.return_date,
                        entryType:     'credit_note',
                        orgId:         currentOrg?.id
                    });
                    await matrixSales.entities.SalesReturn.update(savedReturn.id, { ...savedReturn, gl_posted: true });
                } catch (glErr) {
                    toast({ title: "Saved but GL posting failed", description: glErr.message, variant: "destructive" });
                }
            }

            // Reduce AR outstanding when return is approved
            if (savedReturn?.status === 'approved' && savedReturn.invoice_number) {
                try {
                    const arRecords = await matrixSales.entities.AccountsReceivable.filter({
                        invoice_number: savedReturn.invoice_number
                    });
                    for (const ar of arRecords) {
                        const reduction    = parseFloat(savedReturn.total_return_amount) || 0;
                        const outstanding  = Math.max(0, (parseFloat(ar.outstanding_amount) || 0) - reduction);
                        const paid         = (parseFloat(ar.paid_amount) || 0) + reduction;
                        await matrixSales.entities.AccountsReceivable.update(ar.id, {
                            ...ar,
                            paid_amount:        paid,
                            outstanding_amount: outstanding,
                            status:             outstanding <= 0.01 ? 'closed' : ar.status,
                        });
                    }
                    queryClient.invalidateQueries({ queryKey: ['ar'] });
                } catch (_) {
                    // Non-fatal
                }
            }

            queryClient.invalidateQueries({ queryKey: ['returns'] });
            toast({
                title: "Success",
                description: `Sales return ${item ? 'updated' : 'created'} successfully`,
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

    const paidInvoices = invoices.filter(i => i.payment_status === 'paid' || i.payment_status === 'partially_paid');

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit Sales Return' : 'New Sales Return'}
                        {formData.invoice_number && (
                            <Badge variant="outline" className="ml-2">
                                Invoice: {formData.invoice_number}
                            </Badge>
                        )}
                        {formData.credit_note_issued && (
                            <Badge className="ml-2 bg-green-600">
                                Credit Note Issued
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Invoice Reference Section */}
                    {!item && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <Label className="text-red-900 font-semibold mb-2 block">
                                Select Invoice *
                            </Label>
                            <Select 
                                value={formData.invoice_number} 
                                onValueChange={handleInvoiceSelect}
                                required
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select an invoice to return..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {paidInvoices.map(i => (
                                        <SelectItem key={i.id} value={i.invoice_number}>
                                            {i.invoice_number} - {i.customer_name} - LKR {i.total_amount?.toLocaleString()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formData.invoice_number && (
                                <p className="text-sm text-red-700 mt-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4" />
                                    Data auto-filled from invoice
                                </p>
                            )}
                        </div>
                    )}

                    {/* Return Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Return Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Return Number *</Label>
                                <Input
                                    value={formData.return_number}
                                    onChange={(e) => handleChange('return_number', e.target.value)}
                                    required
                                    placeholder="RET-2025-0001"
                                />
                            </div>
                            <div>
                                <Label>Return Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.return_date}
                                    onChange={(e) => handleChange('return_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Return Reason *</Label>
                                <Select 
                                    value={formData.return_reason} 
                                    onValueChange={(val) => handleChange('return_reason', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="defective">Defective</SelectItem>
                                        <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                        <SelectItem value="damaged_in_transit">Damaged in Transit</SelectItem>
                                        <SelectItem value="customer_request">Customer Request</SelectItem>
                                        <SelectItem value="quality_issue">Quality Issue</SelectItem>
                                        <SelectItem value="specification_mismatch">Specification Mismatch</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
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
                                        <SelectItem value="requested">Requested</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                        <SelectItem value="received">Received</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Return Reason Details</Label>
                            <Textarea
                                value={formData.return_reason_details}
                                onChange={(e) => handleChange('return_reason_details', e.target.value)}
                                rows={2}
                                placeholder="Detailed explanation of the return reason..."
                            />
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Customer Information</h3>
                        <div>
                            <Label>Customer Name *</Label>
                            <Input
                                value={formData.customer_name}
                                onChange={(e) => handleChange('customer_name', e.target.value)}
                                required
                                disabled={!!formData.invoice_number}
                            />
                        </div>
                    </div>

                    {/* Product & Quantity */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Product & Return Quantity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Product Code *</Label>
                                <Input
                                    value={formData.product_code}
                                    onChange={(e) => handleChange('product_code', e.target.value)}
                                    required
                                    disabled={!!formData.invoice_number}
                                />
                            </div>
                            <div>
                                <Label>Product Name *</Label>
                                <Input
                                    value={formData.product_name}
                                    onChange={(e) => handleChange('product_name', e.target.value)}
                                    required
                                    disabled={!!formData.invoice_number}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Quantity Returned *</Label>
                                <Input
                                    type="number"
                                    value={formData.quantity_returned}
                                    onChange={(e) => handleChange('quantity_returned', parseFloat(e.target.value))}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Unit Price *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.unit_price}
                                    onChange={(e) => handleChange('unit_price', parseFloat(e.target.value))}
                                    required
                                    disabled={!!formData.invoice_number}
                                />
                            </div>
                            <div>
                                <Label>VAT %</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.vat_percent}
                                    onChange={(e) => handleChange('vat_percent', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="font-semibold">LKR {formData.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">VAT ({formData.vat_percent}%):</span>
                                <span className="font-semibold">LKR {formData.vat_amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg border-t pt-2">
                                <span className="font-bold">Total Return Amount:</span>
                                <span className="font-bold text-red-600">
                                    LKR {formData.total_return_amount.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Return Processing */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Return Processing</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Inspection Result</Label>
                                <Select 
                                    value={formData.inspection_result} 
                                    onValueChange={(val) => handleChange('inspection_result', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="passed">Passed</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Credit Note Number</Label>
                                <Input
                                    value={formData.credit_note_number}
                                    onChange={(e) => handleChange('credit_note_number', e.target.value)}
                                    placeholder="CN-2025-0001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Stock Return Date</Label>
                                <Input
                                    type="date"
                                    value={formData.stock_return_date}
                                    onChange={(e) => handleChange('stock_return_date', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Approved By</Label>
                                <Input
                                    value={formData.approved_by}
                                    onChange={(e) => handleChange('approved_by', e.target.value)}
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
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <ReverseButton
                            item={item}
                            entityName="SalesReturn"
                            queryKeys={['returns']}
                            onSuccess={onClose}
                        />
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                {item ? 'Update' : 'Create'} Sales Return
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}