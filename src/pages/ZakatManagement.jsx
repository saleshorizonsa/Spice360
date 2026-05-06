import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Calculator, FileCheck, Users, Settings, Lock, Download } from "lucide-react";
import StatCard from "../components/erp/StatCard";
import DataTable from "../components/erp/DataTable";
import ZakatConfigForm from "../components/finance/ZakatConfigForm";
import ZakatComputationForm from "../components/finance/ZakatComputationForm";
import ZakatAdjustmentForm from "../components/finance/ZakatAdjustmentForm";
import ShareholderForm from "../components/finance/ShareholderForm";
import GLZakatMappingForm from "../components/finance/GLZakatMappingForm";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions, PermissionGate } from "../components/utils/usePermissions";

export default function ZakatManagement() {
    const [activeTab, setActiveTab] = useState("gl-mapping");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list('account_code'),
        initialData: []
    });

    const { data: shareholders = [] } = useQuery({
        queryKey: ['shareholders'],
        queryFn: () => matrixSales.entities.Shareholder.list('-effective_from'),
        initialData: []
    });

    const { data: configurations = [] } = useQuery({
        queryKey: ['zakatConfigurations'],
        queryFn: () => matrixSales.entities.ZakatConfiguration.list('-fiscal_year'),
        initialData: []
    });

    const { data: computations = [] } = useQuery({
        queryKey: ['zakatComputations'],
        queryFn: () => matrixSales.entities.ZakatComputation.list('-computation_date'),
        initialData: []
    });

    const { data: adjustments = [] } = useQuery({
        queryKey: ['zakatAdjustments'],
        queryFn: () => matrixSales.entities.ZakatAdjustment.list('-adjustment_date'),
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: "Success",
                description: "Deleted successfully",
            });
        }
    });

    const activeShareholders = shareholders.filter(s => s.status === 'active');
    const saudiGCCOwnership = activeShareholders
        .filter(s => s.is_saudi_gcc)
        .reduce((sum, s) => sum + (s.ownership_percentage || 0), 0);

    const zakatableAccounts = chartOfAccounts.filter(a => 
        a.zakat_category && a.zakat_category !== 'not_applicable'
    ).length;

    const unmappedAccounts = chartOfAccounts.filter(a => 
        !a.zakat_category || a.zakat_category === 'not_applicable'
    ).length;

    const activeConfig = configurations.find(c => c.status === 'active');
    const latestComputation = computations.find(c => c.computation_status === 'approved' || c.computation_status === 'locked');

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            draft: "bg-yellow-100 text-yellow-800",
            computed: "bg-blue-100 text-blue-800",
            reviewed: "bg-indigo-100 text-indigo-800",
            approved: "bg-green-100 text-green-800",
            locked: "bg-purple-100 text-purple-800",
            closed: "bg-gray-100 text-gray-800",
            pending: "bg-yellow-100 text-yellow-800",
            rejected: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const glAccountColumns = [
        { header: "Account Code", key: "account_code" },
        { header: "Account Name", key: "account_name" },
        { header: "Account Type", key: "account_type", isBadge: true },
        { header: "Zakat Category", key: "zakat_category", isBadge: true },
        { header: "Zakat Subcategory", key: "zakat_subcategory" },
        { header: "Related Party", key: "is_related_party_account", render: (val) => val ? "✓" : "✗" }
    ];

    const shareholderColumns = [
        { header: "Shareholder ID", key: "shareholder_id" },
        { header: "Shareholder Name", key: "shareholder_name" },
        { header: "Nationality", key: "nationality" },
        { header: "Saudi/GCC", key: "is_saudi_gcc", render: (val) => val ? "✓" : "✗" },
        { header: "Ownership %", key: "ownership_percentage", render: (val) => `${val}%` },
        { header: "Effective From", key: "effective_from" },
        { header: "Status", key: "status", isBadge: true }
    ];

    const configColumns = [
        { header: "Config ID", key: "config_id" },
        { header: "Fiscal Year", key: "fiscal_year" },
        { header: "Zakat Rate %", key: "zakat_rate" },
        { header: "Method", key: "computation_method" },
        { header: "Saudi/GCC %", key: "saudi_gcc_ownership_percent", render: (val) => `${val}%` },
        { header: "Status", key: "status", isBadge: true }
    ];

    const computationColumns = [
        { header: "Computation ID", key: "computation_id" },
        { header: "Fiscal Year", key: "fiscal_year" },
        { header: "Period End", key: "period_end_date" },
        { header: "Net Zakat Base (SAR)", key: "net_zakat_base", render: (val) => val?.toLocaleString() },
        { header: "Zakat Due (SAR)", key: "annual_zakat_due", render: (val) => val?.toLocaleString() },
        { header: "Status", key: "computation_status", isBadge: true }
    ];

    const adjustmentColumns = [
        { header: "Adjustment ID", key: "adjustment_id" },
        { header: "Fiscal Year", key: "fiscal_year" },
        { header: "Type", key: "adjustment_type", isBadge: true },
        { header: "Category", key: "adjustment_category" },
        { header: "Amount (SAR)", key: "adjustment_amount", render: (val) => val?.toLocaleString() },
        { header: "Evidence", key: "evidence_provided", render: (val) => val ? "✓" : "✗" },
        { header: "Approval", key: "approval_status", isBadge: true }
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

    const handleDelete = (item, entity) => {
        if (confirm("Are you sure you want to delete this item?")) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    if (permissionsLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!hasPermission('finance.fixed_asset', 'view') && !isAdmin) {
        return (
            <div className="p-6">
                <Card className="border-red-200">
                    <CardContent className="pt-6">
                        <div className="text-center py-12">
                            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                            <p className="text-gray-600 mb-4">
                                You don't have permission to access Zakat Management
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
                    <h1 className="text-3xl font-bold text-gray-900">Zakat Management</h1>
                    <p className="text-gray-600 mt-1">Net Zakat Base computation, GL mapping & ZATCA audit reports</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export ZATCA Report
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Saudi/GCC Ownership"
                    value={`${saudiGCCOwnership.toFixed(1)}%`}
                    icon={Users}
                    trend={`${activeShareholders.filter(s => s.is_saudi_gcc).length} shareholders`}
                    color="emerald"
                />
                <StatCard
                    title="GL Accounts Mapped"
                    value={zakatableAccounts}
                    icon={FileCheck}
                    trend={`${unmappedAccounts} unmapped`}
                    color={unmappedAccounts > 0 ? "amber" : "blue"}
                />
                <StatCard
                    title="Zakat Rate"
                    value={`${activeConfig?.zakat_rate || 2.5}%`}
                    icon={Calculator}
                    trend={activeConfig?.fiscal_year || "No active config"}
                    color="indigo"
                />
                <StatCard
                    title="Latest Zakat Due"
                    value={latestComputation ? `SAR ${(latestComputation.annual_zakat_due / 1000).toFixed(0)}K` : "N/A"}
                    icon={Settings}
                    trend={latestComputation?.computation_status || "Not computed"}
                    color="emerald"
                />
            </div>

            {unmappedAccounts > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-amber-900">
                        <strong>{unmappedAccounts} GL accounts</strong> are not mapped to Zakat categories. Please review and update GL mapping.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="gl-mapping">GL Mapping</TabsTrigger>
                    <TabsTrigger value="shareholders">Shareholders</TabsTrigger>
                    <TabsTrigger value="configuration">Configuration</TabsTrigger>
                    <TabsTrigger value="computation">Computation</TabsTrigger>
                    <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                </TabsList>

                <TabsContent value="gl-mapping">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Chart of Accounts - Zakat Mapping</CardTitle>
                            <PermissionGate module="finance.journal_entry" action="create">
                                <Button 
                                    onClick={() => handleCreate('gl-mapping')}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    Bulk Update Mapping
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={chartOfAccounts}
                                columns={glAccountColumns}
                                searchFields={["account_code", "account_name"]}
                                filterOptions={[
                                    {
                                        field: "zakat_category",
                                        label: "Zakat Category",
                                        values: [
                                            { value: "zakatable_asset", label: "Zakatable Asset" },
                                            { value: "non_zakatable_asset", label: "Non-Zakatable Asset" },
                                            { value: "deductible_liability", label: "Deductible Liability" },
                                            { value: "non_deductible_liability", label: "Non-Deductible Liability" },
                                            { value: "add_back", label: "Add-back" },
                                            { value: "allowed_deduction", label: "Allowed Deduction" },
                                            { value: "not_applicable", label: "Not Applicable" }
                                        ]
                                    }
                                ]}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.journal_entry', 'edit') ? (item) => handleEdit(item, 'gl-mapping') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="shareholders">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Shareholder Ownership Structure</CardTitle>
                            <PermissionGate module="finance.journal_entry" action="create">
                                <Button 
                                    onClick={() => handleCreate('shareholders')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Shareholder
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={shareholders}
                                columns={shareholderColumns}
                                searchFields={["shareholder_id", "shareholder_name", "id_number"]}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.journal_entry', 'edit') ? (item) => handleEdit(item, 'shareholders') : null}
                                onDelete={hasPermission('finance.journal_entry', 'delete') ? (item) => handleDelete(item, 'Shareholder') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="configuration">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Zakat Configuration</CardTitle>
                            <PermissionGate module="finance.journal_entry" action="create">
                                <Button 
                                    onClick={() => handleCreate('configuration')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Configuration
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={configurations}
                                columns={configColumns}
                                searchFields={["config_id", "fiscal_year"]}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.journal_entry', 'edit') ? (item) => handleEdit(item, 'configuration') : null}
                                onDelete={hasPermission('finance.journal_entry', 'delete') ? (item) => handleDelete(item, 'ZakatConfiguration') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="computation">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Zakat Computation</CardTitle>
                            <PermissionGate module="finance.journal_entry" action="create">
                                <Button 
                                    onClick={() => handleCreate('computation')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Calculator className="w-4 h-4 mr-2" />
                                    Run Computation
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={computations}
                                columns={computationColumns}
                                searchFields={["computation_id", "fiscal_year"]}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.journal_entry', 'edit') ? (item) => handleEdit(item, 'computation') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="adjustments">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Zakat Adjustments</CardTitle>
                            <PermissionGate module="finance.journal_entry" action="create">
                                <Button 
                                    onClick={() => handleCreate('adjustments')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Adjustment
                                </Button>
                            </PermissionGate>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={adjustments}
                                columns={adjustmentColumns}
                                searchFields={["adjustment_id", "gl_account_code", "source_document_number"]}
                                filterOptions={[
                                    {
                                        field: "adjustment_type",
                                        label: "Adjustment Type",
                                        values: [
                                            { value: "add_back", label: "Add-back" },
                                            { value: "deduction", label: "Deduction" },
                                            { value: "non_zakatable", label: "Non-Zakatable" },
                                            { value: "evidence_required", label: "Evidence Required" }
                                        ]
                                    }
                                ]}
                                getBadgeColor={getBadgeColor}
                                onEdit={hasPermission('finance.journal_entry', 'edit') ? (item) => handleEdit(item, 'adjustments') : null}
                                onDelete={hasPermission('finance.journal_entry', 'delete') ? (item) => handleDelete(item, 'ZakatAdjustment') : null}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === 'gl-mapping' && (
                <GLZakatMappingForm 
                    item={editingItem} 
                    accounts={chartOfAccounts}
                    onClose={handleCloseDialog} 
                />
            )}
            {showDialog && activeTab === 'shareholders' && (
                <ShareholderForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'configuration' && (
                <ZakatConfigForm item={editingItem} shareholders={shareholders} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'computation' && (
                <ZakatComputationForm 
                    item={editingItem} 
                    configuration={activeConfig}
                    chartOfAccounts={chartOfAccounts}
                    onClose={handleCloseDialog} 
                />
            )}
            {showDialog && activeTab === 'adjustments' && (
                <ZakatAdjustmentForm 
                    item={editingItem}
                    computations={computations}
                    chartOfAccounts={chartOfAccounts}
                    onClose={handleCloseDialog} 
                />
            )}
        </div>
    );
}