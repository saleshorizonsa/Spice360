import React, { useState, useEffect, useRef } from "react";
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
import ReverseButton from "../shared/ReverseButton";
import JournalEntriesPanel from "../shared/JournalEntriesPanel";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { documentDiscount } from "@/lib/salesDiscount";
import { isFinalisedInvoice } from "@/lib/arFromInvoice";
import { processSalesReturnReceipt } from "../utils/inventoryIntegration";

/**
 * Sales Return / Credit Note.
 *
 * `seedInvoiceNumber` opens it as "Create Credit Note" against that invoice: the
 * form prefills from the invoice exactly as picking it from the dropdown would,
 * so the credit note mirrors what was actually charged.
 */
export default function SalesReturnForm({ item, onClose, seedInvoiceNumber }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();

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
        discount_amount: 0,
        vat_percent: 0,
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

    const seededFromInvoice = useRef(false);

    useEffect(() => {
        const subtotal = (formData.quantity_returned || 0) * (formData.unit_price || 0);
        // Mirror the invoice: VAT was charged on the discounted amount, so the credit
        // note has to reverse it the same way or the customer is over-credited.
        const discount = documentDiscount(subtotal, formData.discount_amount);
        const vatAmount = (subtotal - discount) * ((formData.vat_percent || 0) / 100);
        const total = subtotal - discount + vatAmount;
        setFormData(prev => ({ 
            ...prev, 
            subtotal, 
            discount_amount: discount,
            vat_amount: vatAmount,
            total_return_amount: total 
        }));
    }, [formData.quantity_returned, formData.unit_price, formData.discount_amount, formData.vat_percent]);

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
                // Mirror the original invoice's VAT. Invoices store it as tax_percent;
                // if the invoice carried no VAT, the return carries none either.
                vat_percent: Number(selectedInvoice.tax_percent ?? selectedInvoice.vat_percent) || 0,
                // Prefilled for a full return; trim it if only part of the invoice comes back.
                discount_amount: Number(selectedInvoice.discount_total ?? selectedInvoice.discount_amount) || 0,
                notes: `Return for Invoice: ${invoiceNumber}`
            }));
        }
    };

    // Raised from an invoice's "Create credit note" action: prefill as soon as the
    // invoice list arrives, exactly as picking that invoice from the dropdown would.
    // The ref makes it seed once, so it never fights the user's later edits or a
    // different invoice they choose afterwards.
    useEffect(() => {
        if (item || !seedInvoiceNumber || seededFromInvoice.current) return;
        if (!invoices.some((i) => i.invoice_number === seedInvoiceNumber)) return;
        seededFromInvoice.current = true;
        handleInvoiceSelect(seedInvoiceNumber);
    }, [item, seedInvoiceNumber, invoices]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.SalesReturn.update(item.id, data);
            }
            return matrixSales.entities.SalesReturn.create(data);
        },
        onSuccess: async (savedReturn) => {
            // Nothing here runs until the return is APPROVED, and each step carries its
            // own flag so a re-save — or a retry after one step failed — completes only
            // what is still outstanding. The AR reduction in particular used to run on
            // every save of an approved return, subtracting the credit from the
            // customer's balance again each time.
            const patch = {};

            if (savedReturn?.status === 'approved' && !savedReturn.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            // The exact mirror of the sales invoice: revenue reversed gross,
                            // the discount credited back out of 5800 so it does not strand there.
                            { account_code: gl.sales_revenue,  account_name: 'Sales Revenue',    debit: savedReturn.subtotal,         credit: 0 },
                            { account_code: gl.vat_output,     account_name: 'VAT Payable',      debit: savedReturn.vat_amount || 0,  credit: 0 },
                            { account_code: gl.sales_discount, account_name: 'Sales Discount',   debit: 0, credit: savedReturn.discount_amount || 0 },
                            { account_code: gl.ar_receivables, account_name: 'Trade Receivables', debit: 0, credit: savedReturn.total_return_amount }
                        ].filter(line => Number(line.debit || line.credit || 0) > 0),
                        referenceType: 'sales_return',
                        referenceId:   savedReturn.return_number,
                        description:   `Sales return / credit note ${savedReturn.return_number}`,
                        entryDate:     savedReturn.return_date,
                        entryType:     'credit_note',
                        orgId:         currentOrg?.id,
                        area:          "ar"
                    });
                    patch.gl_posted = true;
                } catch (glErr) {
                    toast({ title: "Saved but GL posting failed", description: glErr.message, variant: "destructive" });
                }
            }

            // ── Cost side ────────────────────────────────────────────────────────
            // The invoice posted Dr COGS / Cr Inventory; without this the return
            // reverses only the sales side, leaving inventory understated and COGS
            // overstated for good. Stock and the Inventory debit move together and at
            // the same value so the warehouse and the ledger cannot drift apart.
            //
            // Only goods that PASSED inspection go back — a failed inspection means
            // scrap, which does not belong in sellable stock.
            if (savedReturn?.status === 'approved' && !savedReturn.stock_posted) {
                if (savedReturn.inspection_result === 'passed') {
                    try {
                        const receipt = await processSalesReturnReceipt(savedReturn);
                        if (receipt) {
                            if (receipt.value > 0) {
                                await postJournalEntry({
                                    lines: [
                                        { account_code: gl.inventory,    account_name: 'Inventory',          debit: receipt.value, credit: 0,            description: `Customer return ${savedReturn.return_number}` },
                                        { account_code: gl.cogs_general, account_name: 'Cost of Goods Sold', debit: 0,             credit: receipt.value, description: `${savedReturn.product_name} × ${receipt.quantity}` }
                                    ],
                                    referenceType: 'sales_return_cogs',
                                    referenceId:   savedReturn.return_number,
                                    description:   `COGS reversal – ${savedReturn.return_number}`,
                                    entryDate:     savedReturn.return_date,
                                    entryType:     'goods_receipt',
                                    orgId:         currentOrg?.id,
                                    area:          "inventory"
                                });
                            } else {
                                toast({
                                    title: "Stock returned — COGS not reversed",
                                    description: `Unit cost for ${savedReturn.product_code} is zero. Set the stock unit cost so the cost side can be reversed.`,
                                });
                            }
                            patch.stock_posted = true;
                            patch.stock_returned = true;
                            patch.stock_return_date = savedReturn.stock_return_date || savedReturn.return_date;
                            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
                        }
                    } catch (stockErr) {
                        toast({ title: "Credit note posted — stock not returned", description: stockErr.message, variant: "destructive" });
                    }
                } else {
                    toast({
                        title: "Stock not returned",
                        description: "Set Inspection Result to Passed to put the goods back into stock and reverse COGS.",
                    });
                }
            }

            // Reduce AR outstanding, once.
            if (savedReturn?.status === 'approved' && !savedReturn.ar_adjusted && savedReturn.invoice_number) {
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
                    patch.ar_adjusted = true;
                    queryClient.invalidateQueries({ queryKey: ['ar'] });
                    queryClient.invalidateQueries({ queryKey: ['accountsReceivable'] });
                } catch (_) {
                    // Non-fatal
                }
            }

            if (Object.keys(patch).length > 0) {
                await matrixSales.entities.SalesReturn.update(savedReturn.id, { ...savedReturn, ...patch });
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

    // The credit note has actually reached the ledger. Gates the post-approval
    // statuses so they cannot be used to bypass it.
    const hasPostedCreditNote = Boolean(item?.gl_posted);

    // Goods come back before payment at least as often as after, so payment status
    // must not gate this: any issued invoice can be returned. Filtering on
    // payment_status meant a tenant that had not been paid yet saw an empty list.
    const returnableInvoices = invoices.filter(isFinalisedInvoice);

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit Sales Return' : seedInvoiceNumber ? 'New Credit Note' : 'New Sales Return'}
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
                                    {returnableInvoices.map(i => (
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
                                        {/* Approved is the one status that posts the credit note. Received
                                            and Completed only become reachable once that has happened, so a
                                            return cannot jump straight to Completed and never hit the books. */}
                                        {(hasPostedCreditNote || formData.status === 'received') && <SelectItem value="received">Received</SelectItem>}
                                        {(hasPostedCreditNote || formData.status === 'completed') && <SelectItem value="completed">Completed</SelectItem>}
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                                {!hasPostedCreditNote && formData.status !== 'received' && formData.status !== 'completed' && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        Save as Approved to post the credit note — Received and Completed unlock after that.
                                    </p>
                                )}
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
                            <div className="flex justify-between items-center">
                                <Label className="text-gray-600">Discount (LKR):</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.discount_amount}
                                    onChange={(e) => handleChange('discount_amount', parseFloat(e.target.value) || 0)}
                                    className="w-32 text-right bg-white"
                                />
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

                    {item && (
                        <div className="border-t pt-4">
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                                    Journal Entries
                                </summary>
                                <JournalEntriesPanel documentNumber={item.return_number} />
                            </details>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t">
                        <ReverseButton
                            item={item}
                            entityName="SalesReturn"
                            queryKeys={['returns']}
                            onSuccess={onClose}
                            journalReferenceType="sales_return"
                            journalReferenceId={item?.return_number}
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