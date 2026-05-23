
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
import { ArrowRight, Printer, Paperclip } from "lucide-react"; 
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import DocumentList from "../shared/DocumentList";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";

export default function InvoiceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [activeTab, setActiveTab] = useState("details");
    
    const { data: salesOrders = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => matrixSales.entities.SalesOrder.list('-order_date'),
        initialData: []
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => matrixSales.entities.Delivery.list('-delivery_date'),
        initialData: []
    });

    const [formData, setFormData] = useState({
        invoice_number: '',
        sales_order_number: '',
        delivery_number: '',
        customer_name: '',
        customer_email: '',
        billing_address: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        product_code: '',
        product_name: '',
        quantity: 0,
        unit_price: 0,
        subtotal: 0,
        tax_percent: 0,
        tax_amount: 0,
        total_amount: 0,
        payment_terms: 'net_30',
        payment_status: 'unpaid',
        status: 'draft',
        amount_paid: 0,
        payment_date: '',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            // Ensure numbers are parsed if they come as strings
            setFormData({
                ...item,
                quantity: parseFloat(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                tax_percent: parseFloat(item.tax_percent) || 0,
                amount_paid: parseFloat(item.amount_paid) || 0,
            });
        }
    }, [item]);

    useEffect(() => {
        const subtotal = (formData.quantity || 0) * (formData.unit_price || 0);
        const taxAmount = subtotal * ((formData.tax_percent || 0) / 100);
        const total = subtotal + taxAmount;
        setFormData(prev => ({ 
            ...prev, 
            subtotal, 
            tax_amount: taxAmount,
            total_amount: total 
        }));
    }, [formData.quantity, formData.unit_price, formData.tax_percent]);

    const handleSalesOrderSelect = (orderNumber) => {
        const selectedOrder = salesOrders.find(o => o.order_number === orderNumber);
        if (selectedOrder) {
            // Find matching delivery with PGI status
            const matchingDelivery = deliveries.find(d => 
                d.sales_order_number === orderNumber && d.status === 'pgi_completed'
            );
            
            // Calculate due date based on payment terms
            const invoiceDate = new Date(formData.invoice_date);
            let daysToAdd = 30;
            if (selectedOrder.payment_terms === 'net_45') daysToAdd = 45;
            else if (selectedOrder.payment_terms === 'net_60') daysToAdd = 60;
            
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + daysToAdd);

            setFormData(prev => ({
                ...prev,
                sales_order_number: orderNumber,
                delivery_number: matchingDelivery?.delivery_number || '',
                customer_name: selectedOrder.customer_name,
                customer_email: selectedOrder.customer_email || '',
                billing_address: selectedOrder.delivery_address || '',
                product_code: selectedOrder.product_code,
                product_name: selectedOrder.product_name,
                quantity: parseFloat(selectedOrder.quantity) || 0, // Ensure numeric
                unit_price: parseFloat(selectedOrder.unit_price) || 0, // Ensure numeric
                payment_terms: selectedOrder.payment_terms || 'net_30',
                due_date: dueDate.toISOString().split('T')[0],
                notes: `Invoice for Sales Order: ${orderNumber}${matchingDelivery ? ` | Delivery: ${matchingDelivery.delivery_number}` : ''}`
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Invoice.update(item.id, data);
            }
            return matrixSales.entities.Invoice.create(data);
        },
        onSuccess: async (savedInvoice) => {
            if (savedInvoice?.status === 'submitted' && !savedInvoice.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: '1100', account_name: 'Trade Receivables', debit: savedInvoice.total_amount, credit: 0 },
                            { account_code: '4001', account_name: 'Sales Revenue', debit: 0, credit: savedInvoice.subtotal },
                            { account_code: '2200', account_name: 'VAT Payable', debit: 0, credit: savedInvoice.tax_amount || savedInvoice.vat_amount || 0 }
                        ].filter(line => Number(line.debit || line.credit || 0) > 0),
                        referenceType: 'sales_invoice',
                        referenceId: savedInvoice.invoice_number,
                        description: `Sales invoice ${savedInvoice.invoice_number}`,
                        entryDate: savedInvoice.invoice_date,
                        entryType: 'invoice',
                        orgId: currentOrg?.id
                    });
                    await matrixSales.entities.Invoice.update(savedInvoice.id, { ...savedInvoice, gl_posted: true });
                } catch (error) {
                    toast({ title: "Invoice saved but GL posting failed", description: error.message, variant: "destructive" });
                }
            }
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            toast({
                title: "Success",
                description: `Invoice ${item ? 'updated' : 'created'} successfully.`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} invoice: ${error.message || 'Unknown error'}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Filter sales orders that have a delivery with 'pgi_completed' status
    const deliveredOrders = salesOrders.filter(o => 
        deliveries.some(d => d.sales_order_number === o.order_number && d.status === 'pgi_completed')
    );

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit Invoice' : 'New Invoice'}
                        {formData.sales_order_number && (
                            <div className="flex gap-2">
                                <Badge variant="outline">SO: {formData.sales_order_number}</Badge>
                                {formData.delivery_number && (
                                    <Badge variant="outline">DEL: {formData.delivery_number}</Badge>
                                )}
                            </div>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-2 w-96">
                        <TabsTrigger value="details">Invoice Details</TabsTrigger>
                        <TabsTrigger value="documents">
                            <Paperclip className="w-4 h-4 mr-2" />
                            Documents
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Sales Order Reference Section */}
                            {!item && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                    <Label className="text-indigo-900 font-semibold mb-2 block">
                                        Select Sales Order *
                                    </Label>
                                    <Select 
                                        value={formData.sales_order_number} 
                                        onValueChange={handleSalesOrderSelect}
                                        required
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select a sales order with completed PGI..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {deliveredOrders.map(o => (
                                                <SelectItem key={o.id} value={o.order_number}>
                                                    {o.order_number} - {o.customer_name} - SAR {parseFloat(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </SelectItem>
                                            ))}
                                            {deliveredOrders.length === 0 && (
                                                <div className="p-2 text-sm text-gray-500">No sales orders with completed PGI found.</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {formData.sales_order_number && (
                                        <p className="text-sm text-indigo-700 mt-2 flex items-center gap-2">
                                            <ArrowRight className="w-4 h-4" />
                                            Data auto-filled from sales order and delivery
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Invoice Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Invoice Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Invoice Number *</Label>
                                        <Input
                                            value={formData.invoice_number}
                                            onChange={(e) => handleChange('invoice_number', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label>Delivery Number (PGI Completed)</Label>
                                        <Input
                                            value={formData.delivery_number}
                                            onChange={(e) => handleChange('delivery_number', e.target.value)}
                                            disabled={!!formData.sales_order_number} // Disable if SO is selected
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Invoice Date *</Label>
                                        <Input
                                            type="date"
                                            value={formData.invoice_date}
                                            onChange={(e) => handleChange('invoice_date', e.target.value)}
                                            required
                                        />
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
                                </div>
                            </div>

                            {/* Customer Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Bill To</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Customer Name *</Label>
                                        <Input
                                            value={formData.customer_name}
                                            onChange={(e) => handleChange('customer_name', e.target.value)}
                                            required
                                            disabled={!!formData.sales_order_number}
                                        />
                                    </div>
                                    <div>
                                        <Label>Customer Email</Label>
                                        <Input
                                            type="email"
                                            value={formData.customer_email}
                                            onChange={(e) => handleChange('customer_email', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Billing Address</Label>
                                    <Textarea
                                        value={formData.billing_address}
                                        onChange={(e) => handleChange('billing_address', e.target.value)}
                                        rows={2}
                                        disabled={!!formData.sales_order_number}
                                    />
                                </div>
                            </div>

                            {/* Product & Pricing */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Items & Pricing</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Product Code *</Label>
                                        <Input
                                            value={formData.product_code}
                                            onChange={(e) => handleChange('product_code', e.target.value)}
                                            required
                                            disabled={!!formData.sales_order_number}
                                        />
                                    </div>
                                    <div>
                                        <Label>Product Name *</Label>
                                        <Input
                                            value={formData.product_name}
                                            onChange={(e) => handleChange('product_name', e.target.value)}
                                            required
                                            disabled={!!formData.sales_order_number}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={formData.quantity}
                                            onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                                            required
                                            disabled={!!formData.sales_order_number}
                                        />
                                    </div>
                                    <div>
                                        <Label>Unit Price *</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.unit_price}
                                            onChange={(e) => handleChange('unit_price', parseFloat(e.target.value) || 0)}
                                            required
                                            disabled={!!formData.sales_order_number}
                                        />
                                    </div>
                                    <div>
                                        <Label>Tax %</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.tax_percent}
                                            onChange={(e) => handleChange('tax_percent', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span className="font-semibold">SAR {formData.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tax:</span>
                                        <span className="font-semibold">SAR {formData.tax_amount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Total Amount:</span>
                                        <span className="font-bold text-emerald-600">
                                            SAR {formData.total_amount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Payment Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Payment Terms</Label>
                                        <Select 
                                            value={formData.payment_terms} 
                                            onValueChange={(val) => handleChange('payment_terms', val)}
                                            disabled={!!formData.sales_order_number}
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
                                                <SelectItem value="submitted">Submitted</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Payment Status</Label>
                                        <Select 
                                            value={formData.payment_status} 
                                            onValueChange={(val) => handleChange('payment_status', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                                <SelectItem value="paid">Paid</SelectItem>
                                                <SelectItem value="overdue">Overdue</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Amount Paid</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.amount_paid}
                                            onChange={(e) => handleChange('amount_paid', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Payment Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.payment_date}
                                            onChange={(e) => handleChange('payment_date', e.target.value)}
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

                            <div className="flex justify-between items-center gap-3 pt-4 border-t">
                                <div>
                                    {item && (
                                        <Button 
                                            type="button" 
                                            variant="outline"
                                            onClick={() => {
                                                const printWindow = window.open('', '_blank');
                                                printWindow.document.write(`
                                                    <html>
                                                        <head>
                                                            <title>Invoice ${formData.invoice_number}</title>
                                                            <style>
                                                                body { font-family: Arial, sans-serif; padding: 40px; }
                                                                h1 { color: #059669; }
                                                                .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                                                                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                                                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                                                th { background-color: #f3f4f6; font-weight: bold; }
                                                                .totals { text-align: right; margin-top: 20px; }
                                                                .total-line { display: flex; justify-content: flex-end; gap: 100px; margin: 5px 0; }
                                                            </style>
                                                        </head>
                                                        <body>
                                                            <div class="header">
                                                                <div>
                                                                    <h1>TAX INVOICE</h1>
                                                                    <p><strong>Invoice #:</strong> ${formData.invoice_number}</p>
                                                                    <p><strong>Date:</strong> ${formData.invoice_date}</p>
                                                                    <p><strong>Due Date:</strong> ${formData.due_date}</p>
                                                                </div>
                                                                <div>
                                                                    <p><strong>Bill To:</strong></p>
                                                                    <p>${formData.customer_name}</p>
                                                                    <p>VAT: ${formData.customer_vat_number || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                            <table>
                                                                <tr>
                                                                    <th>Product</th>
                                                                    <th>Quantity</th>
                                                                    <th>Unit Price</th>
                                                                    <th>Amount</th>
                                                                </tr>
                                                                <tr>
                                                                    <td>${formData.product_name}</td>
                                                                    <td>${formData.quantity}</td>
                                                                    <td>SAR ${formData.unit_price.toFixed(2)}</td>
                                                                    <td>SAR ${formData.subtotal.toFixed(2)}</td>
                                                                </tr>
                                                            </table>
                                                            <div class="totals">
                                                                <div class="total-line">
                                                                    <span>Subtotal:</span>
                                                                    <span>SAR ${formData.subtotal.toFixed(2)}</span>
                                                                </div>
                                                                <div class="total-line">
                                                                    <span>Tax (${formData.tax_percent}%):</span>
                                                                    <span>SAR ${formData.tax_amount.toFixed(2)}</span>
                                                                </div>
                                                                <div class="total-line" style="font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px;">
                                                                    <span>Total Amount:</span>
                                                                    <span>SAR ${formData.total_amount.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </body>
                                                    </html>
                                                `);
                                                printWindow.document.close();
                                                printWindow.print();
                                            }}
                                            className="gap-2"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Print Invoice
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isLoading}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isLoading}>
                                        {saveMutation.isLoading ? (item ? 'Updating...' : 'Creating...') : (item ? 'Update' : 'Create') } Invoice
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </TabsContent>

                    <TabsContent value="documents">
                        {item ? (
                            <DocumentList
                                relatedEntity="invoice"
                                relatedEntityId={item.id}
                                relatedDocumentNumber={item.invoice_number}
                            />
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Paperclip className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                <p>Save the invoice first to upload documents</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
