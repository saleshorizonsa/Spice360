import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle2, AlertTriangle, Plus, Trash2, PackageCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import ReverseButton from "../shared/ReverseButton";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import SearchableSelect from "../shared/SearchableSelect";

export default function VendorInvoiceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const taxConfig = useTaxConfig();
    const gl = useGLAccounts();
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);

    // ── Source data ───────────────────────────────────────────────────────────
    const { data: grns = [] } = useQuery({
        queryKey: ['grns'],
        queryFn: () => matrixSales.entities.GoodsReceiptNote.list('-grn_date'),
        initialData: []
    });

    const { data: pos = [] } = useQuery({
        queryKey: ['purchaseOrders'],
        queryFn: () => matrixSales.entities.PurchaseOrder.list(),
        initialData: []
    });

    // ── Multi-GRN state (primary matching documents) ──────────────────────────
    // Each entry: { grn_number, grn_date, grn_quantity, material_code, unit_cost }
    const [linkedGRNs, setLinkedGRNs] = useState([]);
    const [grnToAdd, setGrnToAdd]     = useState('');

    const totalGRNQty = linkedGRNs.reduce((sum, g) => sum + (parseFloat(g.grn_quantity) || 0), 0);

    // Vendor locked to first GRN's vendor
    const lockedVendorCode = linkedGRNs[0]?.vendor_code || '';

    // ── Form state ────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        vendor_invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        // vendor (auto-filled from first GRN)
        vendor_code: '',
        vendor_name: '',
        // material (auto-filled from first GRN; editable if GRNs span materials)
        material_code: '',
        material_name: '',
        // optional PO reference (for 3-way traceability)
        po_number: '',
        po_quantity: 0,
        po_unit_price: 0,
        po_total_amount: 0,
        // invoice line
        invoiced_quantity: 0,
        unit_price: 0,
        subtotal: 0,
        freight_cost: 0,
        other_charges: 0,
        vat_amount: 0,
        total_amount: 0,
        currency: 'LKR',
        // match
        three_way_match_status: 'pending',
        quantity_variance: 0,
        price_variance: 0,
        variance_notes: '',
        status: 'pending_match',
        notes: ''
    });

    // Load existing record
    useEffect(() => {
        if (item) {
            setFormData(f => ({ ...f, ...item }));
            const refs = item.grn_references;
            if (Array.isArray(refs)) {
                setLinkedGRNs(refs);
            } else if (typeof refs === 'string' && refs) {
                try { setLinkedGRNs(JSON.parse(refs)); } catch { setLinkedGRNs([]); }
            }
        }
    }, [item]);

    // ── GRNs available to add ─────────────────────────────────────────────────
    // Only completed/posted GRNs; if GRNs already linked, restrict to same vendor.
    const availableGRNOptions = useMemo(() => {
        const alreadyLinked = new Set(linkedGRNs.map(g => g.grn_number));
        return grns
            .filter(g =>
                (g.status === 'completed' || g.status === 'posted') &&
                !alreadyLinked.has(g.grn_number) &&
                (lockedVendorCode === '' || g.vendor_code === lockedVendorCode)
            )
            .map(g => ({
                value: g.grn_number,
                label: `${g.grn_number} | ${g.grn_date || g.receipt_date || ''} | ${g.vendor_name || ''} | ${g.material_name || g.material_code || ''} | ${parseFloat(g.quantity_received) || parseFloat(g.accepted_quantity) || 0} ${g.unit_of_measure || ''}`,
                _raw: g,
            }));
    }, [grns, linkedGRNs, lockedVendorCode]);

    // ── PO options (same vendor, optional reference) ──────────────────────────
    const poOptions = useMemo(() => {
        return pos
            .filter(p => !lockedVendorCode || p.vendor_code === lockedVendorCode)
            .map(p => ({
                value: p.po_number,
                label: `${p.po_number} | ${p.vendor_name || ''} | ${p.material_name || p.description || ''} | ${p.status}`,
            }));
    }, [pos, lockedVendorCode]);

    // ── Recalculate totals + match whenever inputs change ─────────────────────
    useEffect(() => {
        const subtotal   = (formData.invoiced_quantity || 0) * (formData.unit_price || 0);
        const beforeVat  = subtotal + (formData.freight_cost || 0) + (formData.other_charges || 0);
        const vatAmount  = beforeVat * (taxConfig.vat_standard_rate / 100);
        const total      = beforeVat + vatAmount;

        const qtyVariance   = (formData.invoiced_quantity || 0) - totalGRNQty;
        // Price reference: GRN unit cost if available, else PO unit price
        const refUnitPrice  = parseFloat(linkedGRNs[0]?.unit_cost) || formData.po_unit_price || 0;
        const priceVariance = ((formData.unit_price || 0) - refUnitPrice) * (formData.invoiced_quantity || 0);

        let matchStatus = 'pending';
        if (linkedGRNs.length > 0) {
            const qtyVarPct   = totalGRNQty > 0 ? Math.abs(qtyVariance / totalGRNQty) : (qtyVariance === 0 ? 0 : 1);
            const priceVarPct = refUnitPrice > 0 ? Math.abs(priceVariance / (refUnitPrice * (formData.invoiced_quantity || 1))) : 0;
            if (qtyVarPct === 0 && priceVarPct === 0)            matchStatus = 'matched';
            else if (qtyVarPct <= 0.05 && priceVarPct <= 0.05)  matchStatus = 'variance_within_tolerance';
            else                                                   matchStatus = 'variance_exceeded';
        }

        setFormData(prev => ({
            ...prev,
            subtotal,
            vat_amount: vatAmount,
            total_amount: total,
            quantity_variance: qtyVariance,
            price_variance: priceVariance,
            three_way_match_status: matchStatus,
            total_grn_quantity: totalGRNQty,
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        formData.invoiced_quantity,
        formData.unit_price,
        formData.freight_cost,
        formData.other_charges,
        formData.po_unit_price,
        taxConfig.vat_standard_rate,
        totalGRNQty,
        linkedGRNs,
    ]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleAddGRN = () => {
        if (!grnToAdd) return;
        const grn = grns.find(g => g.grn_number === grnToAdd);
        if (!grn) return;

        const qty      = parseFloat(grn.quantity_received) || parseFloat(grn.accepted_quantity) || 0;
        const unitCost = parseFloat(grn.unit_price) || parseFloat(grn.unit_cost) || 0;

        const isFirst = linkedGRNs.length === 0;
        const newLinked = [
            ...linkedGRNs,
            {
                grn_number:   grn.grn_number,
                grn_date:     grn.grn_date || grn.receipt_date || '',
                grn_quantity: qty,
                material_code: grn.material_code || '',
                unit_cost:    unitCost,
                vendor_code:  grn.vendor_code || '',
                vendor_name:  grn.vendor_name || '',
            }
        ];
        setLinkedGRNs(newLinked);
        setGrnToAdd('');
        setIsDirty(true);

        // Auto-fill vendor + material from the FIRST GRN added
        if (isFirst) {
            setFormData(prev => ({
                ...prev,
                vendor_code:   grn.vendor_code   || prev.vendor_code,
                vendor_name:   grn.vendor_name   || prev.vendor_name,
                material_code: grn.material_code || prev.material_code,
                material_name: grn.material_name || prev.material_name,
                unit_price:    unitCost           || prev.unit_price,
                invoiced_quantity: qty,           // default to first GRN qty; user adjusts
            }));
        }
    };

    const handleRemoveGRN = (grnNumber) => {
        const remaining = linkedGRNs.filter(g => g.grn_number !== grnNumber);
        setLinkedGRNs(remaining);
        setIsDirty(true);
        // If all GRNs removed, clear auto-filled vendor/material
        if (remaining.length === 0) {
            setFormData(prev => ({
                ...prev,
                vendor_code: '', vendor_name: '',
                material_code: '', material_name: '',
                invoiced_quantity: 0, unit_price: 0,
            }));
        }
    };

    const handlePOSelect = (poNumber) => {
        if (!poNumber) {
            setFormData(prev => ({ ...prev, po_number: '', po_quantity: 0, po_unit_price: 0, po_total_amount: 0 }));
            setIsDirty(true);
            return;
        }
        const po = pos.find(p => p.po_number === poNumber);
        if (!po) return;
        setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            po_number:       poNumber,
            po_quantity:     parseFloat(po.quantity)     || 0,
            po_unit_price:   parseFloat(po.unit_price)   || 0,
            po_total_amount: parseFloat(po.total_amount) || 0,
        }));
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.VendorInvoice.update(item.id, data)
            : matrixSales.entities.VendorInvoice.create(data),
        onSuccess: async (savedInvoice) => {
            if (['approved', 'approved_for_payment'].includes(savedInvoice?.status) && !savedInvoice.gl_posted) {
                try {
                    await postJournalEntry({
                        lines: [
                            { account_code: gl.cogs_general,   account_name: 'Cost of Goods Sold', debit: savedInvoice.subtotal,        credit: 0 },
                            { account_code: gl.vat_input,      account_name: 'VAT Receivable',      debit: savedInvoice.vat_amount || 0, credit: 0 },
                            { account_code: gl.trade_payables, account_name: 'Trade Payables',      debit: 0, credit: savedInvoice.total_amount }
                        ].filter(line => Number(line.debit || line.credit || 0) > 0),
                        referenceType: 'vendor_invoice',
                        referenceId:   savedInvoice.vendor_invoice_number,
                        description:   `Vendor invoice ${savedInvoice.vendor_invoice_number}`,
                        entryDate:     savedInvoice.invoice_date,
                        entryType:     'invoice',
                        orgId:         currentOrg?.id
                    });
                    await matrixSales.entities.VendorInvoice.update(savedInvoice.id, { ...savedInvoice, gl_posted: true });
                } catch (err) {
                    toast({ title: "Saved but GL posting failed", description: err.message, variant: "destructive" });
                }
            }
            queryClient.invalidateQueries({ queryKey: ['vendorInvoices'] });
            toast({ title: "Success", description: `Vendor invoice ${item ? 'updated' : 'created'} successfully` });
            onClose();
        },
        onError: (err) => toast({ title: "Save Failed", description: err.message, variant: "destructive" }),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (linkedGRNs.length === 0) {
            toast({ title: "Validation", description: "Add at least one GRN before saving.", variant: "destructive" });
            return;
        }
        saveMutation.mutate({
            ...formData,
            grn_references:   linkedGRNs,
            grn_number:       linkedGRNs.map(g => g.grn_number).join(', '),
            grn_quantity:     totalGRNQty,
            total_grn_quantity: totalGRNQty,
        });
    };

    // ── Display helpers ───────────────────────────────────────────────────────
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

    const hasPO       = Boolean(formData.po_number);
    const matchLabel  = hasPO ? '3-Way Match (PO ↔ GRN ↔ Invoice)' : '2-Way Match (GRN ↔ Invoice)';

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageCheck className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Vendor Invoice' : 'New Vendor Invoice'}
                        {linkedGRNs.length > 0 && (
                            <Badge variant="secondary">{linkedGRNs.length} GRN{linkedGRNs.length > 1 ? 's' : ''} linked</Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* ── Row 1: Invoice # + Dates ────────────────────────────── */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Vendor Invoice Number *</Label>
                            <Input
                                value={formData.vendor_invoice_number}
                                onChange={(e) => handleChange('vendor_invoice_number', e.target.value)}
                                required
                                placeholder="Vendor's invoice #"
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

                    {/* ── Section: Link GRNs (PRIMARY) ────────────────────────── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-base">
                                Goods Receipt Notes *
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    Select the GRN(s) this invoice covers
                                </span>
                            </h3>
                            {lockedVendorCode && (
                                <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
                                    Vendor: {formData.vendor_name || lockedVendorCode}
                                </span>
                            )}
                        </div>

                        {/* GRN table */}
                        {linkedGRNs.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">GRN #</th>
                                            <th className="px-3 py-2 text-left font-medium">GRN Date</th>
                                            <th className="px-3 py-2 text-left font-medium">Material</th>
                                            <th className="px-3 py-2 text-right font-medium">Received Qty</th>
                                            <th className="px-3 py-2 text-right font-medium">Unit Cost</th>
                                            <th className="px-3 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {linkedGRNs.map(g => (
                                            <tr key={g.grn_number} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 font-mono text-sm font-medium text-emerald-700">{g.grn_number}</td>
                                                <td className="px-3 py-2 text-gray-600">{g.grn_date || '—'}</td>
                                                <td className="px-3 py-2 text-gray-700">{g.material_code || '—'}</td>
                                                <td className="px-3 py-2 text-right font-semibold">{Number(g.grn_quantity).toFixed(3)}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{g.unit_cost ? `LKR ${Number(g.unit_cost).toFixed(2)}` : '—'}</td>
                                                <td className="px-3 py-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveGRN(g.grn_number)}
                                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-emerald-50 font-bold">
                                            <td className="px-3 py-2 text-emerald-800" colSpan={3}>Total GRN Quantity</td>
                                            <td className="px-3 py-2 text-right text-emerald-700">{totalGRNQty.toFixed(3)}</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Add GRN dropdown */}
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <SearchableSelect
                                    label={linkedGRNs.length === 0 ? 'Select GRN *' : 'Add another GRN'}
                                    value={grnToAdd}
                                    onValueChange={setGrnToAdd}
                                    options={availableGRNOptions}
                                    placeholder="Search GRN by number, vendor, material…"
                                    searchPlaceholder="Type to filter GRNs…"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 shrink-0 mb-[1px]"
                                onClick={handleAddGRN}
                                disabled={!grnToAdd}
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add GRN
                            </Button>
                        </div>

                        {availableGRNOptions.length === 0 && linkedGRNs.length === 0 && (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                                No completed GRNs found. Complete a GRN first (status must be posted or completed).
                            </p>
                        )}
                        {availableGRNOptions.length === 0 && linkedGRNs.length > 0 && (
                            <p className="text-xs text-gray-500">No more GRNs available for this vendor.</p>
                        )}
                    </div>

                    {/* ── Section: Optional PO reference ──────────────────────── */}
                    {linkedGRNs.length > 0 && (
                        <div className="space-y-1">
                            <SearchableSelect
                                label="Purchase Order (optional — for 3-way traceability)"
                                value={formData.po_number}
                                onValueChange={handlePOSelect}
                                options={[{ value: '', label: '— No PO (2-way match only) —' }, ...poOptions]}
                                placeholder="Link to a PO for 3-way match…"
                                searchPlaceholder="Search PO#, vendor, material…"
                            />
                            {hasPO && (
                                <div className="grid grid-cols-3 gap-3 bg-blue-50 border border-blue-200 rounded p-3 text-sm mt-2">
                                    <div><span className="text-xs text-blue-600 block">PO Quantity</span><span className="font-semibold text-blue-800">{formData.po_quantity}</span></div>
                                    <div><span className="text-xs text-blue-600 block">PO Unit Price</span><span className="font-semibold text-blue-800">LKR {Number(formData.po_unit_price).toFixed(2)}</span></div>
                                    <div><span className="text-xs text-blue-600 block">PO Total</span><span className="font-semibold text-blue-800">LKR {Number(formData.po_total_amount).toFixed(2)}</span></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Match status banner ──────────────────────────────────── */}
                    {linkedGRNs.length > 0 && (
                        <Alert className={`border-2 ${matchColors[formData.three_way_match_status] || matchColors.pending}`}>
                            <div className="flex items-start gap-3">
                                {matchIcon[formData.three_way_match_status]}
                                <div className="flex-1">
                                    <p className="font-semibold">
                                        {matchLabel}: {String(formData.three_way_match_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                                    </p>
                                    <AlertDescription>
                                        {hasPO && `PO: ${formData.po_quantity} → `}
                                        GRN Total: {totalGRNQty.toFixed(3)} → Invoice: {formData.invoiced_quantity}
                                        {' | '}Qty Variance: {Number(formData.quantity_variance || 0).toFixed(3)}
                                        {' | '}Price Variance: LKR {Number(formData.price_variance || 0).toFixed(2)}
                                    </AlertDescription>
                                </div>
                            </div>
                        </Alert>
                    )}

                    {/* ── Invoice line ─────────────────────────────────────────── */}
                    {linkedGRNs.length > 0 && (
                        <>
                            {/* Vendor + Material (auto-filled, editable) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Vendor Name</Label>
                                    <Input
                                        value={formData.vendor_name}
                                        onChange={(e) => handleChange('vendor_name', e.target.value)}
                                        placeholder="Auto-filled from GRN"
                                    />
                                </div>
                                <div>
                                    <Label>Material / Description</Label>
                                    <Input
                                        value={formData.material_name}
                                        onChange={(e) => handleChange('material_name', e.target.value)}
                                        placeholder="Auto-filled from GRN"
                                    />
                                </div>
                            </div>

                            {/* Quantity matching */}
                            <div className="space-y-2">
                                <h3 className="font-semibold border-b pb-2">Quantity &amp; Price</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
                                        <p className="text-xs text-green-600 font-medium mb-1">Total GRN Received</p>
                                        <p className="text-xl font-bold text-green-800">{totalGRNQty.toFixed(3)}</p>
                                        {linkedGRNs.length > 1 && (
                                            <p className="text-xs text-green-600">from {linkedGRNs.length} GRNs</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label>Invoiced Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={formData.invoiced_quantity}
                                            onChange={(e) => handleChange('invoiced_quantity', parseFloat(e.target.value) || 0)}
                                            required
                                            min="0"
                                            step="0.001"
                                        />
                                        {totalGRNQty > 0 && formData.invoiced_quantity !== totalGRNQty && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs mt-1 h-6 text-gray-500"
                                                onClick={() => handleChange('invoiced_quantity', totalGRNQty)}
                                            >
                                                Use GRN total ({totalGRNQty.toFixed(3)})
                                            </Button>
                                        )}
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
                                        {linkedGRNs[0]?.unit_cost > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">GRN cost: LKR {Number(linkedGRNs[0].unit_cost).toFixed(2)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Additional charges */}
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

                            {/* Totals */}
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-semibold">LKR {Number(formData.subtotal || 0).toFixed(2)}</span>
                                </div>
                                {(Number(formData.freight_cost) + Number(formData.other_charges)) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Freight + Other:</span>
                                        <span className="font-semibold">LKR {(Number(formData.freight_cost) + Number(formData.other_charges)).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">VAT ({taxConfig.vat_standard_rate}%):</span>
                                    <span className="font-semibold">LKR {Number(formData.vat_amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-base font-bold border-t pt-2">
                                    <span>Total Amount:</span>
                                    <span className="text-emerald-700">LKR {Number(formData.total_amount || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Variance notes — required when exceeded */}
                            {formData.three_way_match_status === 'variance_exceeded' && (
                                <div>
                                    <Label>Variance Notes *</Label>
                                    <Textarea
                                        value={formData.variance_notes}
                                        onChange={(e) => handleChange('variance_notes', e.target.value)}
                                        rows={2}
                                        placeholder="Explain why quantity or price does not match the GRN…"
                                        required
                                    />
                                </div>
                            )}

                            {/* Status + currency */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Status</Label>
                                    <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                                    <Label>Currency</Label>
                                    <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LKR">LKR</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="EUR">EUR</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                        </>
                    )}

                    {/* ── Footer ───────────────────────────────────────────────── */}
                    <div className="flex justify-between items-center pt-4 border-t">
                        <ReverseButton
                            item={item}
                            entityName="VendorInvoice"
                            queryKeys={['vendorInvoices']}
                            onSuccess={onClose}
                        />
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={saveMutation.isPending}
                            >
                                {saveMutation.isPending ? 'Saving…' : item ? 'Update Invoice' : 'Create Invoice'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
