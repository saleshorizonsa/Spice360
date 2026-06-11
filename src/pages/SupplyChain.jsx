import React from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Package, Factory, Truck, Users } from "lucide-react";
import { useLanguage } from "../components/utils/languageContext";

export default function SupplyChain() {
    const { t } = useLanguage();
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

    const { data: sales = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: () => matrixSales.entities.SalesOrder.list(),
        initialData: []
    });

    const stages = [
        {
            name: "Procurement",
            icon: Package,
            count: purchases.length,
            active: purchases.filter(p => p.status === 'in_transit').length,
            color: "bg-blue-500"
        },
        {
            name: "Production",
            icon: Factory,
            count: productions.length,
            active: productions.filter(p => p.status === 'in_progress').length,
            color: "bg-purple-500"
        },
        {
            name: "Distribution",
            icon: Truck,
            count: sales.length,
            active: sales.filter(s => s.status === 'shipped').length,
            color: "bg-emerald-500"
        },
        {
            name: "Customers",
            icon: Users,
            count: sales.filter(s => s.status === 'delivered').length,
            active: sales.filter(s => s.status === 'delivered').length,
            color: "bg-indigo-500"
        }
    ];

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t('supplyChainMgmt')}</h1>
                <p className="text-gray-600 mt-1">{t('endToEndVisibility')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {stages.map((stage, idx) => {
                    const Icon = stage.icon;
                    return (
                        <React.Fragment key={stage.name}>
                            <Card className="relative hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`${stage.color} p-3 rounded-lg`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                                            <p className="text-2xl font-bold text-gray-900 mt-1">{stage.count}</p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {stage.active} active
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                                {idx < stages.length - 1 && (
                                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden lg:block">
                                        <ArrowRight className="w-6 h-6 text-gray-400" />
                                    </div>
                                )}
                            </Card>
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('recentPurchaseOrders')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {purchases.slice(0, 5).map(po => (
                                <div key={po.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-gray-900">{po.material_name}</p>
                                        <p className="text-sm text-gray-600">{po.supplier_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">LKR {po.total_cost?.toLocaleString() || 0}</p>
                                        <p className="text-sm text-gray-600 capitalize">{po.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('recentSalesOrders')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {sales.slice(0, 5).map(so => (
                                <div key={so.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-gray-900">{so.product_name}</p>
                                        <p className="text-sm text-gray-600">{so.customer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">LKR {so.total_amount?.toLocaleString() || 0}</p>
                                        <p className="text-sm text-gray-600 capitalize">{so.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}