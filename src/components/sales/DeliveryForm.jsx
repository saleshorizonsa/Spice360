import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Package, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useOrganization } from "../utils/OrganizationContext";
import { processGoodsIssue } from "../utils/inventoryIntegration";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createNotification } from "../utils/notificationService";
import { logAuditTrail } from "../utils/auditTrail";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";
import { useGLAccounts } from "../../hooks/useGLAccounts";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DocumentFlow from "../shared/DocumentFlow";
import JournalEntriesPanel from "../shared/JournalEntriesPanel";
import { buildDeliveryLines, clampDeliverQty, totalDelivering, validateDeliveryLines } from "@/lib/deliveryLines";

export default function DeliveryForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const { currentOrganization: currentOrg } = useOrganization();
    const gl = useGLAccounts();

    const [currentUser, setCurrentUser] = useState(null);
    useEffect(() => {
        matrixSales.auth.me().then(setCurrentUser).catch(() => {});
    }, []);

    const { data: salesOrders = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => matrixSales.entities.SalesOrder.list('-order_date'),
        initialData: []
    });

    // Every SO line and every prior delivery — needed to pick all lines and to work
    // out what is still outstanding per product.
    const { data: allSoLines = [] } = useQuery({
        queryKey: ['salesOrderLines'],
        queryFn: () => matrixSales.entities.SalesOrderLine.list(),
        initialData: []
    });
    const { data: allDeliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => matrixSales.entities.Delivery.list('-delivery_date'),
        initialData: []
    });

    // Editable delivery lines (one per SO line). The product is locked; only the
    // "delivering now" quantity is editable, defaulting to what is outstanding.
    const [lines, setLines] = useState([]);

    const [formData, setFormData] = useState({
        delivery_number: '',
        sales_order_number: '',
        customer_name: '',
        customer_code: '',
        delivery_date: new Date().toISOString().split('T')[0],
        delivery_address: '',
        receiver_name: '',
        receiver_signature: '',
        vehicle_number: '',
        driver_name: '',
        shipping_location: '',
        status: 'pending',
        pgi_done: false,
        pgi_date: '',
        pgi_by: '',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
            let existing = item.delivery_lines;
            if (typeof existing === 'string') { try { existing = JSON.parse(existing); } catch { existing = null; } }
            if (Array.isArray(existing) && existing.length) {
                setLines(existing.map((l) => ({
                    ...l,
                    quantity_remaining: l.quantity_remaining ?? l.quantity_delivering,
                    fullyDelivered: false,
                })));
            } else if (item.product_code) {
                // A legacy single-product delivery, shown read-only as one line.
                setLines([{
                    line_number: 1,
                    product_code: item.product_code,
                    product_name: item.product_name,
                    unit_of_measure: item.unit_of_measure || '',
                    unit_price: 0,
                    quantity_ordered: item.quantity_ordered || item.quantity_delivered || 0,
                    quantity_already_delivered: 0,
                    quantity_remaining: item.quantity_delivered || 0,
                    quantity_delivering: item.quantity_delivered || 0,
                    fullyDelivered: false,
                }]);
            }
        }
    }, [item]);

    const handleSalesOrderSelect = (orderNumber) => {
        const so = salesOrders.find(o => o.order_number === orderNumber);
        if (!so) return;

        // All lines of this SO; fall back to the header product if the SO has no
        // line records (older single-line orders).
        let soLines = allSoLines.filter(l => l.order_number === orderNumber);
        if (soLines.length === 0 && so.product_code) {
            soLines = [{
                line_number: 1,
                product_code: so.product_code,
                product_name: so.product_name,
                quantity: so.quantity,
                unit_of_measure: so.unit_of_measure,
                unit_price: so.unit_price,
            }];
        }

        const priorDeliveries = allDeliveries.filter(d => d.sales_order_number === orderNumber && d.id !== item?.id);
        const built = buildDeliveryLines({ soLines, priorDeliveries });

        setLines(built);
        setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            sales_order_number: orderNumber,
            customer_name: so.customer_name,
            customer_code: so.customer_code || '',
            delivery_address: so.delivery_address || '',
            notes: `Delivery for Sales Order: ${orderNumber}`
        }));
    };

    const handleLineQtyChange = (productCode, value) => {
        if (!isDirty) setIsDirty(true);
        setLines(prev => prev.map(l =>
            l.product_code === productCode
                ? { ...l, quantity_delivering: clampDeliverQty(value, l.quantity_remaining) }
                : l
        ));
    };

    const totalQty = useMemo(() => totalDelivering(lines), [lines]);

    // A delivery record snapshot for stock/COGS — the header plus a per-line view.
    const buildDeliveryPayload = () => ({
        ...formData,
        delivery_lines: lines
            .filter(l => Number(l.quantity_delivering) > 0)
            .map(l => ({
                product_code: l.product_code,
                product_name: l.product_name,
                unit_of_measure: l.unit_of_measure,
                unit_price: l.unit_price,
                quantity_ordered: l.quantity_ordered,
                quantity_remaining: l.quantity_remaining,
                quantity_delivered: l.quantity_delivering,
            })),
        // Header mirrors for lists/back-compat: first shipped line + total quantity.
        product_code: lines.find(l => Number(l.quantity_delivering) > 0)?.product_code || '',
        product_name: lines.find(l => Number(l.quantity_delivering) > 0)?.product_name || '',
        quantity_delivered: totalDelivering(lines),
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            let data = buildDeliveryPayload();
            const beforeData = item ? { ...item } : null;
            let delivery;
            if (item) {
                delivery = await matrixSales.entities.Delivery.update(item.id, data);
                await logAuditTrail({ entityType: 'delivery', entityId: item.id, documentNumber: data.delivery_number, actionType: 'update', beforeData, afterData: data, user: currentUser, severity: 'info', organizationId: currentOrg?.id });
            } else {
                // Claim the delivery number here, not on form open — an abandoned
                // form must not consume a number.
                data = {
                    ...data,
                    delivery_number: data.delivery_number?.trim() || await getNextDocumentNumber('delivery'),
                };
                delivery = await matrixSales.entities.Delivery.create(data);
                await logAuditTrail({ entityType: 'delivery', entityId: delivery.id, documentNumber: data.delivery_number, actionType: 'create', afterData: data, user: currentUser, severity: 'info', relatedDocumentType: 'sales_order', relatedDocumentId: data.sales_order_number, organizationId: currentOrg?.id });
            }
            return delivery;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({ title: "Success", description: item ? "Delivery updated" : "Delivery created" });
            onClose();
        },
        onError: (error) => toast({ title: "Error", description: `Failed to save delivery: ${error.message || 'Unknown error'}`, variant: "destructive" }),
    });

    const pgiMutation = useMutation({
        mutationFn: async () => {
            const shipped = lines.filter(l => Number(l.quantity_delivering) > 0);

            // Check the accounting period is OPEN before moving any stock. PGI
            // issues stock and then posts COGS; if the period were closed the stock
            // would move while the GL entry failed, leaving inventory and the ledger
            // out of step. Fail here so nothing is touched.
            if (currentOrg?.id) {
                await assertPeriodAllowed(formData.delivery_date, currentOrg.id, 'inventory');
            }

            // Issue stock for every shipped line, and build the COGS journal as one
            // balanced entry: Dr COGS / Cr Inventory per product.
            const glLines = [];
            const issueCostByProduct = {};   // captured so a later reversal restores stock at cost
            for (const l of shipped) {
                await processGoodsIssue({
                    delivery_number: formData.delivery_number,
                    delivery_date: formData.delivery_date,
                    product_code: l.product_code,
                    product_name: l.product_name,
                    quantity_delivered: l.quantity_delivering,
                    unit_of_measure: l.unit_of_measure,
                    shipping_location: formData.shipping_location,
                }, currentUser, currentOrg?.id);

                const stock = await matrixSales.entities.StockLevel.filter({ material_code: l.product_code });
                const unitCost = parseFloat(stock?.[0]?.unit_cost || 0);
                issueCostByProduct[l.product_code] = unitCost;
                const cogs = unitCost * Number(l.quantity_delivering);
                if (cogs > 0) {
                    glLines.push({ account_code: gl.cogs_general, account_name: "Cost of Goods Sold", debit: cogs, credit: 0, description: `${l.product_name} × ${l.quantity_delivering}` });
                    glLines.push({ account_code: gl.inventory, account_name: "Inventory", debit: 0, credit: cogs, description: `Goods issue ${formData.delivery_number}: ${l.product_code}` });
                }
            }

            const posted = buildDeliveryPayload();
            // Stamp each stored line with the cost it was issued at, so reverseGoodsIssue
            // can restore stock at exactly that cost and stay in step with the GL.
            posted.delivery_lines = (posted.delivery_lines || []).map(l => ({
                ...l,
                cogs_unit_cost: issueCostByProduct[l.product_code] ?? l.cogs_unit_cost ?? 0,
            }));
            const updatedDelivery = await matrixSales.entities.Delivery.update(item.id, {
                ...posted,
                pgi_done: true,
                pgi_date: new Date().toISOString().split('T')[0],
                pgi_by: currentUser?.email,
                status: 'pgi_completed'
            });

            // COGS journal (one entry for the whole delivery). Non-fatal.
            if (currentOrg?.id && glLines.length) {
                try {
                    await postJournalEntry({
                        lines: glLines,
                        referenceType: 'delivery',
                        referenceId: formData.delivery_number,
                        description: `Goods issue: ${formData.delivery_number} – ${formData.customer_name}`,
                        entryDate: formData.delivery_date,
                        entryType: 'goods_issue',
                        createdBy: currentUser?.email || '',
                        orgId: currentOrg.id,
                        area: "inventory"
                    });
                } catch (glErr) {
                    toast({ title: "PGI posted, GL failed", description: `Stock issued but the COGS entry failed: ${glErr.message}`, variant: "destructive", duration: 15000 });
                }
            }

            // Roll each shipped line up to its SO line's delivered quantity.
            try {
                const sos = await matrixSales.entities.SalesOrder.filter({ order_number: formData.sales_order_number });
                if (sos?.length) {
                    const so = sos[0];
                    const newDelivered = (parseFloat(so.quantity_delivered) || 0) + totalDelivering(shipped);
                    const ordered = parseFloat(so.quantity) || 0;
                    const status = newDelivered >= ordered && ordered > 0 ? 'delivered'
                        : newDelivered > 0 ? 'partially_delivered' : so.status;
                    await matrixSales.entities.SalesOrder.update(so.id, { quantity_delivered: newDelivered, status });
                }
            } catch (_) { /* non-fatal */ }

            await logAuditTrail({ entityType: 'delivery', entityId: item.id, documentNumber: formData.delivery_number, actionType: 'complete_pgi', afterData: { pgi_done: true, status: 'pgi_completed', pgi_by: currentUser?.email }, user: currentUser, severity: 'info', organizationId: currentOrg?.id });

            // Auto-create an Invoice draft covering every shipped line. Non-fatal.
            try {
                const invoiceNumber = await getNextDocumentNumber('invoice');
                const today = new Date().toISOString().slice(0, 10);
                const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                const sos = await matrixSales.entities.SalesOrder.filter({ order_number: formData.sales_order_number });
                const so = sos?.[0];
                const invoiceLines = shipped.map(l => ({
                    product_code: l.product_code,
                    product_name: l.product_name,
                    quantity: l.quantity_delivering,
                    unit_price: l.unit_price,
                    line_total: l.unit_price * Number(l.quantity_delivering),
                }));
                const subtotal = invoiceLines.reduce((s, l) => s + l.line_total, 0);
                await matrixSales.entities.Invoice.create({
                    invoice_number: invoiceNumber,
                    invoice_date: today,
                    due_date: dueDate,
                    sales_order_number: formData.sales_order_number,
                    delivery_number: formData.delivery_number,
                    delivery_references: [{ delivery_number: formData.delivery_number, delivery_date: formData.delivery_date, delivered_quantity: totalDelivering(shipped) }],
                    invoice_lines: invoiceLines,
                    customer_name: formData.customer_name,
                    customer_code: formData.customer_code || so?.customer_code || '',
                    product_code: invoiceLines[0]?.product_code || '',
                    product_name: invoiceLines[0]?.product_name || '',
                    quantity: totalDelivering(shipped),
                    unit_price: invoiceLines[0]?.unit_price || 0,
                    subtotal,
                    tax_type: 'vat',
                    tax_percent: 0,
                    tax_amount: 0,
                    total_amount: subtotal,
                    payment_terms: so?.payment_terms || 'net_30',
                    payment_status: 'unpaid',
                    status: 'draft',
                    notes: `Auto-created from Delivery ${formData.delivery_number}`,
                });
                toast({ title: "Invoice Draft Created", description: `${invoiceNumber} created in Sales` });
                if (currentUser?.email) createNotification({ userEmail: currentUser.email, notificationType: 'invoice_auto_created', priority: 'high', title: 'Invoice Draft Auto-Created', message: `${invoiceNumber} was created from Delivery ${formData.delivery_number}`, relatedEntity: 'Invoice', relatedDocumentNumber: invoiceNumber, actionUrl: '/Sales' }).catch(() => {});
            } catch (_) { /* non-fatal */ }

            return updatedDelivery;
        },
        onSuccess: () => {
            ['deliveries', 'products', 'stockLevels', 'movements', 'sales', 'auditTrails', 'journalEntries', 'invoices'].forEach(k =>
                queryClient.invalidateQueries({ queryKey: [k] })
            );
            toast({ title: "Success", description: "PGI posted successfully. Stock updated." });
            onClose();
        },
        onError: (error) => toast({ title: "Error", description: `Failed to complete PGI: ${error.message || 'Unknown error'}.`, variant: "destructive" }),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (lines.length === 0) {
            toast({ title: "Select a Sales Order", description: "Choose a sales order to load its lines.", variant: "destructive" });
            return;
        }
        saveMutation.mutate();
    };

    const handlePGI = () => {
        if (!item || !item.id) {
            toast({ title: "Save First", description: "Save the delivery before posting goods issue.", variant: "destructive" });
            return;
        }
        if (formData.pgi_done) {
            toast({ title: "Already Posted", description: "PGI has already been completed for this delivery.", variant: "destructive" });
            return;
        }
        const { ok, errors } = validateDeliveryLines(lines);
        if (!ok) {
            toast({ title: "Invalid Data", description: errors[0], variant: "destructive" });
            return;
        }
        if (window.confirm(`Post goods issue for ${totalQty} unit(s) across ${lines.filter(l => Number(l.quantity_delivering) > 0).length} line(s)? This deducts stock from inventory.`)) {
            pgiMutation.mutate();
        }
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const confirmedOrders = salesOrders.filter(o =>
        ['confirmed', 'in_production', 'shipped', 'partially_delivered'].includes(o.status)
    );
    const salesOrderOptions = useMemo(() =>
        confirmedOrders.map(o => ({ value: o.order_number, label: `${o.order_number} - ${o.customer_name}` })),
        [confirmedOrders]
    );

    const readOnly = formData.pgi_done;

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit Delivery' : 'New Delivery'}
                        {formData.sales_order_number && <Badge variant="outline" className="ml-2">SO: {formData.sales_order_number}</Badge>}
                        {formData.pgi_done && <Badge className="ml-2 bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />PGI Done</Badge>}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {!item && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <SearchableSelect
                                label="Select Sales Order *"
                                value={formData.sales_order_number}
                                onChange={handleSalesOrderSelect}
                                options={salesOrderOptions}
                                mode="client"
                                placeholder="Select a sales order..."
                                searchPlaceholder="Search sales orders..."
                            />
                            {formData.sales_order_number && (
                                <p className="text-sm text-emerald-700 mt-2 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4" /> All order lines loaded below
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Delivery Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Delivery Number</Label>
                                <Input value={formData.delivery_number} onChange={(e) => handleChange('delivery_number', e.target.value)} disabled={readOnly} placeholder={item ? '' : 'Auto-generated on save'} />
                            </div>
                            <div>
                                <Label>Delivery Date *</Label>
                                <Input type="date" value={formData.delivery_date} onChange={(e) => handleChange('delivery_date', e.target.value)} required disabled={readOnly} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Customer Name *</Label>
                                <Input value={formData.customer_name} onChange={(e) => handleChange('customer_name', e.target.value)} required disabled={!!formData.sales_order_number || readOnly} />
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={(val) => handleChange('status', val)} disabled={readOnly}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="in_transit">In Transit</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Lines — product locked, only the delivering quantity editable. */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-lg border-b pb-2">Order Lines</h3>
                        {lines.length === 0 ? (
                            <p className="text-sm text-gray-500">Select a sales order to load its lines.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">Product</th>
                                            <th className="px-3 py-2 text-right font-medium">Ordered</th>
                                            <th className="px-3 py-2 text-right font-medium">Already Delivered</th>
                                            <th className="px-3 py-2 text-right font-medium">Remaining</th>
                                            <th className="px-3 py-2 text-right font-medium">Delivering Now</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {lines.map((l) => (
                                            <tr key={l.product_code} className={l.fullyDelivered ? "bg-gray-50 text-gray-400" : ""}>
                                                <td className="px-3 py-2">
                                                    <span className="font-mono text-xs">{l.product_code}</span>
                                                    <div className="text-xs text-gray-500">{l.product_name}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right">{l.quantity_ordered} {l.unit_of_measure}</td>
                                                <td className="px-3 py-2 text-right text-gray-500">{l.quantity_already_delivered}</td>
                                                <td className="px-3 py-2 text-right font-medium">{l.quantity_remaining}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max={l.quantity_remaining}
                                                        step="0.001"
                                                        value={l.quantity_delivering}
                                                        onChange={(e) => handleLineQtyChange(l.product_code, e.target.value)}
                                                        disabled={readOnly || l.fullyDelivered}
                                                        className="w-28 text-right ml-auto"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-emerald-50 font-bold">
                                            <td className="px-3 py-2 text-emerald-800" colSpan={4}>Total Delivering</td>
                                            <td className="px-3 py-2 text-right text-emerald-700">{totalQty}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="text-xs text-gray-500">
                            Every line is pre-filled with the quantity still outstanding. Lower any line for a partial
                            delivery — you cannot deliver more than remaining.
                        </p>
                        {readOnly && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    PGI posted on {formData.pgi_date} by {formData.pgi_by || 'Unknown'} — stock deducted.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Delivery Details</h3>
                        <div>
                            <Label>Delivery Address</Label>
                            <Textarea value={formData.delivery_address} onChange={(e) => handleChange('delivery_address', e.target.value)} rows={2} disabled={readOnly} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Receiver Name</Label>
                                <Input value={formData.receiver_name} onChange={(e) => handleChange('receiver_name', e.target.value)} disabled={readOnly} />
                            </div>
                            <div>
                                <Label>Vehicle Number</Label>
                                <Input value={formData.vehicle_number} onChange={(e) => handleChange('vehicle_number', e.target.value)} disabled={readOnly} />
                            </div>
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Textarea value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} disabled={readOnly} />
                        </div>
                    </div>

                    {item && (
                        <div className="border-t pt-4">
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                                    Document Flow
                                </summary>
                                <DocumentFlow seedType="Delivery" seedNumber={item.delivery_number} />
                            </details>
                        </div>
                    )}

                    {item && (
                        <div className="border-t pt-4">
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                                    Journal Entries
                                </summary>
                                <JournalEntriesPanel documentNumber={item.delivery_number} />
                            </details>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div>
                            {item && !formData.pgi_done && (
                                <Button type="button" onClick={handlePGI} className="bg-blue-600 hover:bg-blue-700" disabled={pgiMutation.isPending || saveMutation.isPending}>
                                    <Package className="w-4 h-4 mr-2" />
                                    {pgiMutation.isPending ? 'Processing...' : 'Post Goods Issue (PGI)'}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={guardedClose(onClose)} disabled={saveMutation.isPending || pgiMutation.isPending}>
                                {readOnly ? 'Close' : 'Cancel'}
                            </Button>
                            {!readOnly && (
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending || pgiMutation.isPending}>
                                    {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' Delivery'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
