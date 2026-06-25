import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Brain, Package, AlertCircle } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DemandPlanning() {
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().substring(0, 7));
    const [selectedMaterial, setSelectedMaterial] = useState('');
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: forecasts = [] } = useQuery({
        queryKey: ['demandForecasts', selectedPeriod],
        queryFn: () => matrixSales.entities.DemandForecast.filter({ forecast_period: selectedPeriod }),
        initialData: []
    });

    const { data: salesOrders = [] } = useQuery({
        queryKey: ['salesOrders'],
        queryFn: () => matrixSales.entities.SalesOrder.list(),
        initialData: []
    });

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const generateForecastMutation = useMutation({
        mutationFn: async ({ materialCode, period, method }) => {
            const material = materials.find(m => m.material_code === materialCode);
            if (!material) throw new Error("Material not found");

            // Get historical sales data (last 3 months)
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            
            const historicalSales = salesOrders.filter(so => 
                so.product_code === materialCode && 
                new Date(so.order_date) >= threeMonthsAgo &&
                so.status !== 'cancelled'
            );

            const historicalQuantities = historicalSales.map(so => so.quantity || 0);
            const avgDemand = historicalQuantities.length > 0 
                ? historicalQuantities.reduce((a, b) => a + b, 0) / historicalQuantities.length 
                : 0;

            // Apply forecasting method
            let forecastedQty = avgDemand;
            let confidence = 75;

            if (method === 'moving_average') {
                forecastedQty = avgDemand;
                confidence = 80;
            } else if (method === 'exponential_smoothing') {
                const alpha = 0.3;
                forecastedQty = historicalQuantities.reduce((forecast, actual) => 
                    alpha * actual + (1 - alpha) * forecast, avgDemand);
                confidence = 85;
            } else if (method === 'linear_regression') {
                // Simple trend calculation
                if (historicalQuantities.length >= 2) {
                    const trend = (historicalQuantities[historicalQuantities.length - 1] - historicalQuantities[0]) / historicalQuantities.length;
                    forecastedQty = historicalQuantities[historicalQuantities.length - 1] + trend;
                    confidence = 70;
                }
            }

            // Add safety factor
            const safetyStock = forecastedQty * 0.2;
            const reorderPoint = forecastedQty + safetyStock;

            return matrixSales.entities.DemandForecast.create({
                forecast_id: `DF-${materialCode}-${period}-${Date.now()}`,
                material_code: materialCode,
                material_name: material.material_name,
                forecast_period: period,
                forecast_method: method,
                forecasted_quantity: Math.round(forecastedQty),
                historical_data: { sales: historicalQuantities },
                confidence_interval: confidence,
                safety_stock_recommendation: Math.round(safetyStock),
                reorder_point_recommendation: Math.round(reorderPoint),
                status: 'draft'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['demandForecasts'] });
            toast({ title: "Success", description: "Demand forecast generated" });
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const totalForecasted = forecasts.reduce((sum, f) => sum + (f.forecasted_quantity || 0), 0);
    const totalActual = forecasts.reduce((sum, f) => sum + (f.actual_quantity || 0), 0);
    const avgAccuracy = forecasts.length > 0 
        ? forecasts.reduce((sum, f) => sum + (f.confidence_interval || 0), 0) / forecasts.length 
        : 0;

    const forecastColumns = [
        { header: "Material Code", key: "material_code" },
        { header: "Material Name", key: "material_name" },
        { header: "Period", key: "forecast_period" },
        { header: "Method", key: "forecast_method", isBadge: true },
        { header: "Forecasted Qty", key: "forecasted_quantity" },
        { header: "Actual Qty", key: "actual_quantity" },
        { 
            header: "Variance", 
            key: "variance",
            render: (val, row) => {
                const variance = (row.actual_quantity || 0) - (row.forecasted_quantity || 0);
                return <span className={variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {variance >= 0 ? '+' : ''}{variance}
                </span>;
            }
        },
        { header: "Confidence", key: "confidence_interval", render: (val) => `${val}%` },
        { header: "Safety Stock", key: "safety_stock_recommendation" },
        { header: "Reorder Point", key: "reorder_point_recommendation" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            draft: "bg-gray-100 text-gray-800",
            approved: "bg-green-100 text-green-800",
            active: "bg-blue-100 text-blue-800",
            historical_average: "bg-blue-100 text-blue-800",
            moving_average: "bg-indigo-100 text-indigo-800",
            exponential_smoothing: "bg-purple-100 text-purple-800",
            linear_regression: "bg-pink-100 text-pink-800",
            ai_ml: "bg-emerald-100 text-emerald-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const criticalMaterials = stockLevels.filter(sl => {
        const forecast = forecasts.find(f => f.material_code === sl.material_code);
        if (!forecast) return false;
        return sl.available_quantity < (forecast.safety_stock_recommendation || 0);
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Demand Planning & Forecasting</h1>
                    <p className="text-gray-600 mt-1">AI-powered demand prediction and inventory optimization</p>
                </div>
            </div>

            {criticalMaterials.length > 0 && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-900">
                        <strong>Warning:</strong> {criticalMaterials.length} material(s) are below recommended safety stock levels. Consider immediate replenishment.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-600" />
                            Demand Forecasts
                        </CardTitle>
                        <div className="flex gap-2">
                            <Input 
                                type="month" 
                                value={selectedPeriod} 
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                className="w-48"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 items-end p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                            <Label>Material</Label>
                            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materials.map(m => (
                                        <SelectItem key={m.id} value={m.material_code}>
                                            {m.material_code} - {m.material_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button 
                            onClick={() => generateForecastMutation.mutate({ 
                                materialCode: selectedMaterial, 
                                period: selectedPeriod,
                                method: 'moving_average'
                            })}
                            disabled={!selectedMaterial}
                            className="bg-emerald-600"
                        >
                            <Brain className="w-4 h-4 mr-2" />
                            Generate Forecast
                        </Button>
                    </div>

                    <DataTable
                        data={forecasts}
                        columns={forecastColumns}
                        getBadgeColor={getBadgeColor}
                    />

                    {forecasts.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No demand forecasts for {selectedPeriod}. Select a material and click "Generate Forecast".
                        </div>
                    )}
                </CardContent>
            </Card>

            {criticalMaterials.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-red-600">Critical Stock Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {criticalMaterials.map((item, idx) => {
                                const forecast = forecasts.find(f => f.material_code === item.material_code);
                                return (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                                        <div>
                                            <div className="font-medium">{item.material_name}</div>
                                            <div className="text-sm text-gray-600">Code: {item.material_code}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-red-700 font-semibold">
                                                Current: {item.available_quantity} | Safety Stock: {forecast?.safety_stock_recommendation || 'N/A'}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                Reorder Point: {forecast?.reorder_point_recommendation || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}