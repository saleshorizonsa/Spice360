import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Package2, UserCheck, Wrench, Construction, TrendingDown, Calculator, AlertTriangle, QrCode, Scan, Calendar, FileText, Lock } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import FixedAssetForm from "../components/finance/FixedAssetForm";
import AssetAllocationForm from "../components/assets/AssetAllocationForm";
import AssetMaintenanceForm from "../components/assets/AssetMaintenanceForm";
import AUCForm from "../components/assets/AUCForm";
import AUCExpenditureForm from "../components/assets/AUCExpenditureForm";
import AssetCard from "../components/assets/AssetCard";
import AssetDepreciationCard from "../components/assets/AssetDepreciationCard";
import AssetTagPrint from "../components/assets/AssetTagPrint";
import DepreciationScheduleViewer from "../components/assets/DepreciationScheduleViewer";
import DepreciationReport from "../components/assets/DepreciationReport";
import AssetDisposalForm from "../components/assets/AssetDisposalForm";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { runMonthlyDepreciation } from "../components/utils/depreciationCalculator";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { usePermissions, PermissionGate } from "../components/utils/usePermissions";
import { useLanguage } from "../components/utils/languageContext";
import { useOrganization } from "../components/utils/OrganizationContext";
import { postJournalEntry } from "../components/utils/journalService";
import { useGLAccounts } from "@/hooks/useGLAccounts";

