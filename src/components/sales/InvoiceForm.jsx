
import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Printer, Paperclip, Plus, Trash2, Truck, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import DocumentList from "../shared/DocumentList";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useSubscription } from "@/lib/SubscriptionContext";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import SearchableSelect from "../shared/SearchableSelect";

export default function InvoiceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { atInvoiceLimit, invoiceLimit } = useSubscription();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);
    const [activeTab, setActiveTab] = useState("details");

    // ── Source data ───────────────────────────────────────────────────────────
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

    // ── Multi-Delivery state ──────────────────────────────────────────────────
    // Each entry: { delivery_number, delivery_date, delivered_quantity, product_code }
    const [linkedDeliveries, setLinkedDeliveries] = useState([]);
    const [deliveryToAdd, setDeliveryToAdd] = useState('');

    const totalDeliveredQty = linkedDeliveries.reduce(
        (sum, d) => sum + (parseFloat(d.delivered_quantity) || 0), 0
    );

    // ── Form state ────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        invoice_number: '',
        sales_order_number: '',
        delivery_number: '',          // kept for backward compat
        customer_name: '',
        customer_email: '',
        billing_address: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        product_code: '',
        product_name: '',
        so_quantity: 0,
        quantity: 0,
        unit_price: 0,
        subtotal: 0,
        tax_type: 'standard',
        tax_percent: 18,
        tax_amount: 0,
        total_amount: 0,
        payment_terms: 'net_30',
        payment_status: 'unpaid',
        status: 'draft',
        amount_paid: 0,
        payment_date: '',
        three_way_match_status: 'pending',
        quantity_variance: 0,
        notes: ''
    });

    // Load existing record
    useEffect(() => {
        if (item) {
            setFormData(f => ({
                ...f,
                ...item,
                quantity: parseFloat(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                tax_percent: parseFloat(item.tax_percent) || 0,
                amount_paid: parseFloat(item.amount_paid) || 0,
            }));
            // Parse stored delivery references
            const refs = item.delivery_references;
            if (Array.isArray(refs)) {
                setLinkedDeliveries(refs);
            } else if (typeof refs === 'string' && refs) {
                try { setLinkedDeliveries(JSON.parse(refs)); } catch { setLinkedDeliveries([]); }
            }
        }
    }, [item]);

    const TAX_TYPES = {
        standard: { label: "Standard Rate (18%)", rate: 18 },
        export:   { label: "Export — Zero Rated (0%)", rate: 0 },
        exempt:   { label: "Exempt (0%)", rate: 0 },
        outside:  { label: "Outside Scope (0%)", rate: 0 },
    };

    // ── Recalculate totals + 3-way match ──────────────────────────────────────
    useEffect(() => {
        const subtotal = (formData.quantity || 0) * (formData.unit_price || 0);
        const taxAmount = subtotal * ((formData.tax_percent || 0) / 100);
        const total = subtotal + taxAmount;

        const qtyVariance = (formData.quantity || 0) - totalDeliveredQty;

        let matchStatus = 'pending';
        if (formData.sales_order_number && linkedDeliveries.length > 0) {
            const varPct = Math.abs(qtyVariance / (totalDeliveredQty || 1));
            if (varPct === 0)       matchStatus = 'matched';
            else if (varPct <= 0.05) matchStatus = 'variance_within_tolerance';
            else                     matchStatus = 'variance_exceeded';
        }

        setFormData(prev => ({
            ...prev,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            quantity_variance: qtyVariance,
            three_way_match_status: matchStatus,
            total_delivered_quantity: totalDeliveredQty,
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.quantity, formData.unit_price, formData.tax_percent, totalDeliveredQty]);

    // ── Deliveries available to add ───────────────────────────────────────────
    const availableDeliveryOptions = useMemo(() => {
        if (!formData.sales_order_number) return [];
        const alreadyLinked = new Set(linkedDeliveries.map(d => d.delivery_number));
        return deliveries
            .filter(d =>
                d.sales_order_number === formData.sales_order_number &&
                d.status === 'pgi_completed' &&
                !alreadyLinked.has(d.delivery_number)
            )
            .map(d => ({
                value: d.delivery_number,
                label: `${d.delivery_number} | ${d.delivery_date || ''} | ${parseFloat(d.quantity) || 0} ${d.unit_of_measure || ''}`,
            }));
    }, [deliveries, formData.sales_order_number, linkedDeliveries]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleTaxTypeChange = (taxType) => {
        const rate = TAX_TYPES[taxType]?.rate ?? 18;
        setFormData(prev => ({ ...prev, tax_type: taxType, tax_percent: rate }));
        setIsDirty(true);
    };

    const handleSalesOrderSelect = (orderNumber) => {
        const selectedOrder = salesOrders.find(o => o.order_number === orderNumber);
        if (!selectedOrder) return;

        setLinkedDeliveries([]);
        setDeliveryToAdd('');

        const invoiceDate = new Date(formData.invoice_date);
        let daysToAdd = 30;
        if (selectedOrder.payment_terms === 'net_45') daysToAdd = 45;
        else if (selectedOrder.payment_terms === 'net_60') daysToAdd = 60;
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + daysToAdd);

        setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            sales_order_number: orderNumber,
            delivery_number: '',
            customer_name: selectedOrder.customer_name,
            customer_email: selectedOrder.customer_email || '',
            billing_address: selectedOrder.delivery_address || '',
            product_code: selectedOrder.product_code || '',
            product_name: selectedOrder.product_name || '',
            so_quantity: parseFloat(selectedOrder.quantity) || 0,
            quantity: parseFloat(selectedOrder.quantity) || 0,
            unit_price: parseFloat(selectedOrder.unit_price) || 0,
            payment_terms: selectedOrder.payment_terms || 'net_30',
            due_date: dueDate.toISOString().split('T')[0],
            notes: `Invoice for Sales Order: ${orderNumber}`,
        }));
    };

    const handleAddDelivery = () => {
        if (!deliveryToAdd) return;
        const del = deliveries.find(d => d.delivery_number === deliveryToAdd);
        if (!del) return;
        const qty = parseFloat(del.quantity) || parseFloat(del.delivered_quantity) || 0;
        setLinkedDeliveries(prev => [
            ...prev,
            {
                delivery_number: del.delivery_number,
                delivery_date: del.delivery_date || '',
                delivered_quantity: qty,
                product_code: del.product_code || '',
            }
        ]);
        setDeliveryToAdd('');
        setIsDirty(true);
    };

    const handleRemoveDelivery = (deliveryNumber) => {
        setLinkedDeliveries(prev => prev.filter(d => d.delivery_number !== deliveryNumber));
        setIsDirty(true);
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.Invoice.update(item.id, data)
            : matrixSales.entities.Invoice.create(data),
        onSuccess: async (savedInvoice) => {
            if (savedInvoice?.status === 'submitted' && !savedInvoice.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: gl.ar_receivables, account_name: 'Trade Receivables', debit: savedInvoice.total_amount, credit: 0 },
                            { account_code: gl.sales_revenue,  account_name: 'Sales Revenue',     debit: 0, credit: savedInvoice.subtotal },
                            { account_code: gl.vat_output,     account_name: 'VAT Payable',       debit: 0, credit: savedInvoice.tax_amount || savedInvoice.vat_amount || 0 }
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

            // Create AR record on first submission so customer balance is tracked in Finance → AR
            if (savedInvoice?.status === 'submitted') {
                try {
                    const existingAR = await matrixSales.entities.AccountsReceivable.filter({
                        invoice_number: savedInvoice.invoice_number
                    });
                    if (existingAR.length === 0) {
                        await matrixSales.entities.AccountsReceivable.create({
                            ar_number:          `AR-${savedInvoice.invoice_number}`,
                            invoice_number:     savedInvoice.invoice_number,
                            customer_code:      savedInvoice.customer_code || '',
                            customer_name:      savedInvoice.customer_name,
                            invoice_date:       savedInvoice.invoice_date,
                            due_date:           savedInvoice.due_date || '',
                            invoice_amount:     savedInvoice.total_amount,
                            paid_amount:        0,
                            outstanding_amount: savedInvoice.total_amount,
                            vat_amount:         savedInvoice.tax_amount || savedInvoice.vat_amount || 0,
                            currency:           savedInvoice.currency || 'LKR',
                            payment_terms:      savedInvoice.payment_terms || 'net_30',
                            aging_days:         0,
                            aging_bucket:       'current',
                            status:             'open',
                            notes:              `From Sales Invoice ${savedInvoice.invoice_number}`,
                        });
                    }
                    queryClient.invalidateQueries({ queryKey: ['ar'] });
                } catch (arErr) {
                    toast({ title: "Saved but AR record failed", description: arErr.message, variant: "destructive" });
                }
            }

            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            toast({ title: "Success", description: `Invoice ${item ? 'updated' : 'created'} successfully.` });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Error", description: `Failed to ${item ? 'update' : 'create'} invoice: ${error.message}`, variant: "destructive" });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!item && atInvoiceLimit) return;
        saveMutation.mutate({
            ...formData,
            delivery_references: linkedDeliveries,
            // backward compat: first delivery number
            delivery_number: linkedDeliveries.map(d => d.delivery_number).join(', ') || formData.delivery_number,
        });
    };

    // ── Filter options ────────────────────────────────────────────────────────
    // Show all SOs that have at least one pgi_completed delivery
    const deliveredOrders = salesOrders.filter(o =>
        deliveries.some(d => d.sales_order_number === o.order_number && d.status === 'pgi_completed')
    );

    const soOptions = deliveredOrders.map(o => ({
        value: o.order_number,
        label: `${o.order_number} | ${o.customer_name} | ${parseFloat(o.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR`,
    }));

    const matchColors = {
        pending:                   'bg-yellow-50 border-yellow-300 text-yellow-800',
        matched:                   'bg-green-50  border-green-300  text-green-800',
        variance_within_tolerance: 'bg-blue-50   border-blue-300   text-blue-800',
        variance_exceeded:         'bg-red-50    border-red-300    text-red-800',
    };
    const matchIcon = {
        matched:                   <CheckCircle2 className="w-5 h-5 text-green-600" />,
        variance_within_tolerance: <AlertCircle  className="w-5 h-5 text-blue-600" />,
        variance_exceeded:         <AlertTriangle className="w-5 h-5 text-red-600" />,
    };

    // ── Print ─────────────────────────────────────────────────────────────────
    const handlePrintInvoice = () => {
        const org = currentOrg || {};
        const logoUrl = org.logo_url || '';
        const orgName = org.organization_name || org.trade_name || 'HORIZON';
        const vatNo = org.vat_registration_number || '';
        const crNo = org.cr_number || '';
        const address = [org.address_line1, org.city, org.country].filter(Boolean).join(', ');
        const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
.brand-meta{font-size:11px;color:#64748b;line-height:1.8;margin-top:6px}
.inv-title{text-align:right}
.inv-title h1{font-size:28px;font-weight:700;color:#24466f}
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
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : `<div class="brand-name">${orgName}</div>`}
    <div class="brand-meta">${vatNo ? `VAT: ${vatNo}<br>` : ''}${crNo ? `CR: ${crNo}<br>` : ''}${address}</div>
  </div>
  <div class="inv-title">
    <h1>TAX INVOICE</h1>
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
  <thead><tr><th>#</th><th>Description / الوصف</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price (LKR)</th><th style="text-align:right">Amount (LKR)</th></tr></thead>
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
    <tr><td>Subtotal / قبل الضريبة</td><td>LKR ${fmt(formData.subtotal)}</td></tr>
    <tr><td>VAT (${formData.tax_percent}%)</td><td>LKR ${fmt(formData.tax_amount)}</td></tr>
    ${Number(formData.discount_amount) > 0 ? `<tr><td>Discount / خصم</td><td>− LKR ${fmt(formData.discount_amount)}</td></tr>` : ''}
    <tr class="tot-grand"><td>Total / الإجمالي</td><td>LKR ${fmt(formData.total_amount)}</td></tr>
    ${Number(formData.amount_paid) > 0 ? `<tr><td>Paid / مدفوع</td><td>LKR ${fmt(formData.amount_paid)}</td></tr><tr><td>Balance Due / الرصيد المستحق</td><td>LKR ${fmt(Number(formData.total_amount) - Number(formData.amount_paid))}</td></tr>` : ''}
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
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-indigo-600" />
                        {item ? 'Edit Invoice' : 'New Sales Invoice — 3-Way Match'}
                        {formData.sales_order_number && (
                            <div className="flex gap-2 ml-2">
                                <Badge variant="outline">SO: {formData.sales_order_number}</Badge>
                                {linkedDeliveries.length > 0 && (
                                    <Badge variant="outline" className="text-indigo-700 border-indigo-300">
                                        {linkedDeliveries.length} Delivery{linkedDeliveries.length > 1 ? 's' : ''}
                                    </Badge>
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
                        <form onSubmit={handleSubmit} className="space-y-6 pt-2">

                            {/* ── Sales Order selection ──────────────────────────── */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                                <SearchableSelect
                                    label="Sales Order *"
                                    value={formData.sales_order_number}
                                    onValueChange={handleSalesOrderSelect}
                                    options={soOptions}
                                    placeholder="Select a sales order with completed PGI…"
                                    searchPlaceholder="Search by SO#, customer, amount…"
                                    required={!item}
                                />
                                {formData.sales_order_number && (
                                    <p className="text-sm text-indigo-700 flex items-center gap-2">
                                        <ArrowRight className="w-4 h-4" />
                                        Customer and product details auto-filled from sales order
                                    </p>
                                )}
                                {deliveredOrders.length === 0 && !item && (
                                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                        No sales orders with PGI-completed deliveries found.
                                    </p>
                                )}
                            </div>

                            {/* ── Linked Deliveries ─────────────────────────────── */}
                            {formData.sales_order_number && (
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-base border-b pb-2 flex items-center gap-2">
                                        Delivery Notes (PGI Completed)
                                        {linkedDeliveries.length > 0 && (
                                            <Badge variant="secondary">{linkedDeliveries.length} linked</Badge>
                                        )}
                                    </h3>

                                    {linkedDeliveries.length > 0 && (
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-600">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium">Delivery #</th>
                                                        <th className="px-3 py-2 text-left font-medium">Delivery Date</th>
                                                        <th className="px-3 py-2 text-right font-medium">Delivered Qty</th>
                                                        <th className="px-3 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {linkedDeliveries.map(d => (
                                                        <tr key={d.delivery_number} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 font-mono text-sm font-medium text-indigo-700">{d.delivery_number}</td>
                                                            <td className="px-3 py-2 text-gray-600">{d.delivery_date || '—'}</td>
                                                            <td className="px-3 py-2 text-right font-semibold">{Number(d.delivered_quantity).toFixed(3)}</td>
                                                            <td className="px-3 py-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveDelivery(d.delivery_number)}
                                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-indigo-50 font-bold">
                                                        <td className="px-3 py-2" colSpan={2}>Total Delivered Quantity</td>
                                                        <td className="px-3 py-2 text-right text-indigo-700">{totalDeliveredQty.toFixed(3)}</td>
                                                        <td></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Add Delivery row */}
                                    {availableDeliveryOptions.length > 0 && (
                                        <div className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <SearchableSelect
                                                    label={linkedDeliveries.length === 0 ? "Select Delivery *" : "Add another Delivery"}
                                                    value={deliveryToAdd}
                                                    onValueChange={setDeliveryToAdd}
                                                    options={availableDeliveryOptions}
                                                    placeholder="Select delivery to add…"
                                                    searchPlaceholder="Search by delivery#, date, qty…"
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-indigo-500 text-indigo-700 hover:bg-indigo-50 shrink-0"
                                                onClick={handleAddDelivery}
                                                disabled={!deliveryToAdd}
                                            >
                                                <Plus className="w-4 h-4 mr-1" /> Add
                                            </Button>
                                        </div>
                                    )}

                                    {availableDeliveryOptions.length === 0 && linkedDeliveries.length === 0 && (
                                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                                            No PGI-completed deliveries found for this order.
                                        </p>
                                    )}

                                    {/* 3-way match status */}
                                    {linkedDeliveries.length > 0 && (
                                        <Alert className={`border-2 ${matchColors[formData.three_way_match_status] || matchColors.pending}`}>
                                            <div className="flex items-start gap-3">
                                                {matchIcon[formData.three_way_match_status]}
                                                <div className="flex-1">
                                                    <p className="font-semibold">
                                                        3-Way Match: {String(formData.three_way_match_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                                                    </p>
                                                    <AlertDescription>
                                                        SO: {formData.so_quantity} → Delivered: {totalDeliveredQty.toFixed(3)} → Invoice: {formData.quantity}
                                                        {' | '}Qty Variance: {Number(formData.quantity_variance || 0).toFixed(3)}
                                                    </AlertDescription>
                                                </div>
                                            </div>
                                        </Alert>
                                    )}
                                </div>
                            )}

                            {/* ── Invoice header ────────────────────────────────── */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Invoice Information</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Invoice Number *</Label>
                                        <Input
                                            value={formData.invoice_number}
                                            onChange={(e) => handleChange('invoice_number', e.target.value)}
                                            required
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

                            {/* ── Customer ──────────────────────────────────────── */}
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

                            {/* ── Items ─────────────────────────────────────────── */}
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
                                        <Label>Invoiced Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={formData.quantity}
                                            onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                                            required
                                        />
                                        {totalDeliveredQty > 0 && formData.quantity !== totalDeliveredQty && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs mt-1 h-6 text-gray-500"
                                                onClick={() => handleChange('quantity', totalDeliveredQty)}
                                            >
                                                Use delivered total ({totalDeliveredQty.toFixed(3)})
                                            </Button>
                                        )}
                                    </div>
                                    <div>
                                        <Label>Unit Price (LKR) *</Label>
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
                                        <Label>VAT Type</Label>
                                        <Select
                                            value={formData.tax_type || 'standard'}
                                            onValueChange={handleTaxTypeChange}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="standard">Standard 18%</SelectItem>
                                                <SelectItem value="export">Export 0%</SelectItem>
                                                <SelectItem value="exempt">Exempt 0%</SelectItem>
                                                <SelectItem value="outside">Outside Scope 0%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span className="font-semibold">LKR {Number(formData.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">VAT ({formData.tax_percent}%):</span>
                                        <span className="font-semibold">LKR {Number(formData.tax_amount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Total Amount:</span>
                                        <span className="font-bold text-emerald-600">LKR {Number(formData.total_amount || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Payment ───────────────────────────────────────── */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Payment Details</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Payment Terms</Label>
                                        <Select
                                            value={formData.payment_terms}
                                            onValueChange={(v) => handleChange('payment_terms', v)}
                                            disabled={!!formData.sales_order_number}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                                        <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="draft">Draft</SelectItem>
                                                <SelectItem value="submitted">Submitted</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Payment Status</Label>
                                        <Select value={formData.payment_status} onValueChange={(v) => handleChange('payment_status', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                                        <Label>Amount Paid (LKR)</Label>
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

                            {/* ── Footer ───────────────────────────────────────── */}
                            <div className="flex justify-between items-center gap-3 pt-4 border-t">
                                <div>
                                    {item && (
                                        <Button type="button" variant="outline" onClick={handlePrintInvoice} className="gap-2">
                                            <Printer className="w-4 h-4" /> Print Invoice
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {!item && atInvoiceLimit && (
                                        <p className="text-xs font-medium text-red-600">
                                            Monthly invoice limit of {invoiceLimit.toLocaleString()} reached. Upgrade to create more.
                                        </p>
                                    )}
                                    <div className="flex gap-3">
                                        <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                            disabled={saveMutation.isPending || (!item && atInvoiceLimit)}
                                        >
                                            {saveMutation.isPending
                                                ? (item ? 'Updating…' : 'Creating…')
                                                : (item ? 'Update' : 'Create')} Invoice
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
