import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Package, MapPin, ArrowRightLeft, AlertTriangle, TrendingDown, Bell, Calculator } from "lucide-react";
import StatCard from "@/components/erp/StatCard";
import DataTable from "@/components/erp/DataTable";
import StockMovementForm from "@/components/inventory/StockMovementForm";
import CycleCountForm from "@/components/inventory/CycleCountForm";
import STOForm from "@/components/inventory/STOForm";
import StockLevelCard from "@/components/inventory/StockLevelCard";
import StockLevelAlerts from "@/components/inventory/StockLevelAlerts";
import MultiLocationStockView from "@/components/inventory/MultiLocationStockView";
import InventoryValuationReport from "@/components/inventory/InventoryValuationReport";
import RealTimeStockSync from "@/components/inventory/RealTimeStockSync";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/utils/languageContext";

export default function Inventory() {
    const [activeTab, setActiveTab] = useState("stock");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list('-aging_days'),
        initialData: []
    });

    const { data: movements = [] } = useQuery({
        queryKey: ['movements'],
        queryFn: () => matrixSales.entities.StockMovement.list('-movement_date'),
        initialData: []
    });

    const { data: cycleCounts = [] } = useQuery({
        queryKey: ['cycleCounts'],
        queryFn: () => matrixSales.entities.CycleCount.list('-count_date'),
        initialData: []
    });

    const { data: stos = [] } = useQuery({
        queryKey: ['stos'],
        queryFn: () => matrixSales.entities.StockTransferOrder.list('-sto_date'),
        initialData: []
    });

    const { data: bins = [] } = useQuery({
        queryKey: ['bins'],
        queryFn: () => matrixSales.entities.WarehouseBin.list(),
        initialData: []
    });

    // KPIs
    const totalStockValue = stockLevels.reduce((sum, s) => sum + (s.total_value || 0), 0);
    const totalStockQty = stockLevels.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const lowStockCount = stockLevels.filter(s => (s.available_quantity || 0) <= 10).length;
    const slowMovingCount = stockLevels.filter(s => (s.aging_days || 0) > 90).length;
    const pendingCounts = cycleCounts.filter(c => c.status === 'in_progress' || c.status === 'planned').length;
    const inTransitSTOs = stos.filter(s => s.status === 'in_transit').length;
    const totalMovementsToday = movements.filter(m =>
        new Date(m.movement_date).toDateString() === new Date().toDateString()
    ).length;

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
            available: "bg-green-100 text-green-800",
            reserved: "bg-blue-100 text-blue-800",
            quarantine: "bg-yellow-100 text-yellow-800",
            blocked: "bg-red-100 text-red-800",
            obsolete: "bg-gray-100 text-gray-800",
            goods_receipt: "bg-green-100 text-green-800",
            goods_issue: "bg-red-100 text-red-800",
            transfer: "bg-blue-100 text-blue-800",
            adjustment: "bg-yellow-100 text-yellow-800",
            production: "bg-purple-100 text-purple-800",
            return: "bg-orange-100 text-orange-800",
            planned: "bg-gray-100 text-gray-800",
            in_progress: "bg-blue-100 text-blue-800",
            completed: "bg-green-100 text-green-800",
            adjusted: "bg-emerald-100 text-emerald-800",
            cancelled: "bg-red-100 text-red-800",
            draft: "bg-gray-100 text-gray-800",
            submitted: "bg-blue-100 text-blue-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            in_transit: "bg-indigo-100 text-indigo-800",
            partially_received: "bg-yellow-100 text-yellow-800",
            received: "bg-emerald-100 text-emerald-800",
            closed: "bg-gray-100 text-gray-800",
            storage: "bg-blue-100 text-blue-800",
            picking: "bg-green-100 text-green-800",
            receiving: "bg-purple-100 text-purple-800",
            shipping: "bg-indigo-100 text-indigo-800",
            transit: "bg-orange-100 text-orange-800",
            pending: "bg-yellow-100 text-yellow-800",
            passed: "bg-green-100 text-green-800",
            failed: "bg-red-100 text-red-800",
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            posted: "bg-green-100 text-green-800",
            low: "bg-blue-100 text-blue-800",
            normal: "bg-gray-100 text-gray-800",
            high: "bg-orange-100 text-orange-800",
            urgent: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const stockColumns = [
        { header: t('materialCode'), key: "material_code" },
        { header: t('materialName'), key: "material_name" },
        { header: "Warehouse", key: "warehouse_name" },
        { header: "Bin", key: "bin_code" },
        { header: "Batch", key: "batch_number" },
        { header: t('quantity'), key: "quantity" },
        { header: "Available", key: "available_quantity", render: (val) => {
            const isLow = val <= 10;
            return (
                <span className={isLow ? 'text-red-600 font-bold' : ''}>
                    {val || 0}
                </span>
            );
        }},
        { header: "Reserved", key: "reserved_quantity" },
        { header: "Value (SAR)", key: "total_value", render: (val) => `${val?.toLocaleString() || 0}` },
        { header: "Aging (Days)", key: "aging_days", render: (val) => {
            const isSlow = val > 90;
            return (
                <span className={isSlow ? 'text-amber-600 font-semibold' : ''}>
                    {val || 0}
                </span>
            );
        }},
        { header: t('status'), key: "status", isBadge: true }
    ];

    const materialSearchFields = ["material_code", "material_name", "warehouse_name", "bin_code", "batch_number"];
    const materialFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "available", label: "Available" },
                { value: "reserved", label: "Reserved" },
                { value: "quarantine", label: "Quarantine" },
                { value: "blocked", label: "Blocked" },
                { value: "obsolete", label: "Obsolete" }
            ]
        }
    ];

    const movementColumns = [
        { header: "Movement #", key: "movement_number" },
        { header: t('date'), key: "movement_date" },
        { header: t('type'), key: "movement_type", isBadge: true },
        { header: t('material'), key: "material_name" },
        { header: t('quantity'), key: "quantity" },
        { header: "From", key: "from_warehouse" },
        { header: "To", key: "to_warehouse" },
        { header: "Reference", key: "reference_document" },
        { header: "Value (SAR)", key: "total_value", render: (val) => `${val?.toLocaleString() || 0}` },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const movementSearchFields = ["movement_number", "material_code", "material_name", "from_warehouse", "to_warehouse", "reference_document"];
    const movementFilters = [
        {
            field: "movement_type",
            label: t('type'),
            values: [
                { value: "goods_receipt", label: "Goods Receipt" },
                { value: "goods_issue", label: "Goods Issue" },
                { value: "transfer", label: "Transfer" },
                { value: "adjustment", label: "Adjustment" },
                { value: "production", label: "Production" },
                { value: "return", label: "Return" }
            ]
        }
        ,
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "draft", label: t('draft') },
                { value: "posted", label: "Posted" },
                { value: "cancelled", label: t('cancelled') }
            ]
        }
    ];

    const cycleCountColumns = [
        { header: "Count #", key: "count_number" },
        { header: t('date'), key: "count_date" },
        { header: "Warehouse", key: "warehouse_name" },
        { header: t('material'), key: "material_name" },
        { header: "System Qty", key: "system_quantity" },
        { header: "Counted Qty", key: "counted_quantity" },
        { header: "Variance", key: "variance_quantity", render: (val) => {
            const hasVariance = val !== 0;
            return (
                <span className={hasVariance ? 'text-red-600 font-bold' : ''}>
                    {val || 0}
                </span>
            );
        }},
        { header: "Variance %", key: "variance_percent", render: (val) => `${val?.toFixed(2) || 0}%` },
        { header: "Counted By", key: "counted_by" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const cycleCountSearchFields = ["count_number", "warehouse_name", "material_name", "counted_by"];
    const cycleCountFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "planned", label: "Planned" },
                { value: "in_progress", label: t('inProgress') },
                { value: "completed", label: t('completed') },
                { value: "adjusted", label: "Adjusted" },
                { value: "cancelled", label: t('cancelled') }
            ]
        }
    ];

    const stoColumns = [
        { header: "STO #", key: "sto_number" },
        { header: t('date'), key: "sto_date" },
        { header: "From Warehouse", key: "from_warehouse_name" },
        { header: "To Warehouse", key: "to_warehouse_name" },
        { header: t('material'), key: "material_name" },
        { header: "Requested", key: "quantity_requested" },
        { header: "Shipped", key: "quantity_shipped" },
        { header: "Received", key: "quantity_received" },
        { header: "Required Date", key: "required_date" },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const stoSearchFields = ["sto_number", "from_warehouse_name", "to_warehouse_name", "material_name"];
    const stoFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "draft", label: t('draft') },
                { value: "submitted", label: "Submitted" },
                { value: "approved", label: t('approved') },
                { value: "rejected", label: t('rejected') },
                { value: "in_transit", label: "In Transit" },
                { value: "partially_received", label: "Partially Received" },
                { value: "received", label: "Received" },
                { value: "closed", label: "Closed" }
            ]
        }
    ];

    const binColumns = [
        { header: "Bin Code", key: "bin_code" },
        { header: "Bin Name", key: "bin_name" },
        { header: "Warehouse", key: "warehouse_name" },
        { header: "Zone", key: "zone" },
        { header: "Aisle", key: "aisle" },
        { header: "Rack", key: "rack" },
        { header: t('type'), key: "bin_type", isBadge: true },
        { header: "Capacity", key: "capacity" },
        { header: "Usage", key: "current_usage" },
        {
            header: "Utilization",
            key: "utilization",
            render: (val, row) => {
                const util = row.capacity > 0 ? ((row.current_usage || 0) / row.capacity * 100) : 0;
                return `${util.toFixed(0)}%`;
            }
        },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const binSearchFields = ["bin_code", "bin_name", "warehouse_name", "zone", "aisle", "rack"];
    const binFilters = [
        {
            field: "bin_type",
            label: "Bin Type",
            values: [
                { value: "storage", label: "Storage" },
                { value: "picking", label: "Picking" },
                { value: "receiving", label: "Receiving" },
                { value: "shipping", label: "Shipping" },
                { value: "transit", label: "Transit" }
            ]
        },
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "active", label: t('active') },
                { value: "inactive", label: t('inactive') },
                { value: "full", label: "Full" },
                { value: "empty", label: "Empty" }
            ]
        }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (entity === 'StockMovement' && item.status === 'posted') {
            toast({
                title: "Cannot Delete",
                description: "Posted stock movements cannot be deleted.",
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
        
        if (type === 'Stock Movement') {
            content = `
                <html>
                    <head>
                        <title>Stock Movement ${item.movement_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                        </style>
                    </head>
                    <body>
                        <h1>Stock Movement</h1>
                        <p><strong>Movement #:</strong> ${item.movement_number}</p>
                        <p><strong>Date:</strong> ${item.movement_date}</p>
                        <p><strong>Type:</strong> ${item.movement_type}</p>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>Quantity</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Value</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.quantity} ${item.unit_of_measure || ''}</td>
                                <td>${item.from_warehouse || 'N/A'}</td>
                                <td>${item.to_warehouse || 'N/A'}</td>
                                <td>SAR ${(item.total_value || 0).toLocaleString()}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Reference:</strong> ${item.reference_document || 'N/A'}</p>
                        <p><strong>Reason:</strong> ${item.reason || 'N/A'}</p>
                    </body>
                </html>
            `;
        } else if (type === 'Cycle Count') {
            content = `
                <html>
                    <head>
                        <title>Cycle Count ${item.count_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                            .variance { color: #dc2626; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <h1>Cycle Count</h1>
                        <p><strong>Count #:</strong> ${item.count_number}</p>
                        <p><strong>Date:</strong> ${item.count_date}</p>
                        <p><strong>Warehouse:</strong> ${item.warehouse_name}</p>
                        <p><strong>Counted By:</strong> ${item.counted_by}</p>
                        <p><strong>Verified By:</strong> ${item.verified_by || 'N/A'}</p>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>System Qty</th>
                                <th>Counted Qty</th>
                                <th>Variance</th>
                                <th>Variance %</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.system_quantity}</td>
                                <td>${item.counted_quantity}</td>
                                <td class="${item.variance_quantity !== 0 ? 'variance' : ''}">${item.variance_quantity}</td>
                                <td class="${item.variance_quantity !== 0 ? 'variance' : ''}">${item.variance_percent?.toFixed(2) || 0}%</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Notes:</strong> ${item.notes || 'N/A'}</p>
                    </body>
                </html>
            `;
        } else if (type === 'STO') {
            content = `
                <html>
                    <head>
                        <title>Stock Transfer Order ${item.sto_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                        </style>
                    </head>
                    <body>
                        <h1>Stock Transfer Order</h1>
                        <p><strong>STO #:</strong> ${item.sto_number}</p>
                        <p><strong>Date:</strong> ${item.sto_date}</p>
                        <p><strong>Priority:</strong> ${item.priority || 'Normal'}</p>
                        <p><strong>From:</strong> ${item.from_warehouse_name}</p>
                        <p><strong>To:</strong> ${item.to_warehouse_name}</p>
                        <table>
                            <tr>
                                <th>Material</th>
                                <th>Requested</th>
                                <th>Shipped</th>
                                <th>Received</th>
                                <th>Required Date</th>
                            </tr>
                            <tr>
                                <td>${item.material_name}</td>
                                <td>${item.quantity_requested}</td>
                                <td>${item.quantity_shipped || 0}</td>
                                <td>${item.quantity_received || 0}</td>
                                <td>${item.required_date}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Tracking #:</strong> ${item.tracking_number || 'N/A'}</p>
                        <p><strong>Status:</strong> ${item.status}</p>
                    </body>
                </html>
            `;
        }
        
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="p-6 space-y-6">
            <RealTimeStockSync />
            
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('inventory')}</h1>
                    <p className="text-gray-600 mt-1">Multi-warehouse stock control, bin management, cycle counts & real-time tracking</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Stock Value"
                    value={`SAR ${(totalStockValue / 1000).toFixed(0)}K`}
                    icon={Package}
                    trend={`${totalStockQty.toLocaleString()} units`}
                    color="emerald"
                />
                <StatCard
                    title="Low Stock Items"
                    value={lowStockCount}
                    icon={AlertTriangle}
                    trend="Need reorder"
                    color="amber"
                />
                <StatCard
                    title="Slow Moving Stock"
                    value={slowMovingCount}
                    icon={TrendingDown}
                    trend="Over 90 days aging"
                    color="red"
                />
                <StatCard
                    title="Today's Movements"
                    value={totalMovementsToday}
                    icon={ArrowRightLeft}
                    trend={`${inTransitSTOs} in transit`}
                    color="blue"
                />
            </div>

            {/* Alerts */}
            {(lowStockCount > 0 || slowMovingCount > 0) && (
                <div className="space-y-2">
                    {lowStockCount > 0 && (
                        <Alert className="bg-amber-50 border-amber-200">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-900">
                                <strong>{lowStockCount} items</strong> are running low on stock - create purchase requisitions
                            </AlertDescription>
                        </Alert>
                    )}
                    {slowMovingCount > 0 && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <TrendingDown className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-900">
                                <strong>{slowMovingCount} items</strong> are slow-moving (over 90 days) - consider promotions or write-off
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-8 w-full">
                    <TabsTrigger value="stock">{t('stockLevel')}</TabsTrigger>
                    <TabsTrigger value="movements">{t('stockMovement')}</TabsTrigger>
                    <TabsTrigger value="cyclecounts">{t('cycleCount')}</TabsTrigger>
                    <TabsTrigger value="stos">{t('stockTransfer')}</TabsTrigger>
                    <TabsTrigger value="bins">Bin Locations</TabsTrigger>
                    <TabsTrigger value="alerts">
                        <Bell className="w-4 h-4 mr-1" />
                        Alerts
                    </TabsTrigger>
                    <TabsTrigger value="multi-location">
                        <MapPin className="w-4 h-4 mr-1" />
                        Multi-Location
                    </TabsTrigger>
                    <TabsTrigger value="valuation">
                        <Calculator className="w-4 h-4 mr-1" />
                        Valuation
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stock">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Stock Levels by Warehouse & Bin</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                >
                                    Table
                                </Button>
                                <Button
                                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('cards')}
                                >
                                    Cards
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {viewMode === 'table' ? (
                                <DataTable
                                    data={stockLevels}
                                    columns={stockColumns}
                                    searchFields={materialSearchFields}
                                    filterOptions={materialFilters}
                                    getBadgeColor={getBadgeColor}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {stockLevels.map((stock) => (
                                        <StockLevelCard key={stock.id} stockLevel={stock} />
                                    ))}
                                    {stockLevels.length === 0 && (
                                        <div className="col-span-full text-center py-8 text-gray-500">
                                            {t('noData')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="movements">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('stockMovement')}</CardTitle>
                            <Button
                                onClick={() => handleCreate('movements')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Movement
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={movements}
                                columns={movementColumns}
                                searchFields={movementSearchFields}
                                filterOptions={movementFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'movements')}
                                onDelete={(item) => handleDelete(item, 'StockMovement')}
                                onPrint={(item) => handlePrint(item, 'Stock Movement')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cyclecounts">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('cycleCount')}</CardTitle>
                            <Button
                                onClick={() => handleCreate('cyclecounts')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Cycle Count
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={cycleCounts}
                                columns={cycleCountColumns}
                                searchFields={cycleCountSearchFields}
                                filterOptions={cycleCountFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'cyclecounts')}
                                onDelete={(item) => handleDelete(item, 'CycleCount')}
                                onPrint={(item) => handlePrint(item, 'Cycle Count')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stos">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('stockTransfer')} (Inter-Branch)</CardTitle>
                            <Button
                                onClick={() => handleCreate('stos')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} STO
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={stos}
                                columns={stoColumns}
                                searchFields={stoSearchFields}
                                filterOptions={stoFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'stos')}
                                onDelete={(item) => handleDelete(item, 'StockTransferOrder')}
                                onPrint={(item) => handlePrint(item, 'STO')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bins">
                    <Card>
                        <CardHeader>
                            <CardTitle>Warehouse Bin Locations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={bins}
                                columns={binColumns}
                                searchFields={binSearchFields}
                                filterOptions={binFilters}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="alerts">
                    <StockLevelAlerts />
                </TabsContent>

                <TabsContent value="multi-location">
                    <MultiLocationStockView />
                </TabsContent>

                <TabsContent value="valuation">
                    <InventoryValuationReport />
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'movements' && (
                <StockMovementForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'cyclecounts' && (
                <CycleCountForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'stos' && (
                <STOForm item={editingItem} onClose={handleCloseDialog} />
            )}
        </div>
    );
}