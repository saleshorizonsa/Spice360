import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    Package, 
    DollarSign, 
    Clock, 
    AlertTriangle,
    RefreshCw
} from "lucide-react";
import StockOnHandReport from "../components/reports/StockOnHandReport";
import InventoryValuationReport from "../components/reports/InventoryValuationReport";
import StockAgingReport from "../components/reports/StockAgingReport";
import CycleCountVarianceReport from "../components/reports/CycleCountVarianceReport";
import STOInTransitReport from "../components/reports/STOInTransitReport";
import BatchTraceabilityReport from "../components/reports/BatchTraceabilityReport";
import OTIFFillRateReport from "../components/reports/OTIFFillRateReport";

export default function InventoryReports() {
    const [activeTab, setActiveTab] = useState("stock_on_hand");

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: cycleCounts = [] } = useQuery({
        queryKey: ['cycleCounts'],
        queryFn: () => matrixSales.entities.CycleCount.list('-count_date'),
        initialData: []
    });

    const { data: stockTransfers = [] } = useQuery({
        queryKey: ['stockTransfers'],
        queryFn: () => matrixSales.entities.StockTransferOrder.list('-sto_date'),
        initialData: []
    });

    // KPIs
    const totalStockValue = stockLevels.reduce((sum, s) => sum + ((s.quantity || 0) * (s.unit_cost || 0)), 0);
    const lowStockItems = materials.filter(m => (m.current_stock || 0) < (m.reorder_point || 0)).length;
    const inTransitSTOs = stockTransfers.filter(sto => sto.status === 'in_transit').length;
    const pendingCycleCounts = cycleCounts.filter(cc => cc.status === 'planned' || cc.status === 'in_progress').length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventory & Warehouse Reports</h1>
                    <p className="text-gray-600 mt-1">Stock tracking, valuation, aging & warehouse operations</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh Data
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Stock Value</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    SAR {(totalStockValue / 1000000).toFixed(1)}M
                                </p>
                                <p className="text-xs text-gray-500 mt-1">{stockLevels.length} stock locations</p>
                            </div>
                            <DollarSign className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Low Stock Alerts</p>
                                <p className="text-2xl font-bold text-orange-600">{lowStockItems}</p>
                                <p className="text-xs text-gray-500 mt-1">Below reorder point</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">In-Transit STOs</p>
                                <p className="text-2xl font-bold text-blue-600">{inTransitSTOs}</p>
                                <p className="text-xs text-gray-500 mt-1">Being transferred</p>
                            </div>
                            <Package className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending Counts</p>
                                <p className="text-2xl font-bold text-indigo-600">{pendingCycleCounts}</p>
                                <p className="text-xs text-gray-500 mt-1">Cycle counts due</p>
                            </div>
                            <Clock className="w-8 h-8 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
                    <TabsTrigger value="stock_on_hand">Stock on Hand</TabsTrigger>
                    <TabsTrigger value="valuation">Valuation</TabsTrigger>
                    <TabsTrigger value="aging">Stock Aging</TabsTrigger>
                    <TabsTrigger value="cycle_count">Cycle Count</TabsTrigger>
                    <TabsTrigger value="sto_transit">STO Transit</TabsTrigger>
                    <TabsTrigger value="traceability">Traceability</TabsTrigger>
                    <TabsTrigger value="otif">OTIF / Fill-Rate</TabsTrigger>
                </TabsList>

                <TabsContent value="stock_on_hand">
                    <StockOnHandReport />
                </TabsContent>

                <TabsContent value="valuation">
                    <InventoryValuationReport />
                </TabsContent>

                <TabsContent value="aging">
                    <StockAgingReport />
                </TabsContent>

                <TabsContent value="cycle_count">
                    <CycleCountVarianceReport />
                </TabsContent>

                <TabsContent value="sto_transit">
                    <STOInTransitReport />
                </TabsContent>

                <TabsContent value="traceability">
                    <BatchTraceabilityReport />
                </TabsContent>

                <TabsContent value="otif">
                    <OTIFFillRateReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}