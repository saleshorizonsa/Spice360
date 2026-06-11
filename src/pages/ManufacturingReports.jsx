import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    Factory, 
    AlertTriangle, 
    DollarSign,
    RefreshCw,
    Settings
} from "lucide-react";
import MRPExceptionReport from "../components/reports/MRPExceptionReport";
import ProductionOrderStatusReport from "../components/reports/ProductionOrderStatusReport";
import YieldScrapReport from "../components/reports/YieldScrapReport";
import CostVarianceReport from "../components/reports/CostVarianceReport";
import CapacityLoadReport from "../components/reports/CapacityLoadReport";
import BackflushVarianceReport from "../components/reports/BackflushVarianceReport";

export default function ManufacturingReports() {
    const [activeTab, setActiveTab] = useState("mrp_exceptions");

    const { data: productionOrders = [] } = useQuery({
        queryKey: ['productionOrders'],
        queryFn: () => matrixSales.entities.ProductionOrder.list('-start_date'),
        initialData: []
    });

    const { data: mrpPlannedOrders = [] } = useQuery({
        queryKey: ['mrpPlannedOrders'],
        queryFn: () => matrixSales.entities.MRPPlannedOrder.list(),
        initialData: []
    });

    const { data: productionVariances = [] } = useQuery({
        queryKey: ['productionVariances'],
        queryFn: () => matrixSales.entities.ProductionVariance.list(),
        initialData: []
    });

    const { data: workCenters = [] } = useQuery({
        queryKey: ['workCenters'],
        queryFn: () => matrixSales.entities.WorkCenter.list(),
        initialData: []
    });

    // KPIs
    const activeProduction = productionOrders.filter(p => p.status === 'in_progress').length;
    const exceptions = mrpPlannedOrders.filter(m => m.required_date < new Date().toISOString().split('T')[0]).length;
    const totalVariance = productionVariances.reduce((sum, v) => sum + Math.abs(v.total_variance_sar || 0), 0);
    const availableWorkCenters = workCenters.filter(wc => wc.status === 'available').length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Manufacturing & Costing Reports</h1>
                    <p className="text-gray-600 mt-1">Production planning, costing analysis & capacity management</p>
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
                                <p className="text-sm text-gray-600">Active Production</p>
                                <p className="text-2xl font-bold text-gray-900">{activeProduction}</p>
                                <p className="text-xs text-gray-500 mt-1">{productionOrders.length} total orders</p>
                            </div>
                            <Factory className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">MRP Exceptions</p>
                                <p className="text-2xl font-bold text-orange-600">{exceptions}</p>
                                <p className="text-xs text-gray-500 mt-1">Late supply/shortages</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Cost Variance</p>
                                <p className="text-2xl font-bold text-red-600">
                                    LKR {(totalVariance / 1000).toFixed(0)}K
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Standard vs Actual</p>
                            </div>
                            <DollarSign className="w-8 h-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Available Capacity</p>
                                <p className="text-2xl font-bold text-blue-600">{availableWorkCenters}</p>
                                <p className="text-xs text-gray-500 mt-1">Work centers ready</p>
                            </div>
                            <Settings className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                    <TabsTrigger value="mrp_exceptions">MRP Exceptions</TabsTrigger>
                    <TabsTrigger value="production_status">Production Status</TabsTrigger>
                    <TabsTrigger value="yield_scrap">Yield & Scrap</TabsTrigger>
                    <TabsTrigger value="cost_variance">Cost Variance</TabsTrigger>
                    <TabsTrigger value="capacity_load">Capacity Load</TabsTrigger>
                    <TabsTrigger value="backflush">Backflush Variance</TabsTrigger>
                </TabsList>

                <TabsContent value="mrp_exceptions">
                    <MRPExceptionReport />
                </TabsContent>

                <TabsContent value="production_status">
                    <ProductionOrderStatusReport />
                </TabsContent>

                <TabsContent value="yield_scrap">
                    <YieldScrapReport />
                </TabsContent>

                <TabsContent value="cost_variance">
                    <CostVarianceReport />
                </TabsContent>

                <TabsContent value="capacity_load">
                    <CapacityLoadReport />
                </TabsContent>

                <TabsContent value="backflush">
                    <BackflushVarianceReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}