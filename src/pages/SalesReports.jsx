import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    Target,
    AlertTriangle,
    RefreshCw,
    ShoppingCart
} from "lucide-react";
import DailySalesRegister from "../components/reports/DailySalesRegister";
import MarginReport from "../components/reports/MarginReport";
import QuotationConversionReport from "../components/reports/QuotationConversionReport";
import PriceDiscountExceptionReport from "../components/reports/PriceDiscountExceptionReport";
import DSOCollectionsReport from "../components/reports/DSOCollectionsReport";
import ReturnRefundRegister from "../components/reports/ReturnRefundRegister";

export default function SalesReports() {
    const [activeTab, setActiveTab] = useState("daily_sales");

    const { data: sales = [] } = useQuery({
        queryKey: ['salesOrders'],
        queryFn: () => matrixSales.entities.SalesOrder.list('-order_date'),
        initialData: []
    });

    const { data: quotations = [] } = useQuery({
        queryKey: ['quotations'],
        queryFn: () => matrixSales.entities.Quotation.list('-quotation_date'),
        initialData: []
    });

    const { data: returns = [] } = useQuery({
        queryKey: ['returns'],
        queryFn: () => matrixSales.entities.SalesReturn.list('-return_date'),
        initialData: []
    });

    const { data: arRecords = [] } = useQuery({
        queryKey: ['accountsReceivable'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: []
    });

    // KPIs
    const todaySales = sales.filter(s => s.order_date === new Date().toISOString().split('T')[0]);
    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const pendingQuotations = quotations.filter(q => q.status === 'sent').length;
    const conversionRate = quotations.length > 0 
        ? ((quotations.filter(q => q.status === 'converted').length / quotations.length) * 100).toFixed(1)
        : 0;
    const overdueAmount = arRecords.filter(ar => ar.status === 'overdue').reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Sales & Receivables Reports</h1>
                    <p className="text-gray-600 mt-1">Daily sales tracking, margins, conversions & collections</p>
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
                                <p className="text-sm text-gray-600">Today's Sales</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    LKR {(todayRevenue / 1000).toFixed(0)}K
                                </p>
                                <p className="text-xs text-gray-500 mt-1">{todaySales.length} orders</p>
                            </div>
                            <ShoppingCart className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Conversion Rate</p>
                                <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
                                <p className="text-xs text-gray-500 mt-1">{pendingQuotations} pending quotes</p>
                            </div>
                            <Target className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Overdue Amount</p>
                                <p className="text-2xl font-bold text-red-600">
                                    LKR {(overdueAmount / 1000).toFixed(0)}K
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Requires action</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Returns This Month</p>
                                <p className="text-2xl font-bold text-gray-900">{returns.length}</p>
                                <p className="text-xs text-gray-500 mt-1">Track VAT reversals</p>
                            </div>
                            <RefreshCw className="w-8 h-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                    <TabsTrigger value="daily_sales">Daily Sales</TabsTrigger>
                    <TabsTrigger value="margin">Margin Analysis</TabsTrigger>
                    <TabsTrigger value="conversion">Quote Conversion</TabsTrigger>
                    <TabsTrigger value="exceptions">Price/Discount</TabsTrigger>
                    <TabsTrigger value="dso">DSO & Collections</TabsTrigger>
                    <TabsTrigger value="returns">Returns/Refunds</TabsTrigger>
                </TabsList>

                <TabsContent value="daily_sales">
                    <DailySalesRegister />
                </TabsContent>

                <TabsContent value="margin">
                    <MarginReport />
                </TabsContent>

                <TabsContent value="conversion">
                    <QuotationConversionReport />
                </TabsContent>

                <TabsContent value="exceptions">
                    <PriceDiscountExceptionReport />
                </TabsContent>

                <TabsContent value="dso">
                    <DSOCollectionsReport />
                </TabsContent>

                <TabsContent value="returns">
                    <ReturnRefundRegister />
                </TabsContent>
            </Tabs>
        </div>
    );
}