import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ShoppingCart, Receipt, TrendingUp, FlaskConical } from "lucide-react";
import DataTable from "@/components/erp/DataTable";
import PurchaseRequisitionForm from "@/components/purchasing/PurchaseRequisitionForm";
import RFQForm from "@/components/purchasing/RFQForm";
import PurchaseOrderForm from "@/components/purchasing/PurchaseOrderForm";
import GRNForm from "@/components/purchasing/GRNForm";
import VendorInvoiceForm from "@/components/purchasing/VendorInvoiceForm";
import LotTraceabilityDialog from "@/components/purchasing/LotTraceabilityDialog";
import DocumentPrintPreview from "@/components/shared/DocumentPrintPreview";
import { useToast } from "@/components/ui/use-toast";
import { Clock, CheckCircle } from "lucide-react";
import { createNotification } from "@/components/utils/notificationService";
import { useLanguage } from "@/components/utils/languageContext";

export default function Purchasing() {
    const [activeTab, setActiveTab] = useState("requisitions");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showLotTraceability, setShowLotTraceability] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState(null);
    const { t } = useLanguage();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: requisitions = [] } = useQuery({
        queryKey: ['requisitions'],
        queryFn: () => matrixSales.entities.PurchaseRequisition.list('-pr_date'),
        initialData: []
    });

    const { data: rfqs = [] } = useQuery({
        queryKey: ['rfqs'],
        queryFn: () => matrixSales.entities.RFQ.list('-rfq_date'),
        initialData: []
    });

    const { data: pos = [] } = useQuery({
        queryKey: ['purchaseOrders'],
        queryFn: () => matrixSales.entities.PurchaseOrder.list('-po_date'),
        initialData: []
    });

    const { data: grns = [] } = useQuery({
        queryKey: ['grns'],
        queryFn: () => matrixSales.entities.GoodsReceiptNote.list('-grn_date'),
        initialData: []
    });

    const { data: vendorInvoices = [] } = useQuery({
        queryKey: ['vendorInvoices'],
        queryFn: () => matrixSales.entities.VendorInvoice.list('-invoice_date'),
        initialData: []
    });

    // KPIs
    const pendingPRs = requisitions.filter(r => r.status === 'submitted').length;
    const activePOs = pos.filter(p => ['approved', 'sent_to_vendor', 'acknowledged'].includes(p.status)).length;
    const totalSpend = pos.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const pendingMatches = vendorInvoices.filter(v => v.three_way_match_status === 'pending' || v.three_way_match_status === 'variance_exceeded').length;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully'),
                variant: "default"
            });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            // PR Status
            draft: "bg-gray-100 text-gray-800",
            submitted: "bg-blue-100 text-blue-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            converted_to_rfq: "bg-purple-100 text-purple-800",
            // RFQ Status
            sent: "bg-blue-100 text-blue-800",
            closed: "bg-gray-100 text-gray-800",
            awarded: "bg-green-100 text-green-800",
            // PO Status
            pending_approval: "bg-yellow-100 text-yellow-800",
            sent_to_vendor: "bg-blue-100 text-blue-800",
            acknowledged: "bg-indigo-100 text-indigo-800",
            partially_received: "bg-amber-100 text-amber-800",
            fully_received: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
            // GRN Status
            posted: "bg-green-100 text-green-800",
            // Invoice Status
            pending_match: "bg-yellow-100 text-yellow-800",
            matched: "bg-green-100 text-green-800",
            on_hold: "bg-red-100 text-red-800",
            approved_for_payment: "bg-blue-100 text-blue-800",
            paid: "bg-emerald-100 text-emerald-800",
            // Priority
            low: "bg-gray-100 text-gray-800",
            medium: "bg-blue-100 text-blue-800",
            high: "bg-orange-100 text-orange-800",
            urgent: "bg-red-100 text-red-800",
            // PO Types
            standard: "bg-blue-100 text-blue-800",
            blanket: "bg-purple-100 text-purple-800",
            subcontracting: "bg-indigo-100 text-indigo-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const prColumns = [
        { header: "PR #", key: "pr_number" },
        { header: t('date'), key: "pr_date" },
        { header: "Requested By", key: "requested_by" },
        { header: t('material'), key: "material_name" },
        { header: "Qty", key: "quantity_required" },
        { header: "Required Date", key: "required_date" },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const rfqColumns = [
        { header: "RFQ #", key: "rfq_number" },
        { header: t('date'), key: "rfq_date" },
        { header: t('material'), key: "material_name" },
        { header: "Qty", key: "quantity" },
        { header: "Closing Date", key: "closing_date" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const purchaseOrderColumns = [
        { header: "PO Number", key: "po_number" },
        { header: t('vendor'), key: "vendor_name" },
        { header: t('material'), key: "material_name" },
        { header: t('quantity'), key: "quantity" },
        {
            header: `${t('total')} ${t('amount')}`,
            key: "total_amount",
            render: (val) => `LKR ${val?.toLocaleString() || 0}`
        },
        { header: "PO Date", key: "po_date" },
        { header: t('status'), key: "status", isBadge: true },
        {
            header: "Approval",
            key: "approval_status",
            render: (val, row) => {
                if (row.status === 'pending_approval') {
                    return (
                        <div className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs">{t('pending')}</span>
                        </div>
                    );
                }
                if (row.status === 'approved') {
                    return (
                        <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs">{t('approved')}</span>
                        </div>
                    );
                }
                return null;
            }
        }
    ];

    const grnColumns = [
        { header: "GRN #", key: "grn_number" },
        { header: t('date'), key: "grn_date" },
        { header: "PO #", key: "po_number" },
        { header: t('vendor'), key: "vendor_name" },
        { header: t('material'), key: "material_name" },
        { header: "Received", key: "received_quantity" },
        { header: "Accepted", key: "accepted_quantity" },
        { header: "Rejected", key: "rejected_quantity" },
        { header: "Inspection", key: "inspection_result", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const invoiceColumns = [
        { header: "Invoice #", key: "vendor_invoice_number" },
        { header: t('date'), key: "invoice_date" },
        { header: "PO #", key: "po_number" },
        { header: "GRN #", key: "grn_number" },
        { header: t('vendor'), key: "vendor_name" },
        { header: `${t('amount')} (LKR)`, key: "total_amount", render: (val) => `${val?.toLocaleString() || 0}` },
        { header: t('threeWayMatch'), key: "three_way_match_status", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        // Prevent editing if pending approval or approved
        if (item.status === 'pending_approval') {
            toast({
                title: "Cannot Edit",
                description: "This document is pending approval and cannot be edited.",
                variant: "destructive"
            });
            return;
        }
        if (item.status === 'approved' && type === 'pos') { // Using 'pos' to match the activeTab value for Purchase Orders
            toast({
                title: "Cannot Edit",
                description: "This purchase order has been approved and cannot be edited.",
                variant: "destructive"
            });
            return;
        }
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        // Prevent deleting if approved or received
        if (item.status === 'approved' || item.status === 'partially_received' || item.status === 'fully_received') {
            toast({
                title: "Cannot Delete",
                description: "This document has been approved or partially received and cannot be deleted.",
                variant: "destructive"
            });
            return;
        }

        if (confirm(t('areYouSure'))) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    const handlePrint = (item, type) => {
        const typeLabels = {
            PR: 'Purchase Requisition',
            RFQ: 'Request for Quotation',
            PO: 'Purchase Order',
            GRN: 'Goods Receipt Note',
            'Vendor Invoice': 'Vendor Invoice',
        };
        setSelectedDocument({ ...item, type: typeLabels[type] || type });
        setShowPrintPreview(true);
    };

    // Check for overdue POs and send notifications
    useEffect(() => {
        if (!currentUser || !pos.length) return;

        const checkOverduePOs = async () => {
            const today = new Date();
            const overduePOs = pos.filter(po =>
                po.status === 'approved' &&
                new Date(po.delivery_date) < today &&
                po.status !== 'fully_received'
            );

            for (const po of overduePOs) {
                try {
                    await createNotification({
                        userEmail: po.created_by || currentUser.email,
                        notificationType: 'delivery_overdue',
                        priority: 'high',
                        title: 'Delivery Overdue',
                        message: `PO ${po.po_number} delivery was due on ${po.delivery_date}. Please follow up with the vendor.`,
                        relatedEntity: 'purchase_order',
                        relatedEntityId: po.id,
                        relatedDocumentNumber: po.po_number,
                        actionUrl: '/Purchasing'
                    });
                } catch (error) {
                    console.error('Error creating overdue notification for PO', po.po_number, ':', error);
                }
            }
        };

        checkOverduePOs();
    }, [pos, currentUser]);


    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('procurement')}</h1>
                    <p className="text-gray-600 mt-1">Purchase Requisition → RFQ → PO → GRN → Invoice (3-Way Match)</p>
                </div>
            </div>

            {/* KPI Cards */}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="requisitions">{t('requisitions')}</TabsTrigger>
                    <TabsTrigger value="rfqs">{t('rfqs')}</TabsTrigger>
                    <TabsTrigger value="pos">{t('pos')}</TabsTrigger>
                    <TabsTrigger value="grns">{t('grns')}</TabsTrigger>
                    <TabsTrigger value="invoices">{t('vendorInvoices')}</TabsTrigger>
                    <TabsTrigger value="prices">Price Register</TabsTrigger>
                </TabsList>

                <TabsContent value="requisitions">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('purchaseRequisition')}</CardTitle>
                            <Button
                                onClick={() => handleCreate('requisitions')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('requisition')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={requisitions}
                                columns={prColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'requisitions')}
                                onDelete={(item) => handleDelete(item, 'PurchaseRequisition')}
                                onPrint={(item) => handlePrint(item, 'PR')}
                                exportFileName="purchase-requisitions"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rfqs">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('rfq')}</CardTitle>
                            <Button
                                onClick={() => handleCreate('rfqs')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} RFQ
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={rfqs}
                                columns={rfqColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'rfqs')}
                                onDelete={(item) => handleDelete(item, 'RFQ')}
                                onPrint={(item) => handlePrint(item, 'RFQ')}
                                exportFileName="rfqs"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pos">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('purchaseOrder')}</CardTitle>
                            <Button
                                onClick={() => handleCreate('pos')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('purchaseOrder')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={pos}
                                columns={purchaseOrderColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'pos')}
                                onDelete={(item) => handleDelete(item, 'PurchaseOrder')}
                                onPrint={(item) => handlePrint(item, 'PO')}
                                exportFileName="purchase-orders"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="grns">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('goodsReceiptNote')}</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowLotTraceability(true)}
                                >
                                    <FlaskConical className="w-4 h-4 mr-2 text-teal-600" />
                                    Lot Traceability
                                </Button>
                                <Button
                                    onClick={() => handleCreate('grns')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('new')} GRN
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={grns}
                                columns={grnColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'grns')}
                                onDelete={(item) => handleDelete(item, 'GoodsReceiptNote')}
                                onPrint={(item) => handlePrint(item, 'GRN')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="invoices">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('vendorInvoice')} ({t('threeWayMatch')})</CardTitle>
                            <Button
                                onClick={() => handleCreate('invoices')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('vendorInvoice')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={vendorInvoices}
                                columns={invoiceColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'invoices')}
                                onDelete={(item) => handleDelete(item, 'VendorInvoice')}
                                onPrint={(item) => handlePrint(item, 'Vendor Invoice')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="prices">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                Supplier Price Register
                            </CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                                Last agreed PO price vs last GRN received price per material/vendor. Variance flags price drift.
                            </p>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                // Build register: keyed by "vendor|material"
                                const register = {};
                                for (const po of pos) {
                                    if (!po.vendor_name || !po.material_name) continue;
                                    const key = `${po.vendor_name}||${po.material_name}`;
                                    const existing = register[key];
                                    if (!existing || (po.po_date || "") > (existing.lastPoDate || "")) {
                                        register[key] = {
                                            ...(existing || {}),
                                            vendor:       po.vendor_name,
                                            material:     po.material_name,
                                            lastPoDate:   po.po_date,
                                            agreedPrice:  parseFloat(po.unit_price) || 0,
                                        };
                                    }
                                }
                                for (const grn of grns) {
                                    if (!grn.vendor_name || !grn.material_name) continue;
                                    const key = `${grn.vendor_name}||${grn.material_name}`;
                                    const existing = register[key] || { vendor: grn.vendor_name, material: grn.material_name };
                                    if (!existing.lastGrnDate || (grn.grn_date || "") > (existing.lastGrnDate || "")) {
                                        register[key] = {
                                            ...existing,
                                            lastGrnDate:    grn.grn_date,
                                            receivedPrice:  parseFloat(grn.unit_price) || 0,
                                        };
                                    }
                                }

                                const rows = Object.values(register).sort((a, b) =>
                                    (a.vendor + a.material).localeCompare(b.vendor + b.material)
                                );

                                if (rows.length === 0) return (
                                    <p className="text-sm text-slate-400 text-center py-8">No PO or GRN data available yet.</p>
                                );

                                return (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="p-3 text-left">Vendor</th>
                                                <th className="p-3 text-left">Material</th>
                                                <th className="p-3 text-right">Agreed (PO)</th>
                                                <th className="p-3 text-center">PO Date</th>
                                                <th className="p-3 text-right">Received (GRN)</th>
                                                <th className="p-3 text-center">GRN Date</th>
                                                <th className="p-3 text-right">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, i) => {
                                                const agreed   = r.agreedPrice  || 0;
                                                const received = r.receivedPrice || 0;
                                                const variance = agreed > 0 && received > 0 ? ((received - agreed) / agreed * 100) : null;
                                                return (
                                                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                                        <td className="p-3 font-medium">{r.vendor}</td>
                                                        <td className="p-3">{r.material}</td>
                                                        <td className="p-3 text-right">
                                                            {agreed > 0 ? `LKR ${agreed.toFixed(2)}` : <span className="text-slate-400">—</span>}
                                                        </td>
                                                        <td className="p-3 text-center text-slate-500 text-xs">{r.lastPoDate || "—"}</td>
                                                        <td className="p-3 text-right">
                                                            {received > 0 ? `LKR ${received.toFixed(2)}` : <span className="text-slate-400">—</span>}
                                                        </td>
                                                        <td className="p-3 text-center text-slate-500 text-xs">{r.lastGrnDate || "—"}</td>
                                                        <td className="p-3 text-right">
                                                            {variance === null ? (
                                                                <span className="text-slate-400">—</span>
                                                            ) : (
                                                                <span className={`font-semibold ${Math.abs(variance) < 1 ? "text-green-600" : variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                                    {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'requisitions' && (
                <PurchaseRequisitionForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'rfqs' && (
                <RFQForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'pos' && (
                <PurchaseOrderForm po={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'grns' && (
                <GRNForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'invoices' && (
                <VendorInvoiceForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showLotTraceability && (
                <LotTraceabilityDialog onClose={() => setShowLotTraceability(false)} />
            )}
            {showPrintPreview && selectedDocument && (
                <DocumentPrintPreview
                    document={selectedDocument}
                    documentType={selectedDocument.type}
                    onClose={() => { setShowPrintPreview(false); setSelectedDocument(null); }}
                />
            )}
        </div>
    );
}