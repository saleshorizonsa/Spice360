
import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Factory, Settings, Package, TrendingUp, Plus, Sparkles, AlertTriangle, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "../components/erp/DataTable";
import ProductionOrderForm from "../components/production/ProductionOrderForm";
import BOMForm from "../components/production/BOMForm";
import RoutingForm from "../components/production/RoutingForm";
import WorkCenterForm from "../components/production/WorkCenterForm";
import AIProductionOptimizer from "../components/production/AIProductionOptimizer";
import PredictiveMaintenanceAlert from "../components/production/PredictiveMaintenanceAlert";
import ProductionScenarioSimulator from "../components/production/ProductionScenarioSimulator";
import { useToast } from "@/components/ui/use-toast";

export default function Production() {
    const [activeTab, setActiveTab] = useState("orders");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: productionOrders = [] } = useQuery({
        queryKey: ['productionOrders'],
        queryFn: () => matrixSales.entities.ProductionOrder.list('-start_date'),
        initialData: []
    });

    const { data: boms = [] } = useQuery({
        queryKey: ['boms'],
        queryFn: () => matrixSales.entities.BOM.list(),
        initialData: []
    });

    const { data: routings = [] } = useQuery({
        queryKey: ['routings'],
        queryFn: () => matrixSales.entities.Routing.list(),
        initialData: []
    });

    const { data: workCenters = [] } = useQuery({
        queryKey: ['workCenters'],
        queryFn: () => matrixSales.entities.WorkCenter.list(),
        initialData: []
    });

    const { data: variances = [] } = useQuery({
        queryKey: ['variances'],
        queryFn: () => matrixSales.entities.ProductionVariance.list('-variance_date'),
        initialData: []
    });

    const { data: standardCosts = [] } = useQuery({
        queryKey: ['standardCosts'],
        queryFn: () => matrixSales.entities.StandardCost.list(),
        initialData: []
    });

    // KPIs
    const activeProduction = productionOrders.filter(p => p.status === 'in_progress').length;
    const totalProduced = productionOrders.reduce((sum, p) => sum + (p.quantity_produced || 0), 0);
    const totalPlanned = productionOrders.reduce((sum, p) => sum + (p.quantity_ordered || 0), 0);
    const avgYield = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0;
    const availableWorkCenters = workCenters.filter(w => w.status === 'available').length;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({ title: "Success", description: "Deleted successfully" });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            planned: "bg-blue-100 text-blue-800",
            in_progress: "bg-amber-100 text-amber-800",
            completed: "bg-green-100 text-green-800",
            on_hold: "bg-gray-100 text-gray-800",
            cancelled: "bg-red-100 text-red-800",
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            draft: "bg-gray-100 text-gray-800",
            available: "bg-green-100 text-green-800",
            under_maintenance: "bg-orange-100 text-orange-800",
            occupied: "bg-blue-100 text-blue-800",
            material_variance: "bg-purple-100 text-purple-800",
            labor_variance: "bg-indigo-100 text-indigo-800",
            overhead_variance: "bg-pink-100 text-pink-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    // Column Definitions
    const productionOrderColumns = [
        { header: "Order #", key: "order_number" },
        { header: "Product", key: "product_name" },
        { header: "Ordered", key: "quantity_ordered" },
        { header: "Produced", key: "quantity_produced" },
        { header: "Start Date", key: "start_date" },
        { header: "End Date", key: "end_date" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const bomColumns = [
        { header: "BOM Code", key: "bom_code" },
        { header: "Product", key: "product_name" },
        { header: "Version", key: "version" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const routingColumns = [
        { header: "Routing Code", key: "routing_code" },
        { header: "Product", key: "product_name" },
        { header: "Version", key: "version" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const workCenterColumns = [
        { header: "Work Center", key: "work_center_code" },
        { header: "Name", key: "work_center_name" },
        { header: "Type", key: "work_center_type" },
        { header: "Capacity (hrs)", key: "capacity_hours" },
        { header: "Efficiency %", key: "efficiency_rate" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const varianceColumns = [
        { header: "Variance #", key: "variance_number" },
        { header: "Production Order", key: "production_order_number" },
        { header: "Type", key: "variance_type", isBadge: true },
        { header: "Amount", key: "variance_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Date", key: "variance_date" }
    ];

    const costColumns = [
        { header: "Material", key: "material_code" },
        { header: "Name", key: "material_name" },
        { header: "Material Cost", key: "material_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Labor Cost", key: "labor_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Overhead Cost", key: "overhead_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Total Cost", key: "total_standard_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type); // The active tab value is also used to determine which form to show.
        setShowDialog(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (confirm(`Delete this ${entity}?`)) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Manufacturing & Production</h1>
                    <p className="text-gray-600 mt-1">Manage production orders, BOMs, routings & AI-powered optimization</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    title="Active Production"
                    value={activeProduction}
                    icon={Factory}
                    trend={`${productionOrders.length} total orders`}
                    color="emerald"
                />
                    title="Total Produced"
                    value={`${totalProduced} / ${totalPlanned}`}
                    icon={Package}
                    trend={`${avgYield}% yield`}
                    color="blue"
                />
                    title="Available Work Centers"
                    value={availableWorkCenters}
                    icon={Settings}
                    trend={`${workCenters.length} total`}
                    color="indigo"
                />
                    title="Variances Pending"
                    value={variances.length}
                    icon={TrendingUp}
                    trend="Cost analysis"
                    color="amber"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-9 w-full">
                    <TabsTrigger value="orders">Orders</TabsTrigger>
                    <TabsTrigger value="boms">BOMs</TabsTrigger>
                    <TabsTrigger value="routings">Routings</TabsTrigger>
                    <TabsTrigger value="workcenters">Work Centers</TabsTrigger>
                    <TabsTrigger value="variances">Variances</TabsTrigger>
                    <TabsTrigger value="costs">Standard Costs</TabsTrigger>
                    <TabsTrigger value="ai-optimizer">
                        <Sparkles className="w-4 h-4 mr-1" />
                        AI Optimizer
                    </TabsTrigger>
                    <TabsTrigger value="maintenance">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Predictive
                    </TabsTrigger>
                    <TabsTrigger value="simulator">
                        <LineChart className="w-4 h-4 mr-1" />
                        Simulator
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="orders">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Production Orders</CardTitle>
                            <Button 
                                onClick={() => handleCreate('orders')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Production Order
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={productionOrders}
                                columns={productionOrderColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, 'ProductionOrder')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="boms">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Bills of Material</CardTitle>
                            <Button 
                                onClick={() => handleCreate('boms')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New BOM
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={boms}
                                columns={bomColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, 'BOM')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="routings">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Production Routings</CardTitle>
                            <Button 
                                onClick={() => handleCreate('routings')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Routing
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={routings}
                                columns={routingColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, 'Routing')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="workcenters">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Work Centers</CardTitle>
                            <Button 
                                onClick={() => handleCreate('workcenters')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Work Center
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={workCenters}
                                columns={workCenterColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, 'WorkCenter')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="variances">
                    <Card>
                        <CardHeader>
                            <CardTitle>Production Variances</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={variances}
                                columns={varianceColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="costs">
                    <Card>
                        <CardHeader>
                            <CardTitle>Standard Costs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={standardCosts}
                                columns={costColumns}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ai-optimizer">
                    <AIProductionOptimizer />
                </TabsContent>

                <TabsContent value="maintenance">
                    <PredictiveMaintenanceAlert />
                </TabsContent>

                <TabsContent value="simulator">
                    <ProductionScenarioSimulator />
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'orders' && (
                <ProductionOrderForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === 'boms' && (
                <BOMForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === 'routings' && (
                <RoutingForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === 'workcenters' && (
                <WorkCenterForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
        </div>
    );
}