export default function FixedAssets() {
    const [activeTab, setActiveTab] = useState("assets");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isRunningDepreciation, setIsRunningDepreciation] = useState(false);
    const [viewMode, setViewMode] = useState('table');
    const [selectedAUC, setSelectedAUC] = useState(null);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState([]);
    const [assetsToPrint, setAssetsToPrint] = useState([]);
    const [showScheduleDialog, setShowScheduleDialog] = useState(false);
    const [scheduleAsset, setScheduleAsset] = useState(null);
    const [showDepreciationReport, setShowDepreciationReport] = useState(false);
    const [showDisposalDialog, setShowDisposalDialog] = useState(false);
    const [disposalAsset, setDisposalAsset] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
    const { t } = useLanguage();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list('-acquisition_date'),
        initialData: []
    });

    const { data: allocations = [] } = useQuery({
        queryKey: ['allocations'],
        queryFn: () => matrixSales.entities.AssetAllocation.list('-allocation_date'),
        initialData: []
    });

    const { data: maintenance = [] } = useQuery({
        queryKey: ['maintenance'],
        queryFn: () => matrixSales.entities.AssetMaintenance.list('-maintenance_date'),
        initialData: []
    });

    const { data: aucs = [] } = useQuery({
        queryKey: ['aucs'],
        queryFn: () => matrixSales.entities.AssetUnderConstruction.list('-start_date'),
        initialData: []
    });

    const { data: depreciation = [] } = useQuery({
        queryKey: ['depreciation'],
        queryFn: () => matrixSales.entities.AssetDepreciation.list('-depreciation_date'),
        initialData: []
    });

    const { data: aucExpenditures = [] } = useQuery({
        queryKey: ['aucExpenditures'],
        queryFn: () => matrixSales.entities.AUCExpenditure.list('-expenditure_date'),
        initialData: []
    });

    const { data: disposals = [] } = useQuery({
        queryKey: ['disposals'],
        queryFn: () => matrixSales.entities.AssetDisposal.list('-disposal_date'),
        initialData: []
    });

    const totalAssetValue = assets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
    const totalNBV = assets.reduce((sum, a) => sum + (a.net_book_value || 0), 0);
    const totalAccumulatedDep = assets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
    const activeAssets = assets.filter(a => a.status === 'active').length;
    const underMaintenance = assets.filter(a => a.status === 'under_maintenance').length;
    const activeAllocations = allocations.filter(a => a.status === 'active').length;
    const overdueMaintenance = maintenance.filter(m => 
        m.status === 'scheduled' && new Date(m.scheduled_date) < new Date()
    ).length;
    const aucInProgress = aucs.filter(a => a.status === 'in_progress').length;
    const totalAUCValue = aucs.reduce((sum, a) => sum + (a.total_actual_cost || 0), 0);

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully'),
            });
        }
    });

    const handleRunDepreciation = async () => {
        if (!hasPermission('finance.fixed_asset', 'depreciation_run')) {
            toast({
                title: t('error'),
                description: "You don't have permission to run depreciation",
                variant: "destructive"
            });
            return;
        }

        if (!confirm("Run depreciation for current period? This will create depreciation entries for all active assets.")) return;
        
        setIsRunningDepreciation(true);
        try {
            const currentDate = new Date();
            const fiscalYear = String(currentDate.getFullYear());
            const period = String(currentDate.getMonth() + 1).padStart(2, '0');
            
            const depEntries = await runMonthlyDepreciation(
                assets.filter(a => a.status === 'active'),
                fiscalYear,
                period
            );
            
            for (const entry of depEntries) {
                await matrixSales.entities.AssetDepreciation.create(entry);
                
                const asset = assets.find(a => a.asset_number === entry.asset_number);
                if (asset) {
                    await matrixSales.entities.FixedAsset.update(asset.id, {
                        accumulated_depreciation: entry.accumulated_depreciation,
                        net_book_value: entry.net_book_value
                    });
                }
            }

            const totalDepreciation = depEntries.reduce((sum, entry) => sum + (entry.depreciation_amount || 0), 0);
            if (totalDepreciation > 0) {
                await postJournalEntry({
                    lines: [
                        { account_code: gl.depreciation_exp,   account_name: 'Depreciation Expense',      debit: totalDepreciation, credit: 0 },
                        { account_code: gl.accum_depreciation, account_name: 'Accumulated Depreciation',  debit: 0, credit: totalDepreciation }
                    ],
                    referenceType: 'asset_depreciation',
                    referenceId: `${fiscalYear}-${period}`,
                    description: `Monthly depreciation ${fiscalYear}-${period}`,
                    entryDate: `${fiscalYear}-${period}-01`,
                    entryType: 'depreciation',
                    orgId: currentOrg?.id,
                    area: "assets"
                });
            }
            
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: `Depreciation posted for ${depEntries.length} assets - LKR ${depEntries.reduce((sum, e) => sum + e.depreciation_amount, 0).toLocaleString()}`,
            });
        } catch (error) {
            console.error('Error running depreciation:', error);
            toast({
                title: t('error'),
                description: "Failed to run depreciation",
                variant: "destructive"
            });
        } finally {
            setIsRunningDepreciation(false);
        }
    };

    const handleViewSchedule = (asset) => {
        setScheduleAsset(asset);
        setShowScheduleDialog(true);
    };

    const handleDisposeAsset = (asset) => {
        if (!hasPermission('finance.fixed_asset', 'dispose')) {
            toast({
                title: "Access Denied",
                description: "You don't have permission to dispose assets",
                variant: "destructive"
            });
            return;
        }

        if (asset.status !== 'active') {
            toast({
                title: "Cannot Dispose",
                description: "Only active assets can be disposed",
                variant: "destructive"
            });
            return;
        }
        setDisposalAsset(asset);
        setShowDisposalDialog(true);
    };

    const handlePrintAssetTags = (assetsForPrint) => {
        if (!assetsForPrint || assetsForPrint.length === 0) {
            toast({
                title: "No Assets Selected",
                description: "Please select at least one asset to print tags",
                variant: "destructive"
            });
            return;
        }
        setAssetsToPrint(assetsForPrint);
        setShowPrintDialog(true);
    };

    const handlePrintSelectedTags = () => {
        const selected = assets.filter(a => selectedAssets.includes(a.id));
        handlePrintAssetTags(selected);
    };

    const handleToggleAssetSelection = (assetId) => {
        setSelectedAssets(prev => 
            prev.includes(assetId) 
                ? prev.filter(id => id !== assetId)
                : [...prev, assetId]
        );
    };

    const handleSelectAllAssets = () => {
        if (selectedAssets.length === assets.length) {
            setSelectedAssets([]);
        } else {
            setSelectedAssets(assets.map(a => a.id));
        }
    };

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            disposed: "bg-gray-100 text-gray-800",
            sold: "bg-blue-100 text-blue-800",
            retired: "bg-purple-100 text-purple-800",
            under_maintenance: "bg-yellow-100 text-yellow-800",
            returned: "bg-green-100 text-green-800",
            transferred: "bg-blue-100 text-blue-800",
            lost: "bg-red-100 text-red-800",
            damaged: "bg-red-100 text-red-800",
            scheduled: "bg-blue-100 text-blue-800",
            in_progress: "bg-indigo-100 text-indigo-800",
            completed: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
            overdue: "bg-red-100 text-red-800",
            planned: "bg-gray-100 text-gray-800",
            on_hold: "bg-yellow-100 text-yellow-800",
            capitalized: "bg-green-100 text-green-800",
            low: "bg-blue-100 text-blue-800",
            medium: "bg-yellow-100 text-yellow-800",
            high: "bg-orange-100 text-orange-800",
            critical: "bg-red-100 text-red-800",
            excellent: "bg-green-100 text-green-800",
            good: "bg-emerald-100 text-emerald-800",
            fair: "bg-yellow-100 text-yellow-800",
            poor: "bg-red-100 text-red-800",
            pending: "bg-yellow-100 text-yellow-800",
            paid: "bg-green-100 text-green-800",
            partially_paid: "bg-blue-100 text-blue-800",
            pending_approval: "bg-yellow-100 text-yellow-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const assetColumns = [
        { 
            header: () => (
                <Checkbox 
                    checked={selectedAssets.length === assets.length && assets.length > 0}
                    onCheckedChange={handleSelectAllAssets}
                />
            ), 
            key: "select",
            render: (val, row) => (
                <Checkbox 
                    checked={selectedAssets.includes(row.id)}
                    onCheckedChange={() => handleToggleAssetSelection(row.id)}
                />
            )
        },
        { header: t('assetTag'), key: "asset_tag", render: (val) => <span className="font-mono text-xs">{val}</span> },
        { header: t('assetNumber'), key: "asset_number" },
        { header: t('assetName'), key: "asset_name" },
        { header: t('assetClass'), key: "asset_class" },
        { header: `${t('acquisitionCost')} (LKR)`, key: "acquisition_cost", render: (val) => val?.toLocaleString() },
        { header: `${t('netBookValue')} (LKR)`, key: "net_book_value", render: (val) => val?.toLocaleString() },
        { header: t('location'), key: "location_code" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const assetSearchFields = ["asset_tag", "asset_number", "asset_name", "location_code", "responsible_person", "serial_number"];
    const assetFilters = [
        {
            field: "asset_class",
            label: t('assetClass'),
            values: [
                { value: "land", label: t('land') },
                { value: "building", label: t('building') },
                { value: "machinery", label: t('machinery') },
                { value: "equipment", label: t('equipment') },
                { value: "vehicles", label: t('vehicles') }
            ]
        }
    ];

    const allocationColumns = [
        { header: "Allocation ID", key: "allocation_id" },
        { header: t('assetNumber'), key: "asset_number" },
        { header: t('assetName'), key: "asset_name" },
        { header: "Allocation Date", key: "allocation_date" },
        { header: t('type'), key: "allocation_type" },
        { header: "Allocated To", key: "allocated_to_employee_name" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const maintenanceColumns = [
        { header: "Maintenance ID", key: "maintenance_id" },
        { header: t('assetNumber'), key: "asset_number" },
        { header: t('type'), key: "maintenance_type" },
        { header: "Scheduled", key: "scheduled_date" },
        { header: `${t('cost')} (LKR)`, key: "total_cost", render: (val) => val?.toLocaleString() },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const aucColumns = [
        { header: "AUC #", key: "auc_number" },
        { header: "AUC Name", key: "auc_name" },
        { header: `${t('budgeted')} (LKR)`, key: "total_budgeted_cost", render: (val) => val?.toLocaleString() },
        { header: `${t('actualCost')} (LKR)`, key: "total_actual_cost", render: (val) => val?.toLocaleString() },
        { header: "Completion %", key: "completion_percentage", render: (val) => `${val}%` },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const aucExpColumns = [
        { header: "Expenditure ID", key: "expenditure_id" },
        { header: "AUC #", key: "auc_number" },
        { header: t('date'), key: "expenditure_date" },
        { header: t('type'), key: "expenditure_type" },
        { header: `${t('amount')} (LKR)`, key: "amount", render: (val) => val?.toLocaleString() },
        { header: "Payment", key: "payment_status", isBadge: true }
    ];

    const depreciationColumns = [
        { header: t('assetNumber'), key: "asset_number" },
        { header: "Year", key: "fiscal_year" },
        { header: "Period", key: "period" },
        { header: `${t('depreciationAmount')} (LKR)`, key: "depreciation_amount", render: (val) => val?.toLocaleString() },
        { header: `${t('netBookValue')} (LKR)`, key: "net_book_value", render: (val) => val?.toLocaleString() },
        { header: "Posted", key: "gl_posted", render: (val) => val ? "✓" : "✗" }
    ];

    const disposalColumns = [
        { header: "Disposal ID", key: "disposal_id" },
        { header: t('assetNumber'), key: "asset_number" },
        { header: t('assetName'), key: "asset_name" },
        { header: t('type'), key: "disposal_type", isBadge: true },
        { header: t('date'), key: "disposal_date" },
        { header: `${t('netBookValue')} (LKR)`, key: "net_book_value", render: (val) => val?.toLocaleString() },
        { header: `${t('disposalValue')} (LKR)`, key: "disposal_value", render: (val) => val?.toLocaleString() },
        { 
            header: "Gain/Loss", 
            key: "gain_loss", 
            render: (val) => (
                <span className={val >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                    {val >= 0 ? '+' : ''}{val?.toLocaleString()}
                </span>
            )
        },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleAllocateAsset = (asset) => {
        setEditingItem({ asset_number: asset.asset_number, asset_name: asset.asset_name });
        setActiveTab('allocations');
        setShowDialog(true);
    };

    const handleScheduleMaintenance = (asset) => {
        setEditingItem({ asset_number: asset.asset_number, asset_name: asset.asset_name });
        setActiveTab('maintenance');
        setShowDialog(true);
    };

    const handleAddAUCExpenditure = (aucNumber) => {
        setSelectedAUC(aucNumber);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (confirm(t('areYouSure'))) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
        setSelectedAUC(null);
    };

    // Show loading state while permissions are being fetched
    if (permissionsLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">{t('loading')}</p>
                </div>
            </div>
        );
    }

    // Check if user has any fixed asset permissions
    if (!hasPermission('finance.fixed_asset', 'view') && !isAdmin) {
        return (
            <div className="p-6">
                <Card className="border-red-200">
                    <CardContent className="pt-6">
                        <div className="text-center py-12">
                            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('accessDenied')}</h2>
                            <p className="text-gray-600 mb-4">
                                {t('noFixedAssetPermission')}
                            </p>
                            <p className="text-sm text-gray-500">
                                {t('contactAdminForAccess')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('fixedAssets')}</h1>
                    <p className="text-gray-600 mt-1">Track assets, depreciation, allocations, maintenance & lifecycle</p>
                </div>
                <div className="flex gap-2">
                    <Link to={createPageUrl('AssetLifecycle')}>
                        <Button variant="outline" className="gap-2">
                            <TrendingDown className="w-4 h-4" />
                            {t('assetLifecycle')}
                        </Button>
                    </Link>
                    <Link to={createPageUrl('AssetScanner')}>
                        <Button variant="outline" className="gap-2">
                            <Scan className="w-4 h-4" />
                            {t('assetScanner')}
                        </Button>
                    </Link>
                    <Link to={createPageUrl('AssetVerification')}>
                        <Button variant="outline" className="gap-2">
                            <QrCode className="w-4 h-4" />
                            {t('assetVerification')}
                        </Button>
                    </Link>
                    <PermissionGate module="finance.fixed_asset" action="depreciation_run">
                        <Button 
                            onClick={handleRunDepreciation}
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={isRunningDepreciation}
                        >
                            <Calculator className="w-4 h-4 mr-2" />
                            {isRunningDepreciation ? t('running') : t('runDepreciation')}
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {(overdueMaintenance > 0 || underMaintenance > 0) && (
                <div className="space-y-2">
                    {overdueMaintenance > 0 && (
                        <Alert className="bg-red-50 border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-900">
                                <strong>{overdueMaintenance} {t('maintenance')} tasks</strong> are {t('overdue')}
                            </AlertDescription>
                        </Alert>
                    )}
                    {underMaintenance > 0 && (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <Wrench className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                                <strong>{underMaintenance} assets</strong> under {t('maintenance')}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="assets">{t('assets')}</TabsTrigger>
                    <TabsTrigger value="disposals">{t('disposals')}</TabsTrigger>
                    <TabsTrigger value="allocations">{t('allocations')}</TabsTrigger>
                    <TabsTrigger value="maintenance">{t('maintenance')}</TabsTrigger>
                    <TabsTrigger value="aucs">{t('auc')}</TabsTrigger>
                    <TabsTrigger value="auc-exp">{t('aucExp')}</TabsTrigger>
                    <TabsTrigger value="depreciation">{t('depreciation')}</TabsTrigger>
                </TabsList>

                <TabsContent value="assets">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('fixedAssetRegister')}</CardTitle>
                            <div className="flex gap-2">
                                {selectedAssets.length > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={handlePrintSelectedTags}
                                        className="gap-2"
                                    >
                                        <QrCode className="w-4 h-4" />
                                        {t('print')} {selectedAssets.length} {t('tag')}{selectedAssets.length > 1 ? 's' : ''}
                                    </Button>
                                )}
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                >
                                    {t('table')}
                                </Button>
                                <Button
                                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('cards')}
                                >
                                    {t('cards')}
                                </Button>
                                <PermissionGate module="finance.fixed_asset" action="create">
                                    <Button 
                                        onClick={() => handleCreate('assets')}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        {t('new')} {t('asset')}
                                    </Button>
                                </PermissionGate>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {viewMode === 'table' ? (
                                <DataTable
                                    data={assets}
                                    columns={assetColumns}
                                    searchFields={assetSearchFields}
                                    filterOptions={assetFilters}
                                    getBadgeColor={getBadgeColor}
                                    onEdit={hasPermission('finance.fixed_asset', 'edit') ? (item) => handleEdit(item, 'assets') : null}
                                    onDelete={hasPermission('finance.fixed_asset', 'delete') ? (item) => handleDelete(item, 'FixedAsset') : null}
                                    onPrint={(item) => handlePrintAssetTags([item])}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {assets.map((asset) => (
                                        <AssetCard 
                                            key={asset.id} 
                                            asset={asset}
                                            onEdit={hasPermission('finance.fixed_asset', 'edit') ? (item) => handleEdit(item, 'assets') : null}
                                            onAllocate={hasPermission('finance.fixed_asset', 'allocate') ? handleAllocateAsset : null}
                                            onMaintenance={hasPermission('maintenance.work_order', 'create') ? handleScheduleMaintenance : null}
                                            onPrintTag={(item) => handlePrintAssetTags([item])}
                                            onDispose={hasPermission('finance.fixed_asset', 'dispose') ? handleDisposeAsset : null}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="disposals">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('assetDisposals')}</CardTitle>
                            <PermissionGate module="finance.fixed_asset" action="dispose">
                                <Select
                                    value=""
                                    onValueChange={(assetId) => {
                                        const asset = assets.find(a => a.id === assetId);
                                        if (asset) handleDisposeAsset(asset);
                                    }}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder={t('disposeAnAssetPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assets.filter(a => a.status === 'active').map(asset => (
                                            <SelectItem key={asset.id} value={asset.id}>
                                                {asset.asset_number} - {asset.asset_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={disposals}
                                columns={disposalColumns}
                                searchFields={["disposal_id", "asset_number", "asset_name", "buyer_name"]}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="allocations">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('assetAllocations')}</CardTitle>
                            <PermissionGate module="finance.fixed_asset" action="allocate">
                                <Button 
                                    onClick={() => handleCreate('allocations')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('allocateAsset')}
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={allocations}
                                columns={allocationColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.fixed_asset', 'edit') ? (item) => handleEdit(item, 'allocations') : null}
                                onDelete={hasPermission('finance.fixed_asset', 'delete') ? (item) => handleDelete(item, 'AssetAllocation') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="maintenance">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('maintenanceSchedule')}</CardTitle>
                            <PermissionGate module="maintenance.work_order" action="create">
                                <Button 
                                    onClick={() => handleCreate('maintenance')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('scheduleMaintenance')}
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={maintenance}
                                columns={maintenanceColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('maintenance.work_order', 'edit') ? (item) => handleEdit(item, 'maintenance') : null}
                                onDelete={hasPermission('maintenance.work_order', 'delete') ? (item) => handleDelete(item, 'AssetMaintenance') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="aucs">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('assetsUnderConstruction')}</CardTitle>
                            <PermissionGate module="finance.fixed_asset" action="create">
                                <Button 
                                    onClick={() => handleCreate('aucs')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('new')} AUC
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={aucs}
                                columns={aucColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.fixed_asset', 'edit') ? (item) => handleEdit(item, 'aucs') : null}
                                onDelete={hasPermission('finance.fixed_asset', 'delete') ? (item) => handleDelete(item, 'AssetUnderConstruction') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="auc-exp">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('aucExpenditures')}</CardTitle>
                            <PermissionGate module="finance.fixed_asset" action="edit">
                                <Select 
                                    value={selectedAUC || ''} 
                                    onValueChange={(val) => {
                                        setSelectedAUC(val);
                                        handleAddAUCExpenditure(val);
                                    }}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder={t('addExpenditureToAucPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {aucs.filter(a => a.status === 'in_progress' || a.status === 'planned').map(auc => (
                                            <SelectItem key={auc.id} value={auc.auc_number}>
                                                {auc.auc_number} - {auc.auc_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={aucExpenditures}
                                columns={aucExpColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="depreciation">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('depreciationAnalysis')}</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDepreciationReport(!showDepreciationReport)}
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    {showDepreciationReport ? t('hide') : t('showReport')}
                                </Button>
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                >
                                    {t('table')}
                                </Button>
                                <Button
                                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setViewMode('cards')}
                                >
                                    {t('cards')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {showDepreciationReport && (
                                <DepreciationReport 
                                    assets={assets.filter(a => a.status === 'active')}
                                    depreciation={depreciation}
                                />
                            )}
                            
                            {viewMode === 'table' ? (
                                <DataTable
                                    data={depreciation}
                                    columns={depreciationColumns}
                                    getBadgeColor={getBadgeColor}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {assets.filter(a => a.status === 'active').map((asset) => (
                                        <div key={asset.id} className="relative">
                                            <AssetDepreciationCard asset={asset} />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="absolute top-2 right-2"
                                                onClick={() => handleViewSchedule(asset)}
                                            >
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {t('schedule')}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === 'assets' && (
                <FixedAssetForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'allocations' && (
                <AssetAllocationForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'maintenance' && (
                <AssetMaintenanceForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'aucs' && (
                <AUCForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && selectedAUC && activeTab === 'auc-exp' && (
                <AUCExpenditureForm aucNumber={selectedAUC} onClose={handleCloseDialog} />
            )}
            {showPrintDialog && (
                <AssetTagPrint 
                    assets={assetsToPrint} 
                    onClose={() => {
                        setShowPrintDialog(false);
                        setAssetsToPrint([]);
                        setSelectedAssets([]);
                    }} 
                />
            )}
            {showScheduleDialog && scheduleAsset && (
                <DepreciationScheduleViewer
                    asset={scheduleAsset}
                    onClose={() => {
                        setShowScheduleDialog(false);
                        setScheduleAsset(null);
                    }}
                />
            )}
            {showDisposalDialog && disposalAsset && (
                <AssetDisposalForm
                    asset={disposalAsset}
                    onClose={() => {
                        setShowDisposalDialog(false);
                        setDisposalAsset(null);
                    }}
                />
            )}
        </div>
    );
}
