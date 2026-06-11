
import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Package,
    Factory,
    Users,
    Calendar,
    Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../components/utils/languageContext";

export default function Analytics() {
    const [activeTab, setActiveTab] = useState("executive");
    const [dateRange, setDateRange] = useState("last_30_days");
    const [branch, setBranch] = useState("all");
    const { t } = useLanguage();

    // Fetch all data
    const { data: sales = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => matrixSales.entities.SalesOrder.list(),
        initialData: []
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => matrixSales.entities.Invoice.list(),
        initialData: []
    });

    const { data: purchases = [] } = useQuery({
        queryKey: ['purchases'],
        queryFn: () => matrixSales.entities.PurchaseOrder.list(),
        initialData: []
    });

    const { data: productions = [] } = useQuery({
        queryKey: ['productions'],
        queryFn: () => matrixSales.entities.ProductionOrder.list(),
        initialData: []
    });

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const { data: quality = [] } = useQuery({
        queryKey: ['quality'],
        queryFn: () => matrixSales.entities.InspectionLot.list(),
        initialData: []
    });

    const { data: arRecords = [] } = useQuery({
        queryKey: ['ar'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: []
    });

    const { data: apRecords = [] } = useQuery({
        queryKey: ['ap'],
        queryFn: () => matrixSales.entities.AccountsPayable.list(),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => matrixSales.entities.Project.list(),
        initialData: []
    });

    // Executive Dashboard KPIs
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCosts = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const grossProfit = totalRevenue - totalCosts;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    const totalStockValue = stockLevels.reduce((sum, s) => sum + (s.total_value || 0), 0);
    const activeProduction = productions.filter(p => p.status === 'in_progress').length;

    // DSO Calculation (Days Sales Outstanding)
    const totalAR = arRecords.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);
    const avgDailySales = totalRevenue / 30;
    const dso = avgDailySales > 0 ? Math.round(totalAR / avgDailySales) : 0;

    // DPO Calculation (Days Payable Outstanding)
    const totalAP = apRecords.reduce((sum, ap) => sum + (ap.outstanding_amount || 0), 0);
    const avgDailyPurchases = totalCosts / 30;
    const dpo = avgDailyPurchases > 0 ? Math.round(totalAP / avgDailyPurchases) : 0;

    // Stock Turnover
    const cogsSales = totalRevenue * 0.7; // Assuming 70% COGS
    const stockTurnover = totalStockValue > 0 ? (cogsSales / totalStockValue).toFixed(1) : 0;

    // Quality Metrics
    const totalInspections = quality.length;
    const passedInspections = quality.filter(q => q.result === 'accepted').length;
    const qualityRate = totalInspections > 0 ? Math.round((passedInspections / totalInspections) * 100) : 0;

    // Sales Trend (Last 6 months)
    const salesByMonth = getSalesByMonth(sales);

    // Top Products
    const topProducts = getTopProducts(sales, 5);

    // Inventory Aging
    const inventoryAging = getInventoryAging(stockLevels);

    // Production Efficiency
    const totalProduced = productions.reduce((sum, p) => sum + (p.quantity_produced || 0), 0);
    const totalPlanned = productions.reduce((sum, p) => sum + (p.quantity_ordered || 0), 0);
    const productionEfficiency = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0;

    // Purchase Analytics
    const purchaseByVendor = getPurchaseByVendor(purchases);

    // AR Aging
    const arAging = getARAging(arRecords);

    // AP Aging
    const apAging = getAPAging(apRecords);

    // Employee Stats
    const activeEmployees = employees.filter(e => e.employment_status === 'active').length;
    const saudiEmployees = employees.filter(e => e.is_saudi && e.employment_status === 'active').length;
    const saudizationRate = activeEmployees > 0 ? Math.round((saudiEmployees / activeEmployees) * 100) : 0;

    // Project Performance
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const projectRevenue = projects.reduce((sum, p) => sum + (p.revenue_recognized || 0), 0);
    const projectCosts = projects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);
    const projectMargin = projectRevenue > 0 ? (((projectRevenue - projectCosts) / projectRevenue) * 100).toFixed(1) : 0;

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('analyticsBI')}</h1>
                    <p className="text-gray-600 mt-1">{t('kpisDashboardsInsights')}</p>
                </div>
                <div className="flex gap-3">
                    <div className="w-48">
                        <Label className="text-sm">{t('dateRange')}</Label>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="last_7_days">{t('last7Days')}</SelectItem>
                                <SelectItem value="last_30_days">{t('last30Days')}</SelectItem>
                                <SelectItem value="last_90_days">{t('last90Days')}</SelectItem>
                                <SelectItem value="ytd">{t('ytd')}</SelectItem>
                                <SelectItem value="last_year">{t('lastYear')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-48">
                        <Label className="text-sm">{t('branch')}</Label>
                        <Select value={branch} onValueChange={setBranch}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('allBranches')}</SelectItem>
                                <SelectItem value="riyadh">{t('riyadh')}</SelectItem>
                                <SelectItem value="jeddah">{t('jeddah')}</SelectItem>
                                <SelectItem value="dammam">{t('dammam')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button className="mt-5" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        {t('export')}
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="executive">{t('executive')}</TabsTrigger>
                    <TabsTrigger value="sales">{t('sales')}</TabsTrigger>
                    <TabsTrigger value="inventory">{t('inventory')}</TabsTrigger>
                    <TabsTrigger value="production">{t('production')}</TabsTrigger>
                    <TabsTrigger value="purchasing">{t('purchasing')}</TabsTrigger>
                    <TabsTrigger value="finance">{t('finance')}</TabsTrigger>
                    <TabsTrigger value="hr">{t('hr')}</TabsTrigger>
                </TabsList>

                <TabsContent value="executive" className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">{t('dso')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{dso}</div>
                                <p className="text-sm text-gray-500">{t('dsoFull')}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">{t('dpo')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{dpo}</div>
                                <p className="text-sm text-gray-500">{t('dpoFull')}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">{t('qualityRate')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{qualityRate}%</div>
                                <p className="text-sm text-gray-500">{t('firstPassYield')}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">{t('saudization')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{saudizationRate}%</div>
                                <p className="text-sm text-gray-500">{saudiEmployees}/{activeEmployees} {t('saudi')}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('revenueTrend')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={salesByMonth}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name={`${t('revenue')} (LKR K)`} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('topProductsByRevenue')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={topProducts} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="product" type="category" width={100} />
                                        <Tooltip />
                                        <Bar dataKey="revenue" fill="#3b82f6" name={`${t('revenue')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('inventoryAging')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={inventoryAging}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={(entry) => `${entry.name}: ${entry.value}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {inventoryAging.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('arAgingAnalysis')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={arAging}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="bucket" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="amount" fill="#f59e0b" name={`${t('amount')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="sales" className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('salesByMonth')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={salesByMonth}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name={`${t('revenue')} (LKR K)`} />
                                        <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} name={`# ${t('orders')}`} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('salesByStatus')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={getSalesByStatus(sales)}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="status" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#3b82f6" name={t('count')} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('topProductsByRevenue')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {topProducts.map((product, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-semibold">{product.product}</p>
                                            <p className="text-sm text-gray-600">{product.quantity} {t('unitsSold')}</p>
                                        </div>
                                        <p className="text-lg font-bold text-emerald-600">
                                            LKR {product.revenue.toFixed(0)}K
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inventory" className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('inventoryAgingDistribution')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={inventoryAging}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={(entry) => `${entry.name}: ${entry.value}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {inventoryAging.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('stockValueByCategory')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={getStockByCategory(stockLevels)}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="category" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#6366f1" name={`${t('value')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="production" className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('productionByStatus')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={getProductionByStatus(productions)}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={(entry) => `${entry.name}: ${entry.value}`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {getProductionByStatus(productions).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('productionQuantityByProduct')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={getProductionByProduct(productions)}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="product" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="quantity" fill="#8b5cf6" name={t('quantity')} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="purchasing" className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('purchaseByVendor')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={purchaseByVendor} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="vendor" type="category" width={100} />
                                        <Tooltip />
                                        <Bar dataKey="amount" fill="#3b82f6" name={`${t('amount')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('apAging')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={apAging}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="bucket" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="amount" fill="#ef4444" name={`${t('amount')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="finance" className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('revenueVsCosts')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[
                                        { name: t('revenue'), value: totalRevenue / 1000 },
                                        { name: t('costs'), value: totalCosts / 1000 },
                                        { name: t('profit'), value: grossProfit / 1000 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#10b981" name={`${t('amount')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('arVsAp')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[
                                        { name: t('accountsReceivable'), value: totalAR / 1000 },
                                        { name: t('accountsPayable'), value: totalAP / 1000 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#3b82f6" name={`${t('amount')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('arAgingAnalysis')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={arAging}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="bucket" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="amount" fill="#f59e0b" name={`${t('amount')} (LKR K)`} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('cashFlowIndicators')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium">{t('workingCapital')}</span>
                                        <span className="text-lg font-bold text-emerald-600">
                                            LKR {((totalAR - totalAP) / 1000).toFixed(0)}K
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium">{t('cashConversionCycle')}</span>
                                        <span className="text-lg font-bold text-blue-600">
                                            {dso + 30 - dpo} {t('days')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium">{t('currentRatio')}</span>
                                        <span className="text-lg font-bold text-indigo-600">
                                            {totalAP > 0 ? ((totalAR + totalStockValue) / totalAP).toFixed(2) : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium">{t('quickRatio')}</span>
                                        <span className="text-lg font-bold text-purple-600">
                                            {totalAP > 0 ? (totalAR / totalAP).toFixed(2) : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="hr" className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('employeesByDepartment')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={getEmployeesByDepartment(employees)}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="department" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#3b82f6" name={t('count')} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('nationalityDistribution')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: t('saudi'), value: saudiEmployees },
                                                { name: t('nonSaudi'), value: activeEmployees - saudiEmployees }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={(entry) => `${entry.name}: ${entry.value}`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            <Cell fill="#10b981" />
                                            <Cell fill="#3b82f6" />
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('projectPerformance')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {projects.slice(0, 5).map((project, idx) => {
                                    const margin = project.revenue_recognized > 0
                                        ? (((project.revenue_recognized - project.actual_cost) / project.revenue_recognized) * 100).toFixed(1)
                                        : 0;
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-semibold">{project.project_name}</p>
                                                <p className="text-sm text-gray-600">{project.completion_percent}% {t('complete')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-emerald-600">
                                                    LKR {((project.revenue_recognized || 0) / 1000).toFixed(0)}K
                                                </p>
                                                <p className="text-sm text-gray-600">{margin}% {t('margin')}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Helper functions for data aggregation
function getSalesByMonth(sales) {
    const monthMap = {};
    sales.forEach(sale => {
        const date = new Date(sale.order_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[monthKey]) {
            monthMap[monthKey] = { revenue: 0, orders: 0 };
        }
        monthMap[monthKey].revenue += (sale.total_amount || 0) / 1000;
        monthMap[monthKey].orders += 1;
    });

    return Object.keys(monthMap)
        .sort()
        .slice(-6)
        .map(key => ({
            month: key,
            revenue: parseFloat(monthMap[key].revenue.toFixed(0)),
            orders: monthMap[key].orders
        }));
}

function getTopProducts(sales, limit = 5) {
    const productMap = {};
    sales.forEach(sale => {
        const key = sale.product_name || 'Unknown';
        if (!productMap[key]) {
            productMap[key] = { revenue: 0, quantity: 0 };
        }
        productMap[key].revenue += (sale.total_amount || 0) / 1000;
        productMap[key].quantity += sale.quantity || 0;
    });

    return Object.keys(productMap)
        .map(key => ({
            product: key,
            revenue: parseFloat(productMap[key].revenue.toFixed(0)),
            quantity: productMap[key].quantity
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
}

function getInventoryAging(stockLevels) {
    const aging = {
        '0-30': 0,
        '31-60': 0,
        '61-90': 0,
        '90+': 0
    };

    stockLevels.forEach(stock => {
        const days = stock.aging_days || 0;
        if (days <= 30) aging['0-30']++;
        else if (days <= 60) aging['31-60']++;
        else if (days <= 90) aging['61-90']++;
        else aging['90+']++;
    });

    const total = stockLevels.length || 1;
    return Object.keys(aging).map(key => ({
        name: `${key} days`,
        value: Math.round((aging[key] / total) * 100)
    }));
}

function getSalesByStatus(sales) {
    const statusMap = {};
    sales.forEach(sale => {
        const status = sale.status || 'unknown';
        statusMap[status] = (statusMap[status] || 0) + 1;
    });

    return Object.keys(statusMap).map(key => ({
        status: key.replace('_', ' '),
        count: statusMap[key]
    }));
}

function getPurchaseByVendor(purchases) {
    const vendorMap = {};
    purchases.forEach(purchase => {
        const vendor = purchase.vendor_name || 'Unknown';
        if (!vendorMap[vendor]) {
            vendorMap[vendor] = 0;
        }
        vendorMap[vendor] += (purchase.total_amount || 0) / 1000;
    });

    return Object.keys(vendorMap)
        .map(key => ({
            vendor: key,
            amount: parseFloat(vendorMap[key].toFixed(0))
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
}

function getARAging(arRecords) {
    const aging = {
        'Current': 0,
        '1-30': 0,
        '31-60': 0,
        '61-90': 0,
        '90+': 0
    };

    arRecords.forEach(ar => {
        const days = ar.aging_days || 0;
        const amount = (ar.outstanding_amount || 0) / 1000;
        if (days === 0) aging['Current'] += amount;
        else if (days <= 30) aging['1-30'] += amount;
        else if (days <= 60) aging['31-60'] += amount;
        else if (days <= 90) aging['61-90'] += amount;
        else aging['90+'] += amount;
    });

    return Object.keys(aging).map(key => ({
        bucket: key,
        amount: parseFloat(aging[key].toFixed(0))
    }));
}

function getAPAging(apRecords) {
    const aging = {
        'Current': 0,
        '1-30': 0,
        '31-60': 0,
        '61-90': 0,
        '90+': 0
    };

    apRecords.forEach(ap => {
        const days = ap.aging_days || 0;
        const amount = (ap.outstanding_amount || 0) / 1000;
        if (days === 0) aging['Current'] += amount;
        else if (days <= 30) aging['1-30'] += amount;
        else if (days <= 60) aging['31-60'] += amount;
        else if (days <= 90) aging['61-90'] += amount;
        else aging['90+'] += amount;
    });

    return Object.keys(aging).map(key => ({
        bucket: key,
        amount: parseFloat(aging[key].toFixed(0))
    }));
}

function getStockByCategory(stockLevels) {
    const categoryMap = {};
    stockLevels.forEach(stock => {
        const category = stock.material_name?.substring(0, 10) || 'Other';
        if (!categoryMap[category]) {
            categoryMap[category] = 0;
        }
        categoryMap[category] += (stock.total_value || 0) / 1000;
    });

    return Object.keys(categoryMap)
        .map(key => ({
            category: key,
            value: parseFloat(categoryMap[key].toFixed(0))
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
}

function getProductionByStatus(productions) {
    const statusMap = {};
    productions.forEach(prod => {
        const status = prod.status || 'unknown';
        statusMap[status] = (statusMap[status] || 0) + 1;
    });

    return Object.keys(statusMap).map(key => ({
        name: key.replace('_', ' '),
        value: statusMap[key]
    }));
}

function getProductionByProduct(productions) {
    const productMap = {};
    productions.forEach(prod => {
        const product = prod.product_name || 'Unknown';
        if (!productMap[product]) {
            productMap[product] = 0;
        }
        productMap[product] += prod.quantity_produced || 0;
    });

    return Object.keys(productMap)
        .map(key => ({
            product: key,
            quantity: productMap[key]
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
}

function getEmployeesByDepartment(employees) {
    const deptMap = {};
    employees.filter(e => e.employment_status === 'active').forEach(emp => {
        const dept = emp.department || 'Other';
        deptMap[dept] = (deptMap[dept] || 0) + 1;
    });

    return Object.keys(deptMap).map(key => ({
        department: key,
        count: deptMap[key]
    }));
}
