
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
import InvoicePrintPreview from "@/components/printing/InvoicePrintPreview";
import { getTenantLogoAsset, getTenantPrintingPreferences } from "@/components/printing/invoicePrintService";

export default function InvoiceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("details");
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const today = new Date().toISOString().split('T')[0];
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    
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

    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => matrixSales.entities.Organization.list(),
        initialData: []
    });

    const { data: printingPreference } = useQuery({
        queryKey: ['tenantPrintingPreferences'],
        queryFn: getTenantPrintingPreferences
    });

    const { data: logoAsset } = useQuery({
        queryKey: ['tenantLogoAsset'],
        queryFn: getTenantLogoAsset
    });

    const [formData, setFormData] = useState({
        invoice_number: '',
        invoice_mode: 'service',
        invoice_category: 'service',
        invoice_type: 'standard_tax_invoice',
        sales_order_number: '',
        delivery_number: '',
        customer_name: '',
        customer_email: '',
        customer_vat_number: '',
        billing_address: '',
        invoice_date: today,
        due_date: defaultDueDate.toISOString().split('T')[0],
        service_period_start: today,
        service_period_end: defaultDueDate.toISOString().split('T')[0],
        product_code: '',
        product_name: '',
        service_description: '',
        unit_of_measure: 'month',
        quantity: 1,
        unit_price: 0,
        subtotal: 0,
        tax_percent: 15,
        tax_amount: 0,
        total_amount: 0,
        payment_terms: 'net_30',
        payment_status: 'unpaid',
        amount_paid: 0,
        payment_date: '',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            // Ensure numbers are parsed if they come as strings
            setFormData({
                ...item,
                invoice_mode: item.invoice_mode || (item.invoice_category === 'service' ? 'service' : 'sales_order'),
                invoice_category: item.invoice_category || item.invoice_mode || 'sales_order',
                invoice_type: item.invoice_type || 'standard_tax_invoice',
                quantity: parseFloat(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                tax_percent: parseFloat(item.tax_percent) || 15,
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
                invoice_mode: 'sales_order',
                invoice_category: 'sales_order',
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
        onSuccess: () => {
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
        const isService = formData.invoice_mode === 'service';
        const payload = {
            ...formData,
            invoice_category: isService ? 'service' : 'sales_order',
            product_code: isService ? (formData.product_code || 'SERVICE') : formData.product_code,
            product_name: isService ? (formData.product_name || formData.service_description || 'IT Services') : formData.product_name,
            service_description: isService ? (formData.service_description || formData.product_name || 'IT Services') : formData.service_description
        };

        if (isService && (!payload.customer_name || !payload.service_description || !payload.due_date)) {
            toast({
                title: "Missing invoice data",
                description: "Customer, service description, and due date are required for service invoices.",
                variant: "destructive"
            });
            return;
        }

        saveMutation.mutate(payload);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Filter sales orders that have a delivery with 'pgi_completed' status
    const deliveredOrders = salesOrders.filter(o => 
        deliveries.some(d => d.sales_order_number === o.order_number && d.status === 'pgi_completed')
    );
    const isServiceInvoiceMode = formData.invoice_mode === 'service';

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
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <Label>Invoice Mode</Label>
                                        <Select
                                            value={formData.invoice_mode}
                                            onValueChange={(value) => {
                                                handleChange('invoice_mode', value);
                                                handleChange('invoice_category', value === 'service' ? 'service' : 'sales_order');
                                                if (value === 'service') {
                                                    handleChange('sales_order_number', '');
                                                    handleChange('delivery_number', '');
                                                    handleChange('quantity', formData.quantity || 1);
                                                    handleChange('tax_percent', formData.tax_percent || 15);
                                                }
                                            }}
                                            disabled={!!item}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="service">Service Invoice</SelectItem>
                                                <SelectItem value="sales_order">Sales Order Invoice</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Invoice Type</Label>
                                        <Select value={formData.invoice_type} onValueChange={(value) => handleChange('invoice_type', value)}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="standard_tax_invoice">Standard Tax Invoice (B2B)</SelectItem>
                                                <SelectItem value="simplified_tax_invoice">Simplified Tax Invoice (B2C)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Inventory Validation</Label>
                                        <div className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-slate-600 border">
                                            {isServiceInvoiceMode ? 'Disabled for service-only invoices' : 'Requires delivered sales order'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sales Order Reference Section */}
                            {!item && !isServiceInvoiceMode && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                    <Label className="text-indigo-900 font-semibold mb-2 block">
                                        Select Sales Order *
                                    </Label>
                                    <Select 
                                        value={formData.sales_order_number} 
                                        onValueChange={handleSalesOrderSelect}
                                        required={!isServiceInvoiceMode}
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
                                        <Label>Invoice Number</Label>
                                        <Input
                                            value={formData.invoice_number}
                                            onChange={(e) => handleChange('invoice_number', e.target.value)}
                                            placeholder="Auto if blank"
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
                                {isServiceInvoiceMode && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Service Period Start</Label>
                                            <Input
                                                type="date"
                                                value={formData.service_period_start || ''}
                                                onChange={(e) => handleChange('service_period_start', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Service Period End</Label>
                                            <Input
                                                type="date"
                                                value={formData.service_period_end || ''}
                                                onChange={(e) => handleChange('service_period_end', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
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
                                    <div>
                                        <Label>Customer VAT Number</Label>
                                        <Input
                                            value={formData.customer_vat_number || ''}
                                            onChange={(e) => handleChange('customer_vat_number', e.target.value)}
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
                                <h3 className="font-semibold text-lg border-b pb-2">{isServiceInvoiceMode ? 'Services & Pricing' : 'Items & Pricing'}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>{isServiceInvoiceMode ? 'Service Code' : 'Product Code *'}</Label>
                                        <Input
                                            value={formData.product_code}
                                            onChange={(e) => handleChange('product_code', e.target.value)}
                                            required={!isServiceInvoiceMode}
                                            disabled={!!formData.sales_order_number}
                                            placeholder={isServiceInvoiceMode ? 'SERVICE' : ''}
                                        />
                                    </div>
                                    <div>
                                        <Label>{isServiceInvoiceMode ? 'Service Name *' : 'Product Name *'}</Label>
                                        <Input
                                            value={formData.product_name}
                                            onChange={(e) => {
                                                handleChange('product_name', e.target.value);
                                                if (isServiceInvoiceMode) handleChange('service_description', e.target.value);
                                            }}
                                            required
                                            disabled={!!formData.sales_order_number}
                                        />
                                    </div>
                                </div>

                                {isServiceInvoiceMode && (
                                    <div>
                                        <Label>Service Description *</Label>
                                        <Textarea
                                            value={formData.service_description || ''}
                                            onChange={(e) => handleChange('service_description', e.target.value)}
                                            rows={3}
                                            placeholder="Monthly IT support services, cloud administration, AMC/SLA, consulting hours..."
                                            required
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-4 gap-4">
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
                                        <Label>Unit</Label>
                                        <Input
                                            value={formData.unit_of_measure || ''}
                                            onChange={(e) => handleChange('unit_of_measure', e.target.value)}
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
                                            onClick={() => setShowPrintPreview(true)}
                                            className="gap-2"
                                        >
                                            <Printer className="w-4 h-4" />
                                            ZATCA Print Preview
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
            {showPrintPreview && (
                <InvoicePrintPreview
                    invoice={{ ...formData, id: item?.id }}
                    organization={organizations[0] || {}}
                    preferences={printingPreference}
                    logoAsset={logoAsset}
                    onClose={() => setShowPrintPreview(false)}
                />
            )}
        </Dialog>
    );
}
