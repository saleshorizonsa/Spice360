import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, AlertTriangle, TrendingDown, MapPin } from "lucide-react";

export default function StockLevelCard({ stockLevel }) {
    const utilizationPercent = stockLevel.quantity > 0 
        ? ((stockLevel.reserved_quantity || 0) / stockLevel.quantity) * 100 
        : 0;

    const isLowStock = stockLevel.available_quantity <= 10;
    const isSlowMoving = stockLevel.aging_days > 90;

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">{stockLevel.material_name}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{stockLevel.material_code}</p>
                    </div>
                    <Package className="w-5 h-5 text-emerald-600" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Location */}
                <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{stockLevel.warehouse_name}</span>
                    {stockLevel.bin_code && (
                        <Badge variant="outline" className="text-xs">
                            Bin: {stockLevel.bin_code}
                        </Badge>
                    )}
                </div>

                {/* Quantities */}
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-lg font-bold">{stockLevel.quantity}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Available</p>
                        <p className={`text-lg font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                            {stockLevel.available_quantity}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Reserved</p>
                        <p className="text-lg font-bold text-blue-600">{stockLevel.reserved_quantity || 0}</p>
                    </div>
                </div>

                {/* Utilization */}
                <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Utilization</span>
                        <span>{utilizationPercent.toFixed(0)}%</span>
                    </div>
                    <Progress value={utilizationPercent} className="h-2" />
                </div>

                {/* Value & Status */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500">Value</p>
                        <p className="text-lg font-bold text-emerald-600">
                            LKR {stockLevel.total_value?.toLocaleString() || 0}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isLowStock && (
                            <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Low Stock
                            </Badge>
                        )}
                        {isSlowMoving && (
                            <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                                <TrendingDown className="w-3 h-3" />
                                Slow
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Aging */}
                <div className="text-xs text-gray-500">
                    Last movement: {stockLevel.aging_days} days ago
                </div>
            </CardContent>
        </Card>
    );
}