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
    const { data: pos = [] } = useQuery({
        queryKey: ['purchaseOrders'],
        queryFn: () => matrixSales.entities.PurchaseOrder.list(),
        initialData: []
    });

    const { data: grns = [] } = useQuery({
        queryKey: ['grns'],
        queryFn: () => matrixSales.entities.GoodsReceiptNote.list('-grn_date'),
        initialData: []
    });

    // ── Multi-GRN state ───────────────────────────────────────────────────────
    // Each entry: { grn_number, grn_date, grn_quantity, material_code }
    const [linkedGRNs, setLinkedGRNs] = useState([]);
    const [grnToAdd, setGrnToAdd] = useState('');

    const totalGRNQty = linkedGRNs.reduce((sum, g) => sum + (parseFloat(g.grn_quantity) || 0), 0);

    // ── Form state ────────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        vendor_invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        po_number: '',
        vendor_code: '',
        vendor_name: '',
        material_code: '',
        material_name: '',
        invoiced_quantity: 0,
        po_quantity: 0,
        total_grn_quantity: 0,
        unit_price: 0,
        po_unit_price: 0,
        subtotal: 0,
        freight_cost: 0,
        other_charges: 0,
        vat_amount: 0,
        total_amount: 0,
        po_total_amount: 0,
        currency: 'LKR',
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
            // Parse stored GRN references
            const refs = item.grn_references;
            if (Array.isArray(refs)) {
                setLinkedGRNs(refs);
            } else if (typeof refs === 'string' && refs) {
                try { setLinkedGRNs(JSON.parse(refs)); } catch { setLinkedGRNs([]); }
            }
        }
    }, [item]);

    // ── Derived: GRNs available to add (same PO, not yet linked, received) ───
    const availableGRNOptions = useMemo(() => {
        if (!formData.po_number) return [];
        const alreadyLinked = new Set(linkedGRNs.map(g => g.grn_number));
        return grns
            .filter(g =>
                g.po_number === formData.po_number &&
                (g.status === 'completed' || g.status === 'posted') &&
                !alreadyLinked.has(g.grn_number)
            )
            .map(g => ({
                value: g.grn_number,
                label: `${g.grn_number} | ${g.grn_date || g.receipt_date || ''} | ${parseFloat(g.quantity_received) || parseFloat(g.accepted_quantity) || 0} ${g.unit_of_measure || ''}`,
            }));
    }, [grns, formData.po_number, linkedGRNs]);

    // ── Recalculate totals & 3-way match whenever inputs change ──────────────
    useEffect(() => {
        const subtotal = (formData.invoiced_quantity || 0) * (formData.unit_price || 0);
        const beforeVat = subtotal + (formData.freight_cost || 0) + (formData.other_charges || 0);
        const vatAmount = beforeVat * (taxConfig.vat_standard_rate / 100);
        const total = beforeVat + vatAmount;

        const qtyVariance = (formData.invoiced_quantity || 0) - totalGRNQty;
        const priceVariance = ((formData.unit_price || 0) - (formData.po_unit_price || 0)) * (formData.invoiced_quantity || 0);

        let matchStatus = 'pending';
        if (formData.po_number && linkedGRNs.length > 0) {
            const qtyVarPct  = Math.abs(qtyVariance   / (totalGRNQty             || 1));
            const priceVarPct = Math.abs(priceVariance / (formData.po_total_amount || 1));
            if (qtyVarPct === 0 && priceVarPct === 0)        matchStatus = 'matched';
            else if (qtyVarPct <= 0.05 && priceVarPct <= 0.05) matchStatus = 'variance_within_tolerance';
            else                                               matchStatus = 'variance_exceeded';
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
        formData.po_number,
        formData.po_total_amount,
        taxConfig.vat_standard_rate,
        totalGRNQty,
    ]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handlePOSelect = (poNumber) => {
        const po = pos.find(p => p.po_number === poNumber);
        if (!po) return;
        setLinkedGRNs([]);
        setGrnToAdd('');
        setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            po_number: poNumber,
            vendor_code: po.vendor_code || '',
            vendor_name: po.vendor_name || '',
            material_code: po.material_code || '',
            material_name: po.material_name || po.description || '',
            po_quantity: parseFloat(po.quantity) || 0,
            po_unit_price: parseFloat(po.unit_price) || 0,
            po_total_amount: parseFloat(po.total_amount) || 0,
            unit_price: parseFloat(po.unit_price) || 0,
            invoiced_quantity: 0,
        }));
    };

    const handleAddGRN = () => {
        if (!grnToAdd) return;
        const grn = grns.find(g => g.grn_number === grnToAdd);
        if (!grn) return;
        const qty = parseFloat(grn.quantity_received) || parseFloat(grn.accepted_quantity) || 0;
        setLinkedGRNs(prev => [
            ...prev,
            {
                grn_number: grn.grn_number,
                grn_date: grn.grn_date || grn.receipt_date || '',
                grn_quantity: qty,
                material_code: grn.material_code || '',
            }
        ]);
        setGrnToAdd('');
        setIsDirty(true);
    };

    const handleRemoveGRN = (grnNumber) => {
        setLinkedGRNs(prev => prev.filter(g => g.grn_number !== grnNumber));
        setIsDirty(true);
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
                        referenceId: savedInvoice.vendor_invoice_number,
                        description: `Vendor invoice ${savedInvoice.vendor_invoice_number}`,
                        entryDate: savedInvoice.invoice_date,
                        entryType: 'invoice',
                        orgId: currentOrg?.id
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
        if (!formData.po_number) {
            toast({ title: "Validation", description: "Please select a Purchase Order.", variant: "destructive" });
            return;
        }
        if (linkedGRNs.length === 0) {
            toast({ title: "Validation", description: "Please add at least one GRN for 3-way matching.", variant: "destructive" });
            return;
        }
        saveMutation.mutate({
            ...formData,
            grn_references: linkedGRNs,
            // Keep grn_number for backward compat (first GRN or comma list)
            grn_number: linkedGRNs.map(g => g.grn_number).join(', '),
            grn_quantity: totalGRNQty,
        });
    };

    // ── Display helpers ───────────────────────────────────────────────────────
    const receivedPOs = pos.filter(p =>
        p.status === 'partially_received' || p.status === 'fully_received' || p.status === 'completed'
    );

    const poOptions = receivedPOs.map(p => ({
        value: p.po_number,
        label: `${p.po_number} | ${p.vendor_name || ''} | ${p.material_name || p.description || ''} | ${p.status}`,
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

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageCheck className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Vendor Invoice' : 'New Vendor Invoice — 3-Way Match'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* ── Row 1: Invoice # + Date + Due Date ─────────────────── */}
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

                    {/* ── Purchase Order ──────────────────────────────────────── */}
                    <SearchableSelect
                        label="Purchase Order *"
                        value={formData.po_number}
                        onValueChange={handlePOSelect}
                        options={poOptions}
                        placeholder="Select a received PO…"
                        searchPlaceholder="Search by PO#, vendor, material…"
                        required
                    />

                    {formData.po_number && (
                        <>
                            {/* ── PO Reference bar ─────────────────────────────── */}
                            <div className="grid grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3 text-sm">
                                <div><span className="text-gray-500 block text-xs">Vendor</span><span className="font-medium">{formData.vendor_name}</span></div>
                                <div><span className="text-gray-500 block text-xs">Material</span><span className="font-medium">{formData.material_name}</span></div>
                                <div><span className="text-gray-500 block text-xs">PO Qty</span><span className="font-semibold text-blue-700">{formData.po_quantity}</span></div>
                                <div><span className="text-gray-500 block text-xs">PO Unit Price</span><span className="font-semibold text-blue-700">LKR {Number(formData.po_unit_price).toFixed(2)}</span></div>
                            </div>

                            {/* ── Linked GRNs table ────────────────────────────── */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-base border-b pb-2 flex items-center gap-2">
                                    Goods Receipt Notes (GRNs)
                                    {linkedGRNs.length > 0 && (
                                        <Badge variant="secondary">{linkedGRNs.length} linked</Badge>
                                    )}
                                </h3>

                                {linkedGRNs.length > 0 && (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-gray-600">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">GRN Number</th>
                                                    <th className="px-3 py-2 text-left font-medium">GRN Date</th>
                                                    <th className="px-3 py-2 text-right font-medium">Received Qty</th>
                                                    <th className="px-3 py-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {linkedGRNs.map(g => (
                                                    <tr key={g.grn_number} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-mono text-sm font-medium text-emerald-700">{g.grn_number}</td>
                                                        <td className="px-3 py-2 text-gray-600">{g.grn_date || '—'}</td>
                                                        <td className="px-3 py-2 text-right font-semibold">{Number(g.grn_quantity).toFixed(3)}</td>
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
                                                    <td className="px-3 py-2" colSpan={2}>Total GRN Quantity</td>
                                                    <td className="px-3 py-2 text-right text-emerald-700">{totalGRNQty.toFixed(3)}</td>
                                                    <td></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Add GRN row */}
                                {availableGRNOptions.length > 0 && (
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                label={linkedGRNs.length === 0 ? "Select GRN *" : "Add another GRN"}
                                                value={grnToAdd}
                                                onValueChange={setGrnToAdd}
                                                options={availableGRNOptions}
                                                placeholder="Select GRN to add…"
                                                searchPlaceholder="Search by GRN#, date, quantity…"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 shrink-0"
                                            onClick={handleAddGRN}
                                            disabled={!grnToAdd}
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add GRN
                                        </Button>
                                    </div>
                                )}

                                {availableGRNOptions.length === 0 && linkedGRNs.length === 0 && (
                                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                                        No completed GRNs found for this PO. Complete a GRN first.
                                    </p>
                                )}
                            </div>

                            {/* ── 3-Way Match Status ────────────────────────────── */}
                            {linkedGRNs.length > 0 && (
                                <Alert className={`border-2 ${matchColors[formData.three_way_match_status] || matchColors.pending}`}>
                                    <div className="flex items-start gap-3">
                                        {matchIcon[formData.three_way_match_status]}
                                        <div className="flex-1">
                                            <p className="font-semibold">
                                                3-Way Match: {formData.three_way_match_status.replace(/_/g, ' ').toUpperCase()}
                                            </p>
                                            <AlertDescription>
                                                PO: {formData.po_quantity} → GRNs: {totalGRNQty.toFixed(3)} → Invoice: {formData.invoiced_quantity}
                                                {' | '}Qty Variance: {Number(formData.quantity_variance).toFixed(3)}
                                                {' | '}Price Variance: LKR {Number(formData.price_variance).toFixed(2)}
                                            </AlertDescription>
                                        </div>
                                    </div>
                                </Alert>
                            )}

                            {/* ── Quantity Matching ─────────────────────────────── */}
                            <div className="space-y-2">
                                <h3 className="font-semibold border-b pb-2">Quantity Matching</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-center">
                                        <p className="text-xs text-blue-600 font-medium mb-1">PO Quantity</p>
                                        <p className="text-xl font-bold text-blue-800">{formData.po_quantity}</p>
                                    </div>
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
                                            placeholder={totalGRNQty.toFixed(3)}
                                        />
                                        {totalGRNQty > 0 && (
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
                                </div>
                            </div>

                            {/* ── Price Matching ────────────────────────────────── */}
                            <div className="space-y-2">
                                <h3 className="font-semibold border-b pb-2">Price Matching</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                        <p className="text-xs text-blue-600 font-medium mb-1">PO Unit Price</p>
                                        <p className="text-lg font-bold text-blue-800">LKR {Number(formData.po_unit_price).toFixed(2)}</p>
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

                            {/* ── Additional Charges ────────────────────────────── */}
                            <div className="space-y-2">
                                <h3 className="font-semibold border-b pb-2">Additional Charges</h3>
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

                            {/* ── Totals ────────────────────────────────────────── */}
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-semibold">LKR {Number(formData.subtotal).toFixed(2)}</span>
                                </div>
                                {(formData.freight_cost > 0 || formData.other_charges > 0) && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Freight + Other:</span>
                                        <span className="font-semibold">LKR {(Number(formData.freight_cost) + Number(formData.other_charges)).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">VAT ({taxConfig.vat_standard_rate}%):</span>
                                    <span className="font-semibold">LKR {Number(formData.vat_amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-base font-bold border-t pt-2">
                                    <span>Total Amount:</span>
                                    <span className="text-emerald-700">LKR {Number(formData.total_amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>PO Total:</span>
                                    <span>LKR {Number(formData.po_total_amount).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* ── Variance Notes (required when exceeded) ───────── */}
                            {formData.three_way_match_status === 'variance_exceeded' && (
                                <div>
                                    <Label>Variance Notes *</Label>
                                    <Textarea
                                        value={formData.variance_notes}
                                        onChange={(e) => handleChange('variance_notes', e.target.value)}
                                        rows={2}
                                        placeholder="Explain why quantity or price does not match…"
                                        required
                                    />
                                </div>
                            )}

                            {/* ── Status ────────────────────────────────────────── */}
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
