import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown, DollarSign, AlertCircle, Calendar } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TreasuryManagement() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().substring(0, 7));
    const [forecastScenario, setForecastScenario] = useState("baseline");
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: () => matrixSales.entities.BankAccount.list(),
        initialData: []
    });

    const { data: arTransactions = [] } = useQuery({
        queryKey: ['ar'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: []
    });

    const { data: apTransactions = [] } = useQuery({
        queryKey: ['ap'],
        queryFn: () => matrixSales.entities.AccountsPayable.list(),
        initialData: []
    });

    const { data: forecasts = [] } = useQuery({
        queryKey: ['cashFlowForecasts', selectedPeriod],
        queryFn: () => matrixSales.entities.CashFlowForecast.filter({ forecast_period: selectedPeriod }),
        initialData: []
    });

    const { data: payments = [] } = useQuery({
        queryKey: ['payments'],
        queryFn: () => matrixSales.entities.Payment.list('-payment_date', 30),
        initialData: []
    });

    // Calculate cash position
    const totalCash = banks.reduce((sum, b) => sum + (b.current_balance || 0), 0);
    const totalAR = arTransactions.filter(ar => ar.status === 'open' || ar.status === 'overdue')
        .reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);
    const totalAP = apTransactions.filter(ap => ap.payment_status !== 'paid')
        .reduce((sum, ap) => sum + (ap.outstanding_amount || 0), 0);
    const netPosition = totalCash + totalAR - totalAP;

    // Recent payments
    const inflows = payments.filter(p => p.payment_type === 'incoming' && p.status === 'cleared')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    const outflows = payments.filter(p => p.payment_type === 'outgoing' && p.status === 'cleared')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

    const generateForecastMutation = useMutation({
        mutationFn: async ({ period, scenario }) => {
            const openingBalance = totalCash;
            
            // Calculate projected inflows
            const projectedInflows = {
                sales_collections: totalAR * 0.7, // Assume 70% collection
                loan_proceeds: 0,
                asset_sales: 0,
                other_income: 0
            };
            
            // Calculate projected outflows
            const projectedOutflows = {
                supplier_payments: totalAP * 0.6, // Assume 60% payment
                payroll: 0,
                loan_repayments: 0,
                capex: 0,
                operating_expenses: 0
            };

            const totalInflows = Object.values(projectedInflows).reduce((a, b) => a + b, 0);
            const totalOutflows = Object.values(projectedOutflows).reduce((a, b) => a + b, 0);
            const closingBalance = openingBalance + totalInflows - totalOutflows;

            // Apply scenario adjustments
            let confidenceLevel = 85;
            if (scenario === 'optimistic') {
                projectedInflows.sales_collections *= 1.2;
                confidenceLevel = 70;
            } else if (scenario === 'pessimistic') {
                projectedInflows.sales_collections *= 0.8;
                projectedOutflows.operating_expenses *= 1.1;
                confidenceLevel = 90;
            }

            return matrixSales.entities.CashFlowForecast.create({
                forecast_id: `CF-${period}-${scenario}-${Date.now()}`,
                forecast_date: new Date().toISOString().split('T')[0],
                forecast_period: period,
                scenario: scenario,
                opening_balance: openingBalance,
                projected_inflows: totalInflows,
                projected_outflows: totalOutflows,
                closing_balance: closingBalance,
                inflow_sources: projectedInflows,
                outflow_sources: projectedOutflows,
                confidence_level: confidenceLevel,
                status: 'draft'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashFlowForecasts'] });
            toast({ title: "Success", description: "Cash flow forecast generated" });
        }
    });

    const forecastColumns = [
        { header: "Forecast ID", key: "forecast_id" },
        { header: "Period", key: "forecast_period" },
        { header: "Scenario", key: "scenario", isBadge: true },
        { header: "Opening", key: "opening_balance", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Inflows", key: "projected_inflows", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Outflows", key: "projected_outflows", render: (val) => `LKR ${val?.toLocaleString() || 0}` },
        { header: "Closing", key: "closing_balance", render: (val) => {
            const amount = val || 0;
            return <span className={amount < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                LKR {amount.toLocaleString()}
            </span>;
        }},
        { header: "Confidence", key: "confidence_level", render: (val) => `${val}%` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            draft: "bg-gray-100 text-gray-800",
            approved: "bg-green-100 text-green-800",
            actual: "bg-blue-100 text-blue-800",
            baseline: "bg-blue-100 text-blue-800",
            optimistic: "bg-green-100 text-green-800",
            pessimistic: "bg-yellow-100 text-yellow-800",
            worst_case: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Treasury Management</h1>
                    <p className="text-gray-600 mt-1">Cash flow forecasting and liquidity management</p>
                </div>
            </div>

            {netPosition < 0 && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-900">
                        <strong>Warning:</strong> Negative net cash position detected. Consider improving collections or delaying non-critical payments.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 w-full max-w-2xl">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="forecast">Cash Forecast</TabsTrigger>
                    <TabsTrigger value="analysis">Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Bank Accounts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {banks.map((bank, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <div className="font-medium">{bank.account_name}</div>
                                                <div className="text-xs text-gray-500">{bank.bank_name} - {bank.account_number}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">LKR {bank.current_balance?.toLocaleString()}</div>
                                                <div className="text-xs text-gray-500">{bank.currency}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {banks.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">No bank accounts configured</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Cash Flow (Last 30 Days)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="p-4 bg-green-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Cash Inflows</div>
                                        <div className="text-2xl font-bold text-green-700">LKR {inflows.toLocaleString()}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {payments.filter(p => p.payment_type === 'incoming' && p.status === 'cleared').length} transactions
                                        </div>
                                    </div>
                                    <div className="p-4 bg-red-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Cash Outflows</div>
                                        <div className="text-2xl font-bold text-red-700">LKR {outflows.toLocaleString()}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {payments.filter(p => p.payment_type === 'outgoing' && p.status === 'cleared').length} transactions
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                                        <div className="text-sm text-gray-600">Net Cash Flow</div>
                                        <div className={`text-2xl font-bold ${inflows - outflows >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                            LKR {(inflows - outflows).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="forecast">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    Cash Flow Forecasts
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Select value={forecastScenario} onValueChange={setForecastScenario}>
                                        <SelectTrigger className="w-40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="baseline">Baseline</SelectItem>
                                            <SelectItem value="optimistic">Optimistic</SelectItem>
                                            <SelectItem value="pessimistic">Pessimistic</SelectItem>
                                            <SelectItem value="worst_case">Worst Case</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        onClick={() => generateForecastMutation.mutate({ period: selectedPeriod, scenario: forecastScenario })}
                                        className="bg-emerald-600"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Generate Forecast
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Forecast Period</Label>
                                <Input 
                                    type="month" 
                                    value={selectedPeriod} 
                                    onChange={(e) => setSelectedPeriod(e.target.value)}
                                    className="max-w-xs"
                                />
                            </div>

                            <DataTable
                                data={forecasts}
                                columns={forecastColumns}
                                getBadgeColor={getBadgeColor}
                                showSearch={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analysis">
                    <Card>
                        <CardHeader>
                            <CardTitle>Liquidity Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Current Ratio</div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {totalAP > 0 ? ((totalCash + totalAR) / totalAP).toFixed(2) : 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {totalAP > 0 && (totalCash + totalAR) / totalAP >= 1.5 ? '✓ Healthy' : '⚠️ Monitor'}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Quick Ratio (Cash)</div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {totalAP > 0 ? (totalCash / totalAP).toFixed(2) : 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {totalAP > 0 && totalCash / totalAP >= 1 ? '✓ Excellent' : '⚠️ Improve'}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <div className="text-sm text-gray-600">Working Capital</div>
                                        <div className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            LKR {netPosition.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {netPosition >= 0 ? '✓ Positive' : '⚠️ Negative'}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h3 className="font-semibold mb-4">Recommendations</h3>
                                    <div className="space-y-2">
                                        {netPosition < 0 && (
                                            <Alert className="bg-yellow-50 border-yellow-200">
                                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                                <AlertDescription className="text-yellow-900">
                                                    Focus on accelerating AR collections and consider negotiating extended payment terms with suppliers
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        {totalAP > 0 && totalCash / totalAP < 0.5 && (
                                            <Alert className="bg-red-50 border-red-200">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <AlertDescription className="text-red-900">
                                                    Low cash ratio detected. Consider securing a credit line or delaying non-critical expenses
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        {totalAP > 0 && (totalCash + totalAR) / totalAP >= 2 && (
                                            <Alert className="bg-green-50 border-green-200">
                                                <AlertCircle className="h-4 w-4 text-green-600" />
                                                <AlertDescription className="text-green-900">
                                                    Strong liquidity position. Consider investing excess cash or early payment discounts
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}