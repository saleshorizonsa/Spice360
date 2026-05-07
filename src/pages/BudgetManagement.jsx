import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calculator, TrendingUp, AlertCircle, FileText, CheckCircle, XCircle } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import BudgetManagementForm from "../components/finance/BudgetManagementForm";
import BudgetVarianceReport from "../components/finance/BudgetVarianceReport";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BudgetManagement() {
    const [activeTab, setActiveTab] = useState("budgets");
    const [showForm, setShowForm] = useState(false);
    const [editingBudget, setEditingBudget] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [filterDepartment, setFilterDepartment] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: budgets = [] } = useQuery({
        queryKey: ['budgets'],
        queryFn: () => matrixSales.entities.Budget.list('-fiscal_period'),
        initialData: []
    });

    const { data: approvalRequests = [] } = useQuery({
        queryKey: ['approvals'],
        queryFn: async () => {
            const all = await matrixSales.entities.ApprovalRequest.list('-submission_date');
            return all.filter(a => a.document_type === 'budget');
        },
        initialData: []
    });

    // Filter budgets
    const filteredBudgets = budgets.filter(b => {
        const yearMatch = b.fiscal_year === selectedYear;
        const deptMatch = filterDepartment === 'all' || b.department === filterDepartment;
        const statusMatch = filterStatus === 'all' || b.status === filterStatus;
        return yearMatch && deptMatch && statusMatch;
    });

    // Get unique departments
    const departments = [...new Set(budgets.map(b => b.department).filter(Boolean))];

    // Calculate summary statistics
    const totalBudgeted = filteredBudgets.reduce((sum, b) => sum + (b.budgeted_amount || 0), 0);
    const totalActual = filteredBudgets.reduce((sum, b) => sum + (b.actual_amount || 0), 0);
    const totalVariance = totalActual - totalBudgeted;
    const approvedBudgets = filteredBudgets.filter(b => b.status === 'approved').length;
    const pendingApproval = approvalRequests.filter(a => a.status === 'pending').length;

    const approveMutation = useMutation({
        mutationFn: async (approvalRequestId) => {
            const approval = approvalRequests.find(a => a.id === approvalRequestId);
            const budget = budgets.find(b => b.budget_id === approval.document_number);
            
            // Update approval request
            await matrixSales.entities.ApprovalRequest.update(approvalRequestId, {
                ...approval,
                status: 'approved',
                approval_date: new Date().toISOString().split('T')[0]
            });

            // Update budget status
            if (budget) {
                await matrixSales.entities.Budget.update(budget.id, {
                    ...budget,
                    status: 'approved'
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            queryClient.invalidateQueries({ queryKey: ['approvals'] });
            toast({ title: "Success", description: "Budget approved successfully" });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async (approvalRequestId) => {
            const approval = approvalRequests.find(a => a.id === approvalRequestId);
            const budget = budgets.find(b => b.budget_id === approval.document_number);
            
            await matrixSales.entities.ApprovalRequest.update(approvalRequestId, {
                ...approval,
                status: 'rejected',
                approval_date: new Date().toISOString().split('T')[0]
            });

            if (budget) {
                await matrixSales.entities.Budget.update(budget.id, {
                    ...budget,
                    status: 'draft'
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            queryClient.invalidateQueries({ queryKey: ['approvals'] });
            toast({ title: "Success", description: "Budget rejected" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.Budget.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            toast({ title: "Success", description: "Budget deleted successfully" });
        }
    });

    const budgetColumns = [
        { header: "Budget ID", key: "budget_id" },
        { header: "Period", key: "fiscal_period" },
        { header: "Account", key: "account_name" },
        { header: "Type", key: "account_type", isBadge: true },
        { header: "Department", key: "department" },
        { 
            header: "Budgeted", 
            key: "budgeted_amount", 
            render: (val) => `SAR ${val?.toLocaleString() || 0}` 
        },
        { 
            header: "Actual", 
            key: "actual_amount", 
            render: (val) => `SAR ${val?.toLocaleString() || 0}` 
        },
        { 
            header: "Variance", 
            key: "variance_amount", 
            render: (val, row) => {
                const variance = val || 0;
                const isUnfavorable = 
                    (row.account_type === 'revenue' && variance < 0) ||
                    (row.account_type === 'expense' && variance > 0);
                return (
                    <span className={isUnfavorable ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                        {variance >= 0 ? '+' : ''}{variance.toLocaleString()}
                    </span>
                );
            }
        },
        { header: "Status", key: "status", isBadge: true }
    ];

    const approvalColumns = [
        { header: "Request ID", key: "request_id" },
        { header: "Budget ID", key: "document_number" },
        { header: "Requester", key: "requester_name" },
        { header: "Amount", key: "amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Submission Date", key: "submission_date" },
        { header: "Status", key: "status", isBadge: true },
        {
            header: "Actions",
            key: "actions",
            render: (val, row) => {
                if (row.status === 'pending') {
                    return (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600 hover:text-green-700"
                                onClick={() => approveMutation.mutate(row.id)}
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600 hover:text-red-700"
                                onClick={() => rejectMutation.mutate(row.id)}
                            >
                                <XCircle className="w-4 h-4" />
                                Reject
                            </Button>
                        </div>
                    );
                }
                return null;
            }
        }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            draft: "bg-gray-100 text-gray-800",
            approved: "bg-green-100 text-green-800",
            active: "bg-blue-100 text-blue-800",
            closed: "bg-gray-100 text-gray-800",
            pending: "bg-yellow-100 text-yellow-800",
            rejected: "bg-red-100 text-red-800",
            revenue: "bg-green-100 text-green-800",
            expense: "bg-red-100 text-red-800",
            asset: "bg-blue-100 text-blue-800",
            liability: "bg-orange-100 text-orange-800",
            equity: "bg-purple-100 text-purple-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const handleCreate = () => {
        setEditingBudget(null);
        setShowForm(true);
    };

    const handleEdit = (budget) => {
        if (budget.status === 'approved') {
            if (!window.confirm('This budget is approved. Editing will change status to draft and require re-approval. Continue?')) {
                return;
            }
        }
        setEditingBudget(budget);
        setShowForm(true);
    };

    const handleDelete = (budget) => {
        if (budget.status === 'approved') {
            toast({
                title: "Cannot Delete",
                description: "Approved budgets cannot be deleted.",
                variant: "destructive"
            });
            return;
        }
        if (window.confirm('Are you sure you want to delete this budget?')) {
            deleteMutation.mutate(budget.id);
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingBudget(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Budget Management</h1>
                    <p className="text-gray-600 mt-1">Create, approve, and monitor budgets across departments</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    title="Total Budgeted"
                    value={`SAR ${totalBudgeted.toLocaleString()}`}
                    icon={Calculator}
                    trend={`${filteredBudgets.length} budgets`}
                    color="blue"
                />
                    title="Total Actual"
                    value={`SAR ${totalActual.toLocaleString()}`}
                    icon={TrendingUp}
                    trend={`Variance: ${totalVariance.toLocaleString()}`}
                    color="purple"
                />
                    title="Approved Budgets"
                    value={approvedBudgets}
                    icon={CheckCircle}
                    trend={`${filteredBudgets.length} total`}
                    color="green"
                />
                    title="Pending Approvals"
                    value={pendingApproval}
                    icon={AlertCircle}
                    trend="Requires action"
                    color="amber"
                />
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                    <strong>Budget Workflow:</strong> Create budgets → Submit for approval → Monitor variance against actuals → Analyze performance
                </AlertDescription>
            </Alert>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 w-full max-w-2xl">
                    <TabsTrigger value="budgets">Budgets</TabsTrigger>
                    <TabsTrigger value="approvals">Approvals ({pendingApproval})</TabsTrigger>
                    <TabsTrigger value="variance">Variance Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="budgets">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        Budget Registry
                                    </CardTitle>
                                    <Button 
                                        onClick={handleCreate}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Budget
                                    </Button>
                                </div>
                                
                                <div className="flex gap-4 items-end">
                                    <div className="w-48">
                                        <Label>Fiscal Year</Label>
                                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026, 2027].map(year => (
                                                    <SelectItem key={year} value={year.toString()}>
                                                        {year}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-48">
                                        <Label>Department</Label>
                                        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Departments</SelectItem>
                                                {departments.map(dept => (
                                                    <SelectItem key={dept} value={dept}>
                                                        {dept}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-48">
                                        <Label>Status</Label>
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="draft">Draft</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="closed">Closed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={filteredBudgets}
                                columns={budgetColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                showSearch={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="approvals">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                Budget Approvals
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {approvalRequests.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    No budget approval requests found
                                </div>
                            ) : (
                                <DataTable
                                    data={approvalRequests}
                                    columns={approvalColumns}
                                    getBadgeColor={getBadgeColor}
                                    showSearch={false}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="variance">
                    <BudgetVarianceReport />
                </TabsContent>
            </Tabs>

            {showForm && (
                <BudgetManagementForm
                    item={editingBudget}
                    onClose={handleCloseForm}
                    open={showForm}
                />
            )}
        </div>
    );
}