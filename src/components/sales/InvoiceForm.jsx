
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
import { useSubscription } from "@/lib/SubscriptionContext";

export default function InvoiceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { atInvoiceLimit, invoiceLimit } = useSubscription();
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
        // Block new invoice creation when monthly limit is reached
        if (!item && atInvoiceLimit) {
            return;
        }
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Filter sales orders that have a delivery with 'pgi_completed' status
    const deliveredOrders = salesOrders.filter(o =>
        deliveries.some(d => d.sales_order_number === o.order_number && d.status === 'pgi_completed')
    );

    const handlePrintInvoice = () => {
        const org = currentOrg || {};
        const logoUrl = org.logo_url || '';
        const orgName = org.organization_name || org.trade_name || 'HORIZON';
        const orgNameAr = org.organization_name_ar || org.trade_name_ar || '';
        const vatNo = org.vat_registration_number || '';
        const crNo = org.cr_number || '';
        const address = [org.address_line1, org.city, org.country].filter(Boolean).join(', ');
        const fmt = (n) => Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8" />
<title>Invoice ${formData.invoice_number}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#1e293b;font-size:13px}
.page{max-width:800px;margin:0 auto;padding:40px}
.inv-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #24466f;padding-bottom:24px;margin-bottom:24px}
.brand img{max-height:56px;max-width:160px;object-fit:contain}
.brand-name{font-size:22px;font-weight:700;color:#24466f}
.brand-name-ar{font-family:'Cairo',sans-serif;font-size:18px;color:#24466f}
.brand-meta{font-size:11px;color:#64748b;line-height:1.8;margin-top:6px}
.inv-title{text-align:right}
.inv-title h1{font-size:28px;font-weight:700;color:#24466f}
.inv-title h1 span{display:block;font-family:'Cairo',sans-serif;font-size:18px;color:#64748b}
.inv-no{font-size:15px;font-weight:600;margin-top:8px}
.inv-date{font-size:12px;color:#64748b;margin-top:4px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
.party-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px}
.party-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}
.party-name{font-size:15px;font-weight:700;margin-bottom:4px}
.party-detail{font-size:12px;color:#475569;line-height:1.8}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead{background:#24466f;color:#fff}
thead th{padding:10px 14px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;text-align:left}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:10px 14px;border-bottom:1px solid #e2e8f0}
.num{text-align:right;font-variant-numeric:tabular-nums}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:32px}
.tot{width:300px}
.tot td{padding:6px 0;font-size:13px}
.tot td:last-child{text-align:right;font-weight:600}
.tot-grand{border-top:2px solid #24466f}
.tot-grand td{padding-top:10px;font-size:16px;font-weight:700;color:#24466f}
.inv-footer{border-top:1px solid #e2e8f0;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.notes{font-size:12px;color:#64748b;max-width:400px;line-height:1.6}
.badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.paid{background:#d1fae5;color:#065f46}.unpaid{background:#fee2e2;color:#991b1b}.partial{background:#fef3c7;color:#92400e}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{padding:20px}@page{margin:10mm;size:A4}}
</style>
</head>
<body>
<div class="page">
<div class="inv-header">
  <div class="brand">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : `<div class="brand-name">${orgName}</div>${orgNameAr ? `<div class="brand-name-ar">${orgNameAr}</div>` : ''}`}
    <div class="brand-meta">${vatNo ? `VAT: ${vatNo}<br>` : ''}${crNo ? `CR: ${crNo}<br>` : ''}${address}</div>
  </div>
  <div class="inv-title">
    <h1>TAX INVOICE<span>فاتورة ضريبية</span></h1>
    <div class="inv-no"># ${formData.invoice_number}</div>
    <div class="inv-date">Date: ${formData.invoice_date} &nbsp;|&nbsp; Due: ${formData.due_date || '—'}</div>
  </div>
</div>
<div class="parties">
  <div class="party-box">
    <div class="party-label">From / من</div>
    <div class="party-name">${orgName}</div>
    <div class="party-detail">${vatNo ? `VAT: ${vatNo}<br>` : ''}${address}</div>
  </div>
  <div class="party-box">
    <div class="party-label">Bill To / إلى</div>
    <div class="party-name">${formData.customer_name}</div>
    <div class="party-detail">${formData.customer_vat_number ? `VAT: ${formData.customer_vat_number}<br>` : ''}${formData.billing_address || ''}</div>
  </div>
</div>
<table>
  <thead><tr><th>#</th><th>Description / الوصف</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price (SAR)</th><th style="text-align:right">Amount (SAR)</th></tr></thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>${formData.product_code ? `[${formData.product_code}] ` : ''}${formData.product_name}</td>
      <td class="num">${formData.quantity}</td>
      <td class="num">${fmt(formData.unit_price)}</td>
      <td class="num">${fmt(formData.subtotal)}</td>
    </tr>
  </tbody>
</table>
<div class="totals-wrap">
  <table class="tot">
    <tr><td>Subtotal / قبل الضريبة</td><td>SAR ${fmt(formData.subtotal)}</td></tr>
    <tr><td>VAT (${formData.tax_percent}%) / ضريبة القيمة المضافة</td><td>SAR ${fmt(formData.tax_amount)}</td></tr>
    ${Number(formData.discount_amount) > 0 ? `<tr><td>Discount / خصم</td><td>− SAR ${fmt(formData.discount_amount)}</td></tr>` : ''}
    <tr class="tot-grand"><td>Total / الإجمالي</td><td>SAR ${fmt(formData.total_amount)}</td></tr>
    ${Number(formData.amount_paid) > 0 ? `<tr><td>Paid / مدفوع</td><td>SAR ${fmt(formData.amount_paid)}</td></tr><tr><td>Balance Due / الرصيد المستحق</td><td>SAR ${fmt(Number(formData.total_amount) - Number(formData.amount_paid))}</td></tr>` : ''}
  </table>
</div>
<div class="inv-footer">
  <div class="notes">${formData.payment_terms ? `<strong>Payment Terms:</strong> ${formData.payment_terms}<br>` : ''}${formData.notes ? `<strong>Notes:</strong> ${formData.notes}` : ''}</div>
  <span class="badge ${formData.payment_status === 'paid' ? 'paid' : formData.payment_status === 'partially_paid' ? 'partial' : 'unpaid'}">${(formData.payment_status || 'unpaid').replace(/_/g,' ').toUpperCase()}</span>
</div>
</div>
<script>window.onload=()=>window.print()<\/script>
</body></html>`);
        printWindow.document.close();
    };

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
                                            onClick={handlePrintInvoice}
                                            className="gap-2"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Print Invoice
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {!item && atInvoiceLimit && (
                                        <p className="text-xs font-medium text-red-600">
                                            Monthly invoice limit of {invoiceLimit.toLocaleString()} reached. Upgrade your plan to create more invoices.
                                        </p>
                                    )}
                                    <div className="flex gap-3">
                                        <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isLoading}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                            disabled={saveMutation.isLoading || (!item && atInvoiceLimit)}
                                            title={!item && atInvoiceLimit ? `Monthly limit of ${invoiceLimit.toLocaleString()} invoices reached` : undefined}
                                        >
                                            {saveMutation.isLoading ? (item ? 'Updating...' : 'Creating...') : (item ? 'Update' : 'Create')} Invoice
                                        </Button>
                                    </div>
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
