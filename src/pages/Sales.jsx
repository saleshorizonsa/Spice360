import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ShoppingCart, Package, Receipt, RefreshCw, AlertTriangle, Clock, CheckCircle, CreditCard } from "lucide-react";
import DataTable from "@/components/erp/DataTable";
import QuotationForm from "@/components/sales/QuotationForm";
import SalesOrderForm from "@/components/sales/SalesOrderForm";
import DeliveryForm from "@/components/sales/DeliveryForm";
import InvoiceForm from "@/components/sales/InvoiceForm";
import SalesReturnForm from "@/components/sales/SalesReturnForm";
import ServiceOrderForm from "@/components/sales/ServiceOrderForm";
import CreditLimitManager from "@/components/sales/CreditLimitManager";
import ServiceContractsPanel from "@/components/sales/ServiceContractsPanel";
import DocumentPrintPreview from "@/components/shared/DocumentPrintPreview";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/utils/languageContext";

export default function Sales() {
    const [activeTab, setActiveTab] = useState("quotations");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: quotations = [] } = useQuery({
        queryKey: ['quotations'],
        queryFn: () => matrixSales.entities.Quotation.list('-quotation_date'),
        initialData: []
    });

    const { data: orders = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => matrixSales.entities.SalesOrder.list('-order_date'),
        initialData: []
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => matrixSales.entities.Delivery.list('-delivery_date'),
        initialData: []
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => matrixSales.entities.Invoice.list('-invoice_date'),
        initialData: []
    });

    const { data: returns = [] } = useQuery({
        queryKey: ['returns'],
        queryFn: () => matrixSales.entities.SalesReturn.list('-return_date'),
        initialData: []
    });

    const { data: serviceOrders = [] } = useQuery({
        queryKey: ['serviceOrders'],
        queryFn: () => matrixSales.entities.ServiceOrder.list('-order_date'),
        initialData: []
    });

    const totalQuotations = quotations.length;
    const acceptedQuotations = quotations.filter(q => q.status === 'accepted' || q.status === 'converted').length;
    const hitRate = totalQuotations > 0 ? Math.round((acceptedQuotations / totalQuotations) * 100) : 0;
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const avgMargin = orders.length > 0 ? 25 : 0; // Placeholder for actual margin calculation
    
    const pendingDeliveries = deliveries.filter(d => d.status === 'pending' || d.status === 'in_transit').length;
    const onTimeDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const otif = deliveries.length > 0 ? Math.round((onTimeDeliveries / deliveries.length) * 100) : 0;
    
    const unpaidInvoices = invoices.filter(i => i.payment_status === 'unpaid' || i.payment_status === 'overdue').length;
    const zatcaPending = invoices.filter(i => !i.zatca_submitted || i.zatca_status === 'pending').length;
    
    const creditHoldOrders = orders.filter(o => o.credit_hold).length;
    const activeReturns = returns.filter(r => r.status === 'requested' || r.status === 'approved').length;

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
            draft: "bg-gray-100 text-gray-800",
            sent: "bg-blue-100 text-blue-800",
            accepted: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            expired: "bg-orange-100 text-orange-800",
            converted: "bg-emerald-100 text-emerald-800",
            pending: "bg-yellow-100 text-yellow-800",
            pending_approval: "bg-amber-100 text-amber-800",
            credit_hold: "bg-red-100 text-red-800",
            confirmed: "bg-blue-100 text-blue-800",
            in_production: "bg-purple-100 text-purple-800",
            ready_for_delivery: "bg-indigo-100 text-indigo-800",
            partially_delivered: "bg-amber-100 text-amber-800",
            delivered: "bg-green-100 text-green-800",
            invoiced: "bg-emerald-100 text-emerald-800",
            cancelled: "bg-red-100 text-red-800",
            in_transit: "bg-blue-100 text-blue-800",
            unpaid: "bg-red-100 text-red-800",
            partially_paid: "bg-yellow-100 text-yellow-800",
            paid: "bg-green-100 text-green-800",
            overdue: "bg-rose-100 text-rose-800",
            requested: "bg-yellow-100 text-yellow-800",
            approved: "bg-blue-100 text-blue-800",
            received: "bg-indigo-100 text-indigo-800",
            processed: "bg-cyan-100 text-cyan-800",
            completed: "bg-green-100 text-green-800",
            in_progress: "bg-purple-100 text-purple-800",
            standard: "bg-blue-100 text-blue-800",
            simplified: "bg-green-100 text-green-800",
            credit_note: "bg-red-100 text-red-800",
            debit_note: "bg-orange-100 text-orange-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const quotationColumns = [
        { header: "Quote #", key: "quotation_number" },
        { header: t('customer'), key: "customer_name" },
        { header: t('product'), key: "product_name" },
        { header: "Qty", key: "quantity" },
        { header: `${t('amount')} (SAR)`, key: "total_amount", render: (val) => `${val?.toLocaleString() || 0}` },
        { header: t('date'), key: "quotation_date" },
        { header: "Valid Until", key: "valid_until" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const quotationSearchFields = ["quotation_number", "customer_name", "product_name", "product_code"];
    const quotationFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "draft", label: t('draft') },
                { value: "sent", label: "Sent" },
                { value: "accepted", label: t('approved') },
                { value: "rejected", label: t('rejected') },
                { value: "expired", label: "Expired" },
                { value: "converted", label: "Converted" }
            ]
        }
    ];

    const salesOrderColumns = [
        { header: "Order #", key: "order_number" },
        { header: t('customer'), key: "customer_name" },
        { header: t('product'), key: "product_name" },
        { header: t('quantity'), key: "quantity" },
        { 
            header: `${t('total')} ${t('amount')}`, 
            key: "total_amount", 
            render: (val) => `SAR ${val?.toLocaleString() || 0}` 
        },
        { header: "Order Date", key: "order_date" },
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
                if (row.status === 'approved' || row.status === 'confirmed') {
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

    const orderSearchFields = ["order_number", "quotation_reference", "customer_name", "product_name", "product_code"];
    const orderFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "pending", label: t('pending') },
                { value: "pending_approval", label: `${t('pending')} Approval` },
                { value: "confirmed", label: "Confirmed" },
                { value: "in_production", label: "In Production" },
                { value: "ready_for_delivery", label: "Ready for Delivery" },
                { value: "partially_delivered", label: "Partially Delivered" },
                { value: "delivered", label: "Delivered" },
                { value: "invoiced", label: "Invoiced" },
                { value: "cancelled", label: t('cancelled') }
            ]
        }
    ];

    const deliveryColumns = [
        { header: "Delivery #", key: "delivery_number" },
        { header: "SO #", key: "sales_order_number" },
        { header: t('customer'), key: "customer_name" },
        { header: t('product'), key: "product_name" },
        { header: "Qty Delivered", key: "quantity_delivered" },
        { header: t('date'), key: "delivery_date" },
        { header: "PGI", key: "pgi_done", render: (val) => val ? "✓ Done" : t('pending') },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const deliverySearchFields = ["delivery_number", "sales_order_number", "customer_name", "product_name"];
    const deliveryFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "pending", label: t('pending') },
                { value: "in_transit", label: "In Transit" },
                { value: "delivered", label: "Delivered" },
                { value: "partially_delivered", label: "Partially Delivered" },
                { value: "cancelled", label: t('cancelled') }
            ]
        },
        {
            field: "pgi_done",
            label: t('pgiStatus'),
            values: [
                { value: "true", label: "PGI Done" },
                { value: "false", label: t('pgiPending') }
            ]
        }
    ];

    const invoiceColumns = [
        { header: "Invoice #", key: "invoice_number" },
        { header: t('type'), key: "invoice_type", isBadge: true },
        { header: "SO #", key: "sales_order_number" },
        { header: t('customer'), key: "customer_name" },
        { header: "VAT #", key: "customer_vat_number" },
        { header: `${t('amount')} (SAR)`, key: "total_amount", render: (val) => `${val?.toLocaleString() || 0}` },
        { header: "Invoice Date", key: "invoice_date" },
        { header: "Due Date", key: "due_date" },
        { header: "ZATCA", key: "zatca_status", isBadge: true },
        { header: "Payment", key: "payment_status", isBadge: true }
    ];

    const invoiceSearchFields = ["invoice_number", "sales_order_number", "customer_name", "customer_vat_number"];
    const invoiceFilters = [
        {
            field: "payment_status",
            label: t('paymentStatus'),
            values: [
                { value: "unpaid", label: "Unpaid" },
                { value: "partially_paid", label: "Partially Paid" },
                { value: "paid", label: "Paid" },
                { value: "overdue", label: t('overdue') }
            ]
        },
        {
            field: "zatca_status",
            label: t('zatcaStatus'),
            values: [
                { value: "pending", label: t('pending') },
                { value: "cleared", label: "Cleared" },
                { value: "reported", label: "Reported" },
                { value: "rejected", label: t('rejected') }
            ]
        }
    ];

    const returnColumns = [
        { header: "Return #", key: "return_number" },
        { header: "Invoice #", key: "invoice_number" },
        { header: t('customer'), key: "customer_name" },
        { header: t('product'), key: "product_name" },
        { header: "Qty", key: "quantity_returned" },
        { header: `${t('amount')} (SAR)`, key: "total_return_amount", render: (val) => `${val?.toLocaleString() || 0}` },
        { header: "Reason", key: "return_reason" },
        { header: t('date'), key: "return_date" },
        { header: "Credit Note", key: "credit_note_issued", render: (val) => val ? "Issued" : t('pending') },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const returnSearchFields = ["return_number", "invoice_number", "customer_name", "product_name", "return_reason"];
    const returnFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "requested", label: "Requested" },
                { value: "approved", label: t('approved') },
                { value: "received", label: "Received" },
                { value: "processed", label: "Processed" },
                { value: "completed", label: t('completed') },
                { value: "rejected", label: t('rejected') }
            ]
        },
        {
            field: "credit_note_issued",
            label: t('creditNoteStatus'),
            values: [
                { value: "true", label: "Issued" },
                { value: "false", label: t('pending') }
            ]
        }
    ];

    const serviceColumns = [
        { header: "Service #", key: "service_order_number" },
        { header: t('customer'), key: "customer_name" },
        { header: "Service Type", key: "service_type", isBadge: true },
        { header: "Billing", key: "billing_type" },
        { header: "Contract Value", key: "total_contract_value", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Billed", key: "billed_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Start Date", key: "start_date" },
        { header: "Assigned To", key: "assigned_to" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const serviceSearchFields = ["service_order_number", "customer_name", "assigned_to", "service_type"];
    const serviceFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "pending", label: t('pending') },
                { value: "in_progress", label: t('inProgress') },
                { value: "completed", label: t('completed') },
                { value: "cancelled", label: t('cancelled') }
            ]
        },
        {
            field: "service_type",
            label: t('serviceType'),
            values: [
                { value: "installation", label: "Installation" },
                { value: "maintenance", label: t('maintenance') },
                { value: "repair", label: "Repair" },
                { value: "consulting", label: "Consulting" }
            ]
        },
        {
            field: "billing_type",
            label: t('billingType'),
            values: [
                { value: "fixed_price", label: "Fixed Price" },
                { value: "time_and_materials", label: "Time & Materials" },
                { value: "recurring", label: "Recurring" }
            ]
        }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        // Prevent editing if pending approval or processing
        if (item.status === 'pending_approval' && type === 'orders') { // Assuming 'orders' is the tab for Sales Orders
            toast({
                title: t('cannotEdit'),
                description: t('orderPendingApprovalCannotEdit'),
                variant: "destructive"
            });
            return;
        }
        setEditingItem(item);
        setActiveTab(type); // Use the passed type to set the active tab
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        // Prevent deleting if approved or in process
        // This check applies specifically to Sales Orders, but the handleDelete function is generic.
        // It's safer to check the entity type here.
        if (entity === 'SalesOrder' && (item.status === 'approved' || item.status === 'confirmed' || item.status === 'in_production')) {
            toast({
                title: t('cannotDelete'),
                description: t('orderApprovedCannotDelete'),
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
        setSelectedDocument({ 
            ...item, 
            type,
            number: item.quotation_number || item.order_number || item.delivery_number || 
                    item.invoice_number || item.return_number || item.service_order_number,
            date: item.quotation_date || item.order_date || item.delivery_date || 
                  item.invoice_date || item.return_date || item.order_date
        });
        setShowPrintPreview(true);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('salesDistribution')}</h1>
                    <p className="text-gray-600 mt-1">{t('completeOrderToCashCycle')}</p>
                </div>
            </div>

            {(zatcaPending > 0 || creditHoldOrders > 0 || unpaidInvoices > 5) && (
                <div className="space-y-2">
                    {zatcaPending > 0 && (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                                <strong>{zatcaPending} {t('invoices')}</strong> {t('pending')} ZATCA e-invoice submission
                            </AlertDescription>
                        </Alert>
                    )}
                    {creditHoldOrders > 0 && (
                        <Alert className="bg-red-50 border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-900">
                                <strong>{creditHoldOrders} {t('orders')}</strong> on credit hold - requires approval
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="quotations">{t('quotations')}</TabsTrigger>
                    <TabsTrigger value="orders">{t('orders')}</TabsTrigger>
                    <TabsTrigger value="deliveries">{t('deliveries')}</TabsTrigger>
                    <TabsTrigger value="invoices">{t('invoices')}</TabsTrigger>
                    <TabsTrigger value="returns">{t('returns')}</TabsTrigger>
                    <TabsTrigger value="services">{t('services')}</TabsTrigger>
                    <TabsTrigger value="credit" className="gap-1">
                        <CreditCard className="w-3.5 h-3.5" /> Credit Limits
                        {creditHoldOrders > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{creditHoldOrders}</span>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="quotations">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Sales {t('quotations')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('quotations')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Quotation
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={quotations}
                                columns={quotationColumns}
                                searchFields={quotationSearchFields}
                                filterOptions={quotationFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'quotations')}
                                onDelete={(item) => handleDelete(item, 'Quotation')}
                                onPrint={(item) => handlePrint(item, 'Quotation')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="orders">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Sales {t('orders')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('orders')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Sales Order
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={orders}
                                columns={salesOrderColumns}
                                searchFields={orderSearchFields}
                                filterOptions={orderFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'orders')}
                                onDelete={(item) => handleDelete(item, 'SalesOrder')}
                                onPrint={(item) => handlePrint(item, 'Sales Order')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="deliveries">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('delivery')} Notes</CardTitle>
                            <Button 
                                onClick={() => handleCreate('deliveries')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Delivery
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={deliveries}
                                columns={deliveryColumns}
                                searchFields={deliverySearchFields}
                                filterOptions={deliveryFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'deliveries')}
                                onDelete={(item) => handleDelete(item, 'Delivery')}
                                onPrint={(item) => handlePrint(item, 'Delivery Note')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="invoices">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('invoices')} ({t('zatcaCompliant')})</CardTitle>
                            <Button 
                                onClick={() => handleCreate('invoices')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Invoice
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={invoices}
                                columns={invoiceColumns}
                                searchFields={invoiceSearchFields}
                                filterOptions={invoiceFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'invoices')}
                                onDelete={(item) => handleDelete(item, 'Invoice')}
                                onPrint={(item) => handlePrint(item, 'Invoice')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="returns">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Sales {t('returns')} {t('andCreditNotes')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('returns')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Return
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={returns}
                                columns={returnColumns}
                                searchFields={returnSearchFields}
                                filterOptions={returnFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'returns')}
                                onDelete={(item) => handleDelete(item, 'SalesReturn')}
                                onPrint={(item) => handlePrint(item, 'Sales Return')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="credit">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-600" />
                                Customer Credit Limits
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CreditLimitManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="services">
                    <ServiceContractsPanel invoices={invoices} />

                    <Card className="mt-6">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Legacy {t('serviceOrdersAndMilestoneBilling')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('services')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Service Order
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={serviceOrders}
                                columns={serviceColumns}
                                searchFields={serviceSearchFields}
                                filterOptions={serviceFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'services')}
                                onDelete={(item) => handleDelete(item, 'ServiceOrder')}
                                onPrint={(item) => handlePrint(item, 'Service Order')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === 'quotations' && (
                <QuotationForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'orders' && (
                <SalesOrderForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'deliveries' && (
                <DeliveryForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'invoices' && (
                <InvoiceForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'returns' && (
                <SalesReturnForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'services' && (
                <ServiceOrderForm item={editingItem} onClose={handleCloseDialog} />
            )}

            {showPrintPreview && selectedDocument && (
                <DocumentPrintPreview
                    document={selectedDocument}
                    documentType={selectedDocument.type}
                    onClose={() => {
                        setShowPrintPreview(false);
                        setSelectedDocument(null);
                    }}
                />
            )}
        </div>
    );
}
