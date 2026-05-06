import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Calendar } from "lucide-react";

export default function AssetDepreciationCard({ asset }) {
    const depreciableValue = asset.acquisition_cost - (asset.salvage_value || 0);
    const depreciationPercent = depreciableValue > 0 
        ? ((asset.accumulated_depreciation || 0) / depreciableValue) * 100 
        : 0;

    const yearsElapsed = new Date().getFullYear() - new Date(asset.acquisition_date).getFullYear();
    const remainingLife = Math.max(0, asset.useful_life_years - yearsElapsed);

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">{asset.asset_name}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{asset.asset_number}</p>
                        <Badge className="mt-2">{asset.asset_class}</Badge>
                    </div>
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Cost Summary */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500">Acquisition Cost</p>
                        <p className="text-lg font-bold text-gray-900">
                            SAR {(asset.acquisition_cost || 0).toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Net Book Value</p>
                        <p className="text-lg font-bold text-emerald-600">
                            SAR {(asset.net_book_value || 0).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Depreciation Progress */}
                <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Depreciation Progress</span>
                        <span>{depreciationPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={depreciationPercent} className="h-2" />
                    <p className="text-xs text-gray-500 mt-1">
                        SAR {(asset.accumulated_depreciation || 0).toLocaleString()} accumulated
                    </p>
                </div>

                {/* Timeline */}
                <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500">Remaining Life</p>
                            <p className="text-sm font-semibold">{remainingLife} years</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Method</p>
                        <p className="text-sm font-semibold capitalize">
                            {asset.depreciation_method?.replace('_', ' ')}
                        </p>
                    </div>
                </div>

                {/* Location & Owner */}
                <div className="text-xs text-gray-500 pt-2 border-t">
                    <div className="flex justify-between">
                        <span>Location: {asset.location_code || 'N/A'}</span>
                        <span>Owner: {asset.responsible_person || 'N/A'}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}