import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Calculator, TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, Package } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import ProductCostForm from "../components/costing/ProductCostForm";
import CostPoolForm from "../components/costing/CostPoolForm";
import OverheadRateForm from "../components/costing/OverheadRateForm";
import { useToast } from "../components/ui/use-toast";
import { useOrganization } from "../components/utils/OrganizationContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "../components/utils/languageContext";

export default function Costing() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("product_costs");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg, withOrgFilter } = useOrganization();

    // Queries
    const { data: productCosts = [] } = useQuery({
        queryKey: ['productCosts', currentOrg?.id],
        queryFn: () => matrixSales.entities.ProductCost.filter(withOrgFilter(), '-calculation_date'),
        initialData: [],
        enabled: !!currentOrg
    });

    const { data: actualCosts = [] } = useQuery({
        queryKey: ['actualCosts', currentOrg?.id],
        queryFn: () => matrixSales.entities.ActualCost.filter(withOrgFilter(), '-posting_date'),
        initialData: [],
        enabled: !!currentOrg
    });

    const { data: costVariances = [] } = useQuery({
        queryKey: ['costVariances', currentOrg?.id],
        queryFn: () => matrixSales.entities.CostVariance.filter(withOrgFilter(), '-variance_date'),
        initialData: [],
        enabled: !!currentOrg
    });

    const { data: costPools = [] } = useQuery({
        queryKey: ['costPools', currentOrg?.id],
        queryFn: () => matrixSales.entities.CostPool.filter(withOrgFilter()),
        initialData: [],
        enabled: !!currentOrg
    });

    const { data: overheadRates = [] } = useQuery({
        queryKey: ['overheadRates', currentOrg?.id],
        queryFn: () => matrixSales.entities.OverheadRate.filter(withOrgFilter()),
        initialData: [],
        enabled: !!currentOrg
    });

    const { data: jobCosts = [] } = useQuery({
        queryKey: ['jobCosts', currentOrg?.id],
        queryFn: () => matrixSales.entities.JobCost.filter(withOrgFilter(), '-start_date'),
        initialData: [],
        enabled: !!currentOrg
    });

    // Calculate KPIs
    const activeProductCosts = productCosts.filter(p => p.status === 'active').length;
    const totalActualCosts = actualCosts.reduce((sum, c) => sum + (c.total_actual_cost || 0), 0);
    const unfavorableVariances = costVariances.filter(v => v.variance_type === 'unfavorable').length;
    const totalVarianceAmount = costVariances.reduce((sum, v) => sum + Math.abs(v.total_variance || 0), 0);
    
    const avgProductCost = productCosts.length > 0 
        ? productCosts.reduce((sum, p) => sum + (p.total_cost_per_unit || 0), 0) / productCosts.length
        : 0;

    const avgMargin = productCosts.length > 0
        ? productCosts.reduce((sum, p) => sum + (p.actual_margin_percent || 0), 0) / productCosts.length
        : 0;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries();
            toast({
                title: "Deleted",
                description: `Record deleted successfully`,
                variant: "default"
            });
        }
    });

    // Column Definitions
    const productCostColumns = [
        { header: "Material Code", key: "material_code" },
        { header: "Material Name", key: "material_name" },
        { header: "Version", key: "costing_version" },
        { header: "Method", key: "costing_method", isBadge: true },
        { header: "Material Cost", key: "direct_material_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Labor Cost", key: "direct_labor_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Overhead", key: "fixed_overhead", render: (val) => `SAR ${((val || 0) + 0).toFixed(2)}` },
        { header: "Total Cost/Unit", key: "total_cost_per_unit", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Selling Price", key: "actual_selling_price", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Margin %", key: "actual_margin_percent", render: (val) => `${val?.toFixed(1) || 0}%` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const actualCostColumns = [
        { header: "Document", key: "document_number" },
        { header: "Type", key: "document_type", isBadge: true },
        { header: "Material", key: "material_name" },
        { header: "Quantity", key: "quantity" },
        { header: "Material Cost", key: "direct_material_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Labor Cost", key: "direct_labor_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Overhead", key: "overhead_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Total Cost", key: "total_actual_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Cost/Unit", key: "cost_per_unit", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Date", key: "posting_date" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const varianceColumns = [
        { header: "Document", key: "document_number" },
        { header: "Material", key: "material_name" },
        { header: "Period", key: "variance_period" },
        { header: "Std Cost", key: "total_standard_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Act Cost", key: "total_actual_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Variance", key: "total_variance", render: (val) => {
            const color = val > 0 ? 'text-red-600' : 'text-green-600';
            return <span className={color}>SAR {val?.toLocaleString() || 0}</span>;
        }},
        { header: "Variance %", key: "variance_percent", render: (val) => `${val?.toFixed(1) || 0}%` },
        { header: "Type", key: "variance_type", isBadge: true },
        { header: "Status", key: "status", isBadge: true }
    ];

    const costPoolColumns = [
        { header: "Code", key: "cost_pool_code" },
        { header: "Name", key: "cost_pool_name" },
        { header: "Type", key: "cost_pool_type", isBadge: true },
        { header: "Allocation Base", key: "allocation_base" },
        { header: "Budgeted Cost", key: "budgeted_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Actual Cost", key: "actual_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Overhead Rate", key: "overhead_rate", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Period", key: "period" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const overheadRateColumns = [
        { header: "Rate Name", key: "rate_name" },
        { header: "Type", key: "rate_type", isBadge: true },
        { header: "Cost Center", key: "cost_center_code" },
        { header: "Allocation Base", key: "allocation_base" },
        { header: "Predetermined Rate", key: "predetermined_rate", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Actual Rate", key: "actual_rate", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: "Under/Over Applied", key: "under_over_applied", render: (val) => {
            if (!val) return 'SAR 0.00';
            const color = val < 0 ? 'text-red-600' : 'text-green-600';
            return <span className={color}>SAR {val?.toLocaleString()}</span>;
        }},
        { header: "Period", key: "period" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const jobCostColumns = [
        { header: "Job Number", key: "job_number" },
        { header: "Job Name", key: "job_name" },
        { header: "Type", key: "job_type", isBadge: true },
        { header: "Customer", key: "customer_name" },
        { header: "Budgeted Cost", key: "total_budgeted_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Actual Cost", key: "total_actual_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Variance", key: "cost_variance", render: (val) => {
            const color = val > 0 ? 'text-red-600' : 'text-green-600';
            return <span className={color}>SAR {val?.toLocaleString() || 0}</span>;
        }},
        { header: "Contract Value", key: "contract_value", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Profit Margin", key: "profit_margin", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Completion %", key: "completion_percent", render: (val) => `${val || 0}%` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            // Status
            draft: "bg-gray-100 text-gray-800",
            active: "bg-green-100 text-green-800",
            superseded: "bg-orange-100 text-orange-800",
            inactive: "bg-gray-100 text-gray-800",
            preliminary: "bg-yellow-100 text-yellow-800",
            posted: "bg-green-100 text-green-800",
            adjusted: "bg-blue-100 text-blue-800",
            closed: "bg-gray-100 text-gray-800",
            completed: "bg-green-100 text-green-800",
            on_hold: "bg-yellow-100 text-yellow-800",
            cancelled: "bg-red-100 text-red-800",
            // Costing methods
            standard: "bg-blue-100 text-blue-800",
            actual: "bg-green-100 text-green-800",
            average: "bg-purple-100 text-purple-800",
            fifo: "bg-indigo-100 text-indigo-800",
            lifo: "bg-pink-100 text-pink-800",
            // Variance types
            favorable: "bg-green-100 text-green-800",
            unfavorable: "bg-red-100 text-red-800",
            neutral: "bg-gray-100 text-gray-800",
            // Document types
            production_order: "bg-blue-100 text-blue-800",
            project: "bg-purple-100 text-purple-800",
            sales_order: "bg-emerald-100 text-emerald-800",
            work_order: "bg-indigo-100 text-indigo-800",
            service_order: "bg-pink-100 text-pink-800",
            purchase_order: "bg-orange-100 text-orange-800",
            // Cost pool types
            overhead: "bg-blue-100 text-blue-800",
            direct_labor: "bg-green-100 text-green-800",
            direct_material: "bg-purple-100 text-purple-800",
            indirect: "bg-yellow-100 text-yellow-800",
            administrative: "bg-gray-100 text-gray-800",
            // Rate types
            plantwide: "bg-blue-100 text-blue-800",
            departmental: "bg-green-100 text-green-800",
            activity_based: "bg-purple-100 text-purple-800",
            // Investigation status
            identified: "bg-yellow-100 text-yellow-800",
            under_investigation: "bg-orange-100 text-orange-800",
            resolved: "bg-green-100 text-green-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

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
        if (confirm(`Are you sure you want to delete this record?`)) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('costManagement')}</h1>
                    <p className="text-gray-600 mt-1">{t('productCostingDesc')}</p>
                </div>
            </div>

            {!currentOrg && (
                <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-900">
                        Please select an organization to view costing data.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    title={t('activeProductCosts')}
                    value={activeProductCosts}
                    icon={Package}
                    trend={`${t('avgCost')}: SAR ${avgProductCost.toFixed(2)}/${t('unit')}`}
                    color="blue"
                />
                    title={t('totalActualCosts')}
                    value={`SAR ${(totalActualCosts / 1000).toFixed(0)}K`}
                    icon={DollarSign}
                    trend={`${actualCosts.length} ${t('costRecords')}`}
                    color="emerald"
                />
                    title={t('unfavorableVariances')}
                    value={unfavorableVariances}
                    icon={TrendingDown}
                    trend={`${t('total')}: SAR ${(totalVarianceAmount / 1000).toFixed(0)}K`}
                    color="red"
                />
                    title={t('averageMargin')}
                    value={`${avgMargin.toFixed(1)}%`}
                    icon={TrendingUp}
                    trend={`${t('acrossProducts')} ${productCosts.length} ${t('products')}`}
                    color="indigo"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="product_costs" className="flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        {t('productCosts')}
                    </TabsTrigger>
                    <TabsTrigger value="actual_costs" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        {t('actualCosts')}
                    </TabsTrigger>
                    <TabsTrigger value="variances" className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        {t('variances')}
                    </TabsTrigger>
                    <TabsTrigger value="cost_pools" className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        {t('costPools')}
                    </TabsTrigger>
                    <TabsTrigger value="overhead_rates" className="flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        {t('overheadRates')}
                    </TabsTrigger>
                    <TabsTrigger value="job_costs" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        {t('jobCosts')}
                    </TabsTrigger>
                </TabsList>

                {/* Product Costs Tab */}
                <TabsContent value="product_costs">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('productCosting')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('product_costs')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('calculateProductCost')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={productCosts}
                                columns={productCostColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'product_costs')}
                                onDelete={(item) => handleDelete(item, 'ProductCost')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Actual Costs Tab */}
                <TabsContent value="actual_costs">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('actualCostRecords')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={actualCosts}
                                columns={actualCostColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Variances Tab */}
                <TabsContent value="variances">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('costVarianceAnalysis')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={costVariances}
                                columns={varianceColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'variances')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Cost Pools Tab */}
                <TabsContent value="cost_pools">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('costPools')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('cost_pools')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newCostPool')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={costPools}
                                columns={costPoolColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'cost_pools')}
                                onDelete={(item) => handleDelete(item, 'CostPool')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Overhead Rates Tab */}
                <TabsContent value="overhead_rates">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('overheadRates')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('overhead_rates')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newOverheadRate')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={overheadRates}
                                columns={overheadRateColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'overhead_rates')}
                                onDelete={(item) => handleDelete(item, 'OverheadRate')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Job Costs Tab */}
                <TabsContent value="job_costs">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('jobCosting')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={jobCosts}
                                columns={jobCostColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'product_costs' && (
                <ProductCostForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'cost_pools' && (
                <CostPoolForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'overhead_rates' && (
                <OverheadRateForm item={editingItem} onClose={handleCloseDialog} />
            )}
        </div>
    );
}