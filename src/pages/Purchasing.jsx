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
import { useToast } from "@/components/ui/use-toast";
import { Clock, CheckCircle } from "lucide-react";
import { createNotification } from "@/components/utils/notificationService";
import { useLanguage } from "@/components/utils/languageContext";

export default function Purchasing() {
    const [activeTab, setActiveTab] = useState("requisitions");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showLotTraceability, setShowLotTraceability] = useState(false);
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
        const printWindow = window.open('', '_blank');
        let content = '';

        if (type === 'PR') {
            content = `
                <html>
                    <head>
                        <title>Purchase Requisition ${item.pr_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                        </style>
                    </head>
                    <body>
                        <h1>Purchase Requisition</h1>
                        <p><strong>PR Number:</strong> ${item.pr_number}</p>
                        <p><strong>Date:</strong> ${item.pr_date}</p>
                        <p><strong>Requested By:</strong> ${item.requested_by}</p>
                        <p><strong>Department:</strong> ${item.department || 'N/A'}</p>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>Quantity</th>
                                <th>UOM</th>
                                <th>Required Date</th>
                                <th>Priority</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.quantity_required}</td>
                                <td>${item.unit_of_measure}</td>
                                <td>${item.required_date}</td>
                                <td>${item.priority}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Purpose:</strong> ${item.purpose || 'N/A'}</p>
                        <p><strong>Status:</strong> ${item.status}</p>
                    </body>
                </html>
            `;
        } else if (type === 'RFQ') {
            content = `
                <html>
                    <head>
                        <title>Request for Quotation ${item.rfq_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                        </style>
                    </head>
                    <body>
                        <h1>Request for Quotation</h1>
                        <p><strong>RFQ Number:</strong> ${item.rfq_number}</p>
                        <p><strong>Date:</strong> ${item.rfq_date}</p>
                        <p><strong>Closing Date:</strong> ${item.closing_date}</p>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>Quantity</th>
                                <th>UOM</th>
                                <th>Required Date</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.quantity}</td>
                                <td>${item.unit_of_measure}</td>
                                <td>${item.required_date}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Specifications:</strong> ${item.specifications || 'N/A'}</p>
                    </body>
                </html>
            `;
        } else if (type === 'PO') {
            content = `
                <html>
                    <head>
                        <title>Purchase Order ${item.po_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                            th { background-color: #f3f4f6; font-weight: bold; }
                            .totals { text-align: right; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div>
                                <h1>PURCHASE ORDER</h1>
                                <p><strong>PO #:</strong> ${item.po_number}</p>
                                <p><strong>Date:</strong> ${item.po_date}</p>
                                <p><strong>Type:</strong> ${item.po_type}</p>
                            </div>
                            <div>
                                <p><strong>Vendor:</strong></p>
                                <p>${item.vendor_name}</p>
                                <p>${item.vendor_contact || ''}</p>
                                <p>${item.vendor_email || ''}</p>
                            </div>
                        </div>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>Quantity</th>
                                <th>UOM</th>
                                <th>Unit Price</th>
                                <th>Amount</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.quantity}</td>
                                <td>${item.unit_of_measure}</td>
                                <td>LKR ${item.unit_price?.toFixed(2) || '0.00'}</td>
                                <td>LKR ${item.subtotal?.toFixed(2) || '0.00'}</td>
                            </tr>
                        </table>
                        <div class="totals">
                            <p>Subtotal: LKR ${item.subtotal?.toFixed(2) || '0.00'}</p>
                            <p>VAT (${item.vat_percent || 0}%): LKR ${item.vat_amount?.toFixed(2) || '0.00'}</p>
                            <p><strong>Total Amount: LKR ${item.total_amount?.toFixed(2) || '0.00'}</strong></p>
                        </div>
                        <p style="margin-top: 30px;"><strong>Delivery Date:</strong> ${item.delivery_date}</p>
                        <p><strong>Payment Terms:</strong> ${item.payment_terms}</p>
                    </body>
                </html>
            `;
        } else if (type === 'GRN') {
            content = `
                <html>
                    <head>
                        <title>Goods Receipt Note ${item.grn_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                        </style>
                    </head>
                    <body>
                        <h1>Goods Receipt Note</h1>
                        <p><strong>GRN #:</strong> ${item.grn_number}</p>
                        <p><strong>Date:</strong> ${item.grn_date}</p>
                        <p><strong>PO #:</strong> ${item.po_number}</p>
                        <p><strong>Vendor:</strong> ${item.vendor_name}</p>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>PO Qty</th>
                                <th>Received</th>
                                <th>Accepted</th>
                                <th>Rejected</th>
                                <th>Inspection</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.po_quantity}</td>
                                <td>${item.received_quantity}</td>
                                <td>${item.accepted_quantity}</td>
                                <td>${item.rejected_quantity}</td>
                                <td>${item.inspection_result}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Received By:</strong> ${item.received_by}</p>
                        <p><strong>Location:</strong> ${item.location_code || 'N/A'}</p>
                    </body>
                </html>
            `;
        } else if (type === 'Vendor Invoice') {
            const threeWayMatchClass = item.three_way_match_status === 'matched' ? 'matched' :
                                        item.three_way_match_status === 'pending' ? 'pending' :
                                        item.three_way_match_status === 'variance_exceeded' ? 'variance' : '';
            content = `
                <html>
                    <head>
                        <title>Vendor Invoice ${item.vendor_invoice_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                            th { background-color: #f3f4f6; }
                            .match-status { padding: 10px; margin: 20px 0; border-radius: 5px; }
                            .matched { background-color: #d1fae5; color: #065f46; }
                            .pending { background-color: #fef3c7; color: #92400e; }
                            .variance { background-color: #fee2e2; color: #991b1b; }
                        </style>
                    </head>
                    <body>
                        <h1>Vendor Invoice</h1>
                        <p><strong>Invoice #:</strong> ${item.vendor_invoice_number}</p>
                        <p><strong>Date:</strong> ${item.invoice_date}</p>
                        <p><strong>PO #:</strong> ${item.po_number}</p>
                        <p><strong>GRN #:</strong> ${item.grn_number}</p>
                        <p><strong>Vendor:</strong> ${item.vendor_name}</p>
                        <div class="match-status ${threeWayMatchClass}">
                            <strong>3-Way Match Status:</strong> ${item.three_way_match_status?.toUpperCase() || 'N/A'}
                        </div>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>Invoiced Qty</th>
                                <th>Unit Price</th>
                                <th>Amount</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.invoiced_quantity}</td>
                                <td>LKR ${item.unit_price?.toFixed(2) || '0.00'}</td>
                                <td>LKR ${item.subtotal?.toFixed(2) || '0.00'}</td>
                            </tr>
                        </table>
                        <div style="text-align: right; margin-top: 20px;">
                            <p>Subtotal: LKR ${item.subtotal?.toFixed(2) || '0.00'}</p>
                            <p>VAT: LKR ${item.vat_amount?.toFixed(2) || '0.00'}</p>
                            <p><strong>Total: LKR ${item.total_amount?.toFixed(2) || '0.00'}</strong></p>
                        </div>
                    </body>
                </html>
            `;
        }

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
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
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="requisitions">{t('requisitions')}</TabsTrigger>
                    <TabsTrigger value="rfqs">{t('rfqs')}</TabsTrigger>
                    <TabsTrigger value="pos">{t('pos')}</TabsTrigger>
                    <TabsTrigger value="grns">{t('grns')}</TabsTrigger>
                    <TabsTrigger value="invoices">{t('vendorInvoices')}</TabsTrigger>
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
        </div>
    );
}