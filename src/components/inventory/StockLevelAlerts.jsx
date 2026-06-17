import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, Package, MapPin, ShoppingCart, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { getNextDocumentNumber } from "@/components/utils/documentNumberGenerator";

export default function StockLevelAlerts() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [creatingPR, setCreatingPR] = useState(null); // track which alert is mid-creation

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    // Alerts derived from stock
    const alerts = stockLevels.map(stock => {
        const material = materials.find(m => m.material_code === stock.material_code);
        const reorderPoint = parseFloat(material?.reorder_point) || 0;
        const available = parseFloat(stock.available_quantity) || 0;

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

        return alertType ? { ...stock, material, alertType, severity, reorderPoint } : null;
    }).filter(Boolean);

    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts    = alerts.filter(a => a.severity === 'high');
    const mediumAlerts  = alerts.filter(a => a.severity === 'medium');
    const lowAlerts     = alerts.filter(a => a.severity === 'low');

    const createPRMutation = useMutation({
        mutationFn: async (alert) => {
            const prNumber = await getNextDocumentNumber('purchase_requisition');
            const reorderQty = alert.reorderPoint > 0
                ? alert.reorderPoint * 2
                : Math.max(10, (parseFloat(alert.material?.minimum_order_quantity) || 10));
            await matrixSales.entities.PurchaseRequisition.create({
                pr_number:         prNumber,
                pr_date:           new Date().toISOString().slice(0, 10),
                organization_id:   currentOrg?.id,
                material_code:     alert.material_code,
                material_name:     alert.material_name,
                quantity_required: reorderQty,
                unit_of_measure:   alert.material?.unit_of_measure || '',
                required_date:     new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                purpose:           `Auto-generated from low-stock alert — ${alert.alertType.replace(/_/g, ' ')}`,
                priority:          alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'normal',
                status:            'draft',
                notes:             `Stock at ${alert.available_quantity} (reorder point: ${alert.reorderPoint}). Warehouse: ${alert.warehouse_name || '—'}.`,
            });
            return prNumber;
        },
        onSuccess: (prNumber, alert) => {
            queryClient.invalidateQueries({ queryKey: ['requisitions'] });
            toast({
                title: "Purchase Requisition Created",
                description: `${prNumber} created as draft for ${alert.material_name}`,
            });
            setCreatingPR(null);
        },
        onError: (err) => {
            toast({ title: "Failed to create PR", description: err.message, variant: "destructive" });
            setCreatingPR(null);
        },
    });

    const handleCreatePR = (alert) => {
        setCreatingPR(alert.id);
        createPRMutation.mutate(alert);
    };

    const isStockAlert = (a) => ['out_of_stock', 'critically_low', 'low_stock'].includes(a.alertType);

    const AlertItem = ({ alert }) => (
        <div className={`p-3 rounded-lg border ${
            alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
            alert.severity === 'high'     ? 'bg-orange-50 border-orange-200' :
            alert.severity === 'medium'   ? 'bg-yellow-50 border-yellow-200' :
                                            'bg-blue-50 border-blue-200'
        }`}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{alert.material_name}</span>
                        <Badge className={
                            alert.severity === 'critical' ? 'bg-red-600 text-white shrink-0' :
                            alert.severity === 'high'     ? 'bg-orange-600 text-white shrink-0' :
                            alert.severity === 'medium'   ? 'bg-yellow-600 text-white shrink-0' :
                                                            'bg-blue-600 text-white shrink-0'
                        }>
                            {alert.alertType.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{alert.material_code}</div>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            Available: <strong>{alert.available_quantity}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {alert.warehouse_name || '—'}
                        </span>
                        {isStockAlert(alert) && (
                            <span className="text-gray-500">Reorder at: {alert.reorderPoint}</span>
                        )}
                        {!isStockAlert(alert) && (
                            <span className="text-gray-500">Aging: {alert.aging_days} days</span>
                        )}
                    </div>
                </div>

                {isStockAlert(alert) && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                        disabled={creatingPR === alert.id || createPRMutation.isPending}
                        onClick={() => handleCreatePR(alert)}
                    >
                        {creatingPR === alert.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                        )}
                        {creatingPR === alert.id ? 'Creating…' : 'Create PR'}
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Stock Level Alerts
                    </CardTitle>
                    {alerts.length > 0 && (
                        <span className="text-sm text-gray-500">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
                {criticalAlerts.length + highAlerts.length + mediumAlerts.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                        Click <strong>Create PR</strong> on any low-stock alert to auto-generate a Purchase Requisition draft.
                    </p>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                {alerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No stock alerts — all inventory levels are healthy</p>
                    </div>
                ) : (
                    <>
                        {criticalAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                                    <AlertTriangle className="w-4 h-4" />
                                    Critical — Out of Stock ({criticalAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {criticalAlerts.map(a => <AlertItem key={a.id} alert={a} />)}
                                </div>
                            </div>
                        )}

                        {highAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-orange-600">
                                    <AlertTriangle className="w-4 h-4" />
                                    High — Critically Low ({highAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {highAlerts.map(a => <AlertItem key={a.id} alert={a} />)}
                                </div>
                            </div>
                        )}

                        {mediumAlerts.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-yellow-600">
                                    <Package className="w-4 h-4" />
                                    Medium — Below Reorder Point ({mediumAlerts.length})
                                </h4>
                                <div className="space-y-2">
                                    {mediumAlerts.map(a => <AlertItem key={a.id} alert={a} />)}
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
                                    {lowAlerts.map(a => <AlertItem key={a.id} alert={a} />)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
