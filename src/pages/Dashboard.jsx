import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    Package2, 
    TrendingDown, 
    ShoppingCart,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ArrowRight,
    Rocket,
    Shield
} from "lucide-react";
import StatCard from "@/components/erp/StatCard";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/components/utils/usePermissions";
import { useLanguage } from "@/components/utils/languageContext";

export default function Dashboard() {
    const { isAdmin, hasPermission, getRoleNames } = usePermissions();
    const { t } = useLanguage();

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => base44.entities.FixedAsset.list(),
        initialData: []
    });

    const { data: salesOrders = [] } = useQuery({
        queryKey: ['salesOrders'],
        queryFn: () => base44.entities.SalesOrder.list('-order_date', 10),
        initialData: []
    });

    const { data: maintenance = [] } = useQuery({
        queryKey: ['maintenance'],
        queryFn: () => base44.entities.AssetMaintenance.list('-maintenance_date', 20),
        initialData: []
    });

    const { data: approvalRequests = [] } = useQuery({
        queryKey: ['approvalRequests'],
        queryFn: () => base44.entities.ApprovalRequest.list('-created_date', 10),
        initialData: []
    });

    const { data: verificationTasks = [] } = useQuery({
        queryKey: ['verificationTasks'],
        queryFn: () => base44.entities.AssetVerificationTask.list('-scheduled_date', 5),
        initialData: []
    });

    const activeAssets = assets.filter(a => a.status === 'active').length;
    const totalAssetValue = assets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
    const totalNBV = assets.reduce((sum, a) => sum + (a.net_book_value || 0), 0);
    
    const pendingSalesOrders = salesOrders.filter(o => 
        o.status === 'pending_approval' || o.status === 'draft'
    ).length;
    
    const overdueMaintenance = maintenance.filter(m => 
        m.status === 'scheduled' && new Date(m.scheduled_date) < new Date()
    ).length;

    const pendingApprovals = approvalRequests.filter(a => a.status === 'pending').length;
    
    const overdueVerifications = verificationTasks.filter(t => 
        t.status === 'scheduled' && new Date(t.scheduled_date) < new Date()
    ).length;

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t('dashboard')}</h1>
                <p className="text-sm md:text-base text-gray-600 mt-1">Welcome to your ERP System</p>
                {!isAdmin && getRoleNames().length > 0 && (
                    <div className="flex gap-2 mt-2">
                        {getRoleNames().map((roleName, idx) => (
                            <Badge key={idx} variant="outline">
                                {roleName}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {isAdmin && (
                <Card className="border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Rocket className="w-5 h-5 text-emerald-600" />
                                Go-Live Preparation
                            </CardTitle>
                            <Link to={createPageUrl('AdminCenter')}>
                                <Button size="sm" variant="outline">
                                    View Full Checklist
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-700">
                            Complete the setup checklist in Admin Center before going live with the system.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {hasPermission('finance.fixed_asset', 'view') && (
                    <>
                        <StatCard
                            title={`${t('active')} Assets`}
                            value={activeAssets}
                            icon={Package2}
                            trend={`SAR ${(totalAssetValue / 1000000).toFixed(1)}M total value`}
                            color="emerald"
                        />
                        <StatCard
                            title={t('netBookValue')}
                            value={`SAR ${(totalNBV / 1000000).toFixed(1)}M`}
                            icon={TrendingDown}
                            trend="Current valuation"
                            color="blue"
                        />
                    </>
                )}
                
                {hasPermission('sales.sales_order', 'view') && (
                    <StatCard
                        title={`${t('pending')} Sales Orders`}
                        value={pendingSalesOrders}
                        icon={ShoppingCart}
                        trend="Awaiting processing"
                        color="indigo"
                    />
                )}
                
                {(hasPermission('maintenance.work_order', 'view') || hasPermission('finance.fixed_asset', 'view')) && (
                    <StatCard
                        title={`${t('overdue')} ${t('maintenance')}`}
                        value={overdueMaintenance}
                        icon={AlertTriangle}
                        trend="Requires attention"
                        color="red"
                    />
                )}
            </div>

            <div className="space-y-3">
                {pendingApprovals > 0 && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-900">
                            <strong>{pendingApprovals} approval requests</strong> are waiting for your review
                            <Link to={createPageUrl('Approvals')} className="ml-2 underline font-semibold">
                                View {t('approvals')} →
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                {overdueMaintenance > 0 && hasPermission('maintenance.work_order', 'view') && (
                    <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-900">
                            <strong>{overdueMaintenance} {t('maintenance')} tasks</strong> are {t('overdue')}
                            <Link to={createPageUrl('FixedAssets')} className="ml-2 underline font-semibold">
                                View {t('maintenance')} →
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                {overdueVerifications > 0 && hasPermission('finance.fixed_asset', 'view') && (
                    <Alert className="bg-orange-50 border-orange-200">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                            <strong>{overdueVerifications} asset verification tasks</strong> are {t('overdue')}
                            <Link to={createPageUrl('AssetVerification')} className="ml-2 underline font-semibold">
                                View Verifications →
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {hasPermission('finance.fixed_asset', 'view') && (
                    <Link to={createPageUrl('FixedAssets')}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-emerald-100 p-3 rounded-lg">
                                        <Package2 className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{t('fixedAssets')}</p>
                                        <p className="text-sm text-gray-600">{activeAssets} {t('active')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                {hasPermission('sales.sales_order', 'view') && (
                    <Link to={createPageUrl('Sales')}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-100 p-3 rounded-lg">
                                        <ShoppingCart className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Sales Orders</p>
                                        <p className="text-sm text-gray-600">{pendingSalesOrders} {t('pending')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                {hasPermission('maintenance.work_order', 'view') && (
                    <Link to={createPageUrl('Maintenance')}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-yellow-100 p-3 rounded-lg">
                                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{t('maintenance')}</p>
                                        <p className="text-sm text-gray-600">{overdueMaintenance} {t('overdue')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                <Link to={createPageUrl('Approvals')}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="bg-purple-100 p-3 rounded-lg">
                                    <Clock className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="font-semibold">{t('approvals')}</p>
                                    <p className="text-sm text-gray-600">{pendingApprovals} {t('pending')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {hasPermission('finance.fixed_asset', 'view') && (
                    <Link to={createPageUrl('AssetVerification')}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-100 p-3 rounded-lg">
                                        <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{t('assetVerification')}</p>
                                        <p className="text-sm text-gray-600">{overdueVerifications} tasks</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                {isAdmin && (
                    <Link to={createPageUrl('AdminCenter')}>
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-emerald-200">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-emerald-100 p-3 rounded-lg">
                                        <Shield className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{t('adminCenter')}</p>
                                        <p className="text-sm text-gray-600">System config</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}
            </div>
        </div>
    );
}