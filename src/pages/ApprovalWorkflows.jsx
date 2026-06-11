import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, GitBranch, FileText } from "lucide-react";
import ApprovalWorkflowBuilder from "../components/approvals/ApprovalWorkflowBuilder";
import ApprovalMatrixForm from "../components/approvals/ApprovalMatrixForm";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "../components/utils/usePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { useLanguage } from "../components/utils/languageContext";

export default function ApprovalWorkflows() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("workflows");
    const [showMatrixDialog, setShowMatrixDialog] = useState(false);
    const [editingMatrix, setEditingMatrix] = useState(null);
    const [selectedDocType, setSelectedDocType] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { hasPermission, isAdmin, loading } = usePermissions();

    const { data: approvalMatrices = [] } = useQuery({
        queryKey: ['approvalMatrices'],
        queryFn: () => matrixSales.entities.ApprovalMatrix.list('document_type,approval_level'),
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.ApprovalMatrix.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvalMatrices'] });
            toast({ title: "Success", description: "Approval rule deleted successfully" });
        }
    });

    const saveWorkflowMutation = useMutation({
        mutationFn: async (levels) => {
            // Delete existing matrices for this document type
            const existing = approvalMatrices.filter(m => m.document_type === levels[0]?.document_type);
            await Promise.all(existing.map(m => matrixSales.entities.ApprovalMatrix.delete(m.id)));

            // Create new matrices
            await Promise.all(levels.map(level => {
                if (level.id) {
                    return matrixSales.entities.ApprovalMatrix.update(level.id, level);
                }
                return matrixSales.entities.ApprovalMatrix.create(level);
            }));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvalMatrices'] });
            toast({ title: "Success", description: "Workflow configuration saved successfully" });
            setSelectedDocType(null);
        }
    });

    // Group matrices by document type
    const workflowsByDocType = approvalMatrices.reduce((acc, matrix) => {
        if (!acc[matrix.document_type]) {
            acc[matrix.document_type] = [];
        }
        acc[matrix.document_type].push(matrix);
        return acc;
    }, {});

    const matrixColumns = [
        { header: "Document Type", key: "document_type", isBadge: true },
        { 
            header: "Amount Range (LKR)", 
            key: "threshold_min", 
            render: (val, row) => `${val?.toLocaleString() || 0} - ${row.threshold_max?.toLocaleString() || '∞'}` 
        },
        { header: "Level", key: "approval_level" },
        { header: "Required Role", key: "required_role", isBadge: true },
        { 
            header: "Settings",
            key: "settings",
            render: (val, row) => (
                <div className="flex gap-1">
                    {row.is_mandatory && <Badge variant="outline" className="text-xs">Mandatory</Badge>}
                    {row.parallel_approval && <Badge variant="outline" className="text-xs">Parallel</Badge>}
                    {row.notification_required && <Badge variant="outline" className="text-xs">Notify</Badge>}
                </div>
            )
        },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            purchase_order: "bg-indigo-100 text-indigo-800",
            journal_entry: "bg-teal-100 text-teal-800",
            leave_request: "bg-amber-100 text-amber-800",
            payment: "bg-pink-100 text-pink-800",
            purchase_requisition: "bg-purple-100 text-purple-800",
            vendor_invoice: "bg-orange-100 text-orange-800",
            expense: "bg-violet-100 text-violet-800",
            sales_manager: "bg-emerald-100 text-emerald-800",
            commercial_head: "bg-purple-100 text-purple-800",
            procurement_manager: "bg-indigo-100 text-indigo-800",
            cfo: "bg-red-100 text-red-800",
            controller: "bg-orange-100 text-orange-800",
            hr_manager: "bg-blue-100 text-blue-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin && !hasPermission('admin.approval_matrix', 'view')) {
        return (
            <div className="p-6">
                <Alert className="border-red-200 bg-red-50">
                    <Lock className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                        You don't have permission to manage approval workflows. Please contact your administrator.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t('approvalWorkflowConfig')}</h1>
                <p className="text-gray-600 mt-1">{t('configureMultiLevelDesc')}</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 w-96">
                    <TabsTrigger value="workflows">
                        <GitBranch className="w-4 h-4 mr-2" />
                        {t('workflowBuilder')}
                    </TabsTrigger>
                    <TabsTrigger value="matrix">
                        <Settings className="w-4 h-4 mr-2" />
                        {t('allRules')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="workflows" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(workflowsByDocType).map(([docType, matrices]) => (
                            <Card 
                                key={docType}
                                className="cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => setSelectedDocType(docType)}
                            >
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        {docType.replace(/_/g, ' ').toUpperCase()}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Approval Levels:</span>
                                            <Badge>{matrices.length}</Badge>
                                        </div>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {matrices.slice(0, 3).map((m, idx) => (
                                                <div key={idx} className="flex items-center gap-1">
                                                    <span className="font-medium">L{m.approval_level}:</span>
                                                    <span>{m.required_role}</span>
                                                </div>
                                            ))}
                                            {matrices.length > 3 && (
                                                <p className="text-gray-400">+{matrices.length - 3} more...</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        <Card 
                            className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2"
                            onClick={() => setSelectedDocType('new')}
                        >
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Plus className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600">{t('configureNewWorkflow')}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {selectedDocType && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>Workflow Builder - {selectedDocType !== 'new' ? selectedDocType.replace(/_/g, ' ').toUpperCase() : 'New'}</span>
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedDocType(null)}
                                    >
                                        Close
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ApprovalWorkflowBuilder
                                    documentType={selectedDocType !== 'new' ? selectedDocType : null}
                                    onSave={(levels) => saveWorkflowMutation.mutate(levels)}
                                />
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="matrix">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('allApprovalMatrixRules')}</CardTitle>
                            <Button
                                onClick={() => {
                                    setEditingMatrix(null);
                                    setShowMatrixDialog(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newRule')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={approvalMatrices}
                                columns={matrixColumns}
                                getBadgeColor={getBadgeColor}
                                searchFields={["document_type", "required_role"]}
                                onEdit={(item) => {
                                    setEditingMatrix(item);
                                    setShowMatrixDialog(true);
                                }}
                                onDelete={(item) => {
                                    if (confirm(`Delete this approval rule?`)) {
                                        deleteMutation.mutate(item.id);
                                    }
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showMatrixDialog && (
                <ApprovalMatrixForm
                    item={editingMatrix}
                    onClose={() => {
                        setShowMatrixDialog(false);
                        setEditingMatrix(null);
                    }}
                />
            )}
        </div>
    );
}