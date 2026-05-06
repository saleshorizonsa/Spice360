import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Package, MapPin } from "lucide-react";

export default function StockLevelAlerts() {
    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => base44.entities.StockLevel.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    // Calculate alerts
    const alerts = stockLevels.map(stock => {
        const material = materials.find(m => m.material_code === stock.material_code);
        const reorderPoint = material?.reorder_point || 0;
        const available = stock.available_quantity || 0;
        
        let alertType = null;
        let severity = null;
        
        if (available === 0) {
            alertType = 'out_of_stock';
            severity = 'critical';
        } else if (available <= reorderPoint * 0.5) {
            alertType = 'critically_low';
            severity = 'high';
        } else if (available <= reorderPoint) {
            alertType = 'low_stock';
            severity = 'medium';
        } else if ((stock.aging_days || 0) > 180) {
            alertType = 'obsolete';
            severity = 'low';
        } else if ((stock.aging_days || 0) > 90) {
            alertType = 'slow_moving';
            severity = 'low';
        }
        
        return alertType ? {
            ...stock,
            material,
            alertType,
            severity,
            reorderPoint
        } : null;
    }).filter(Boolean);

    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts = alerts.filter(a => a.severity === 'high');
    const mediumAlerts = alerts.filter(a => a.severity === 'medium');
    const lowAlerts = alerts.filter(a => a.severity === 'low');

    const AlertItem = ({ alert }) => (
        <div className={`p-3 rounded-lg border ${
            alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
            alert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
            alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
            'bg-blue-50 border-blue-200'
        }`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="font-semibold">{alert.material_name}</div>
                    <div className="text-sm text-gray-600">{alert.material_code}</div>
                </div>
                <Badge className={
                    alert.severity === 'critical' ? 'bg-red-600' :
                    alert.severity === 'high' ? 'bg-orange-600' :
                    alert.severity === 'medium' ? 'bg-yellow-600' :
                    'bg-blue-600'
                }>
                    {alert.alertType.replace('_', ' ').toUpperCase()}
                </Badge>
            </div>
            <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    <span>Available: {alert.available_quantity}</span>
                </div>
                <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{alert.warehouse_name}</span>
                </div>
                {alert.alertType !== 'obsolete' && alert.alertType !== 'slow_moving' && (
                    <div className="text-gray-600">
                        Reorder: {alert.reorderPoint}
                    </div>
                )}
                {(alert.alertType === 'obsolete' || alert.alertType === 'slow_moving') && (
                    <div className="text-gray-600">
                        Aging: {alert.aging_days} days
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Stock Level Alerts
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {alerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No stock alerts - all inventory levels are healthy</p>
                    </div>
                ) : (
                    <>
                        {criticalAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                                    <AlertTriangle className="w-4 h-4" />
                                    Critical ({criticalAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {criticalAlerts.map(alert => <AlertItem key={alert.id} alert={alert} />)}
                                </div>
                            </div>
                        )}

                        {highAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-orange-600">
                                    <AlertTriangle className="w-4 h-4" />
                                    High Priority ({highAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {highAlerts.map(alert => <AlertItem key={alert.id} alert={alert} />)}
                                </div>
                            </div>
                        )}

                        {mediumAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-yellow-600">
                                    <Package className="w-4 h-4" />
                                    Medium Priority ({mediumAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {mediumAlerts.map(alert => <AlertItem key={alert.id} alert={alert} />)}
                                </div>
                            </div>
                        )}

                        {lowAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-600">
                                    <TrendingDown className="w-4 h-4" />
                                    Slow Moving / Obsolete ({lowAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {lowAlerts.map(alert => <AlertItem key={alert.id} alert={alert} />)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}