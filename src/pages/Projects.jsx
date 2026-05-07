import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Clock, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import ProjectForm from "../components/projects/ProjectForm";
import TimesheetForm from "../components/projects/TimesheetForm";
import ExpenseForm from "../components/projects/ExpenseForm";
import MilestoneForm from "../components/projects/MilestoneForm";
import ProjectTaskForm from "../components/projects/ProjectTaskForm";
import ResourceAllocationForm from "../components/projects/ResourceAllocationForm";
import BulkResourceAllocation from "../components/projects/BulkResourceAllocation";
import ProjectBudgetTracker from "../components/projects/ProjectBudgetTracker";
import ProjectReports from "../components/projects/ProjectReports";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../components/utils/languageContext";

export default function Projects() {
    const [activeTab, setActiveTab] = useState("projects");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage(); // Initialize useLanguage hook

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => matrixSales.entities.Project.list('-start_date'),
        initialData: []
    });

    const { data: timesheets = [] } = useQuery({
        queryKey: ['timesheets'],
        queryFn: () => matrixSales.entities.Timesheet.list('-week_start_date'),
        initialData: []
    });

    const { data: expenses = [] } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => matrixSales.entities.ProjectExpense.list('-expense_date'),
        initialData: []
    });

    const { data: milestones = [] } = useQuery({
        queryKey: ['milestones'],
        queryFn: () => matrixSales.entities.ProjectMilestone.list('sequence_number'),
        initialData: []
    });

    const { data: projectInvoices = [] } = useQuery({
        queryKey: ['projectInvoices'],
        queryFn: () => matrixSales.entities.ProjectInvoice.list('-invoice_date'),
        initialData: []
    });

    const { data: projectTasks = [] } = useQuery({
        queryKey: ['projectTasks'],
        queryFn: () => matrixSales.entities.ProjectTask.list('start_date'),
        initialData: []
    });

    const { data: resourceAllocations = [] } = useQuery({
        queryKey: ['resourceAllocations'],
        queryFn: () => matrixSales.entities.ResourceAllocation.list('-start_date'),
        initialData: []
    });

    const [selectedProject, setSelectedProject] = useState(null);
    const [showBudgetTracker, setShowBudgetTracker] = useState(false);

    // KPI Calculations
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const totalRevenue = projectInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const unbilledRevenue = projects.reduce((sum, p) => sum + (p.unbilled_revenue || 0), 0);
    
    const totalBudgetHours = projects.reduce((sum, p) => sum + (p.budget_hours || 0), 0);
    const totalActualHours = projects.reduce((sum, p) => sum + (p.actual_hours || 0), 0);
    const utilizationRate = totalBudgetHours > 0 ? Math.round((totalActualHours / totalBudgetHours) * 100) : 0;

    const projectsWithMargin = projects.filter(p => p.actual_cost > 0);
    const avgMargin = projectsWithMargin.length > 0
        ? Math.round(projectsWithMargin.reduce((sum, p) => {
            const margin = ((p.revenue_recognized - p.actual_cost) / p.revenue_recognized) * 100;
            return sum + (isNaN(margin) ? 0 : margin);
        }, 0) / projectsWithMargin.length)
        : 0;

    const atRiskProjects = projects.filter(p => 
        p.status === 'active' && (
            (p.actual_cost > p.budget_cost * 0.9) ||
            (p.actual_hours > p.budget_hours * 0.9)
        )
    ).length;

    const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;
    const pendingExpenses = expenses.filter(e => e.status === 'submitted').length;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('recordDeletedSuccessfully')
            });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            planning: "bg-gray-100 text-gray-800",
            active: "bg-green-100 text-green-800",
            on_hold: "bg-yellow-100 text-yellow-800",
            completed: "bg-blue-100 text-blue-800",
            cancelled: "bg-red-100 text-red-800",
            closed: "bg-gray-100 text-gray-800",
            time_and_material: "bg-blue-100 text-blue-800",
            fixed_price: "bg-green-100 text-green-800",
            milestone_based: "bg-purple-100 text-purple-800",
            retainer: "bg-indigo-100 text-indigo-800",
            draft: "bg-gray-100 text-gray-800",
            submitted: "bg-yellow-100 text-yellow-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            posted: "bg-emerald-100 text-emerald-800",
            low: "bg-green-100 text-green-800",
            medium: "bg-yellow-100 text-yellow-800",
            high: "bg-red-100 text-red-800",
            critical: "bg-rose-100 text-rose-800",
            travel: "bg-blue-100 text-blue-800",
            accommodation: "bg-purple-100 text-purple-800",
            meals: "bg-orange-100 text-orange-800",
            transportation: "bg-teal-100 text-teal-800",
            materials: "bg-indigo-100 text-indigo-800",
            unpaid: "bg-red-100 text-red-800",
            partially_paid: "bg-yellow-100 text-yellow-800",
            paid: "bg-green-100 text-green-800",
            overdue: "bg-rose-100 text-rose-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const projectColumns = [
        { header: t('projectCode'), key: "project_code" },
        { header: t('projectName'), key: "project_name" },
        { header: t('type'), key: "project_type", isBadge: true },
        { header: t('customer'), key: "customer_name" },
        { header: t('manager'), key: "project_manager" },
        { header: t('contractValue'), key: "contract_value", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('completionPercent'), key: "completion_percent", render: (val) => `${val || 0}%` },
        { header: t('startDate'), key: "start_date" },
        { header: t('status'), key: "status", isBadge: true },
        { header: t('risk'), key: "risk_level", isBadge: true }
    ];

    const timesheetColumns = [
        { header: t('timesheetNum'), key: "timesheet_number" },
        { header: t('employee'), key: "employee_name" },
        { header: t('weekStart'), key: "week_start_date" },
        { header: t('weekEnd'), key: "week_end_date" },
        { header: t('totalHours'), key: "total_hours" },
        { header: t('billable'), key: "billable_hours" },
        { header: t('nonBillable'), key: "non_billable_hours" },
        { header: t('submitted'), key: "submitted_date" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const expenseColumns = [
        { header: t('expenseNum'), key: "expense_number" },
        { header: t('project'), key: "project_name" },
        { header: t('employee'), key: "employee_name" },
        { header: t('category'), key: "expense_category", isBadge: true },
        { header: t('date'), key: "expense_date" },
        { header: t('amount'), key: "amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('billable'), key: "billable", render: (val) => val ? t('yes') : t('no') },
        { header: t('receipt'), key: "receipt_attached", render: (val) => val ? "✓" : "✗" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const milestoneColumns = [
        { header: t('milestoneNum'), key: "milestone_number" },
        { header: t('project'), key: "project_name" },
        { header: t('milestoneName'), key: "milestone_name" },
        { header: t('sequence'), key: "sequence_number" },
        { header: t('plannedDate'), key: "planned_date" },
        { header: t('actualDate'), key: "actual_date" },
        { header: t('value'), key: "milestone_value", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('retention'), key: "retention_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('completionPercent'), key: "completion_percent", render: (val) => `${val || 0}%` },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const invoiceColumns = [
        { header: t('invoiceNum'), key: "invoice_number" },
        { header: t('project'), key: "project_name" },
        { header: t('type'), key: "invoice_type", isBadge: true },
        { header: t('periodStart'), key: "billing_period_start" },
        { header: t('periodEnd'), key: "billing_period_end" },
        { header: t('laborHours'), key: "labor_hours" },
        { header: t('subtotal'), key: "subtotal", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('retention'), key: "retention_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('total'), key: "total_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('payment'), key: "payment_status", isBadge: true },
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

    const handleDelete = (item, entity) => {
        if (confirm(t('areYouSureToDeleteRecord'))) { // Translated confirmation message
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('projectsAndServices')}</h1>
                    <p className="text-gray-600 mt-1">{t('wbsTimesheetsMilestonesBilling')}</p>
                </div>
            </div>

            {(pendingTimesheets > 0 || pendingExpenses > 0 || atRiskProjects > 0) && (
                <div className="space-y-2">
                    {pendingTimesheets > 0 && (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                                <strong>{pendingTimesheets} {t('timesheets')}</strong> {t('pendingApproval')}
                            </AlertDescription>
                        </Alert>
                    )}
                    {pendingExpenses > 0 && (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                                <strong>{pendingExpenses} {t('expenses')}</strong> {t('pendingApproval')}
                            </AlertDescription>
                        </Alert>
                    )}
                    {atRiskProjects > 0 && (
                        <Alert className="bg-red-50 border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-900">
                                <strong>{atRiskProjects} {t('projects')}</strong> {t('atRiskBudgetHours')}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    title={t('activeProjects')}
                    value={activeProjects}
                    icon={Briefcase}
                    trend={`${projects.length} ${t('total')}`}
                    color="emerald"
                />
                    title={t('revenue')}
                    value={`SAR ${(totalRevenue / 1000).toFixed(0)}K`}
                    icon={DollarSign}
                    trend={t('invoiced')}
                    color="blue"
                />
                    title={t('unbilled')}
                    value={`SAR ${(unbilledRevenue / 1000).toFixed(0)}K`}
                    icon={TrendingUp}
                    trend={t('toInvoice')}
                    color="amber"
                />
                    title={t('utilization')}
                    value={`${utilizationRate}%`}
                    icon={Clock}
                    trend={`${totalActualHours.toLocaleString()}${t('hoursLogged')}`}
                    color="indigo"
                />
                    title={t('avgMargin')}
                    value={`${avgMargin}%`}
                    icon={TrendingUp}
                    trend={t('grossMargin')}
                    color="purple"
                />
                    title={t('atRisk')}
                    value={atRiskProjects}
                    icon={AlertTriangle}
                    trend={t('needAttention')}
                    color="red"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-8 w-full">
                    <TabsTrigger value="projects">{t('projects')}</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="resources">{t('resources')}</TabsTrigger>
                    <TabsTrigger value="timesheets">{t('timesheets')}</TabsTrigger>
                    <TabsTrigger value="expenses">{t('expenses')}</TabsTrigger>
                    <TabsTrigger value="milestones">{t('milestones')}</TabsTrigger>
                    <TabsTrigger value="invoices">{t('invoices')}</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="projects">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('projects')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('projects')}
                                className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newProject')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={projects}
                                columns={[
                                    ...projectColumns,
                                    { 
                                        header: 'Budget', 
                                        key: 'budget_cost',
                                        render: (val, row) => (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedProject(row);
                                                    setShowBudgetTracker(true);
                                                }}
                                            >
                                                View Budget
                                            </Button>
                                        )
                                    }
                                ]}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'projects')}
                                onDelete={(item) => handleDelete(item, 'Project')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="tasks">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Project Tasks</CardTitle>
                            <Button 
                                onClick={() => handleCreate('tasks')}
                                className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Task
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={projectTasks}
                                columns={[
                                    { header: 'Task Code', key: 'task_code' },
                                    { header: 'Project', key: 'project_name' },
                                    { header: 'Task Name', key: 'task_name' },
                                    { header: 'Type', key: 'task_type', isBadge: true },
                                    { header: 'Assigned To', key: 'assigned_to' },
                                    { header: 'Start Date', key: 'start_date' },
                                    { header: 'End Date', key: 'end_date' },
                                    { header: 'Planned Hours', key: 'planned_hours' },
                                    { header: 'Actual Hours', key: 'actual_hours' },
                                    { header: 'Completion %', key: 'completion_percent', render: (val) => `${val || 0}%` },
                                    { header: 'Status', key: 'status', isBadge: true },
                                    { header: 'Priority', key: 'priority', isBadge: true }
                                ]}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'tasks')}
                                onDelete={(item) => handleDelete(item, 'ProjectTask')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="resources">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('resourceAllocations')}</CardTitle>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={() => handleCreate('resources')}
                                    className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Allocate Resource
                                </Button>
                                <Button 
                                    onClick={() => handleCreate('bulk_resources')}
                                    variant="outline"
                                    className="whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Bulk Allocate
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={resourceAllocations}
                                columns={[
                                    { header: 'Allocation ID', key: 'allocation_id' },
                                    { header: 'Project', key: 'project_name' },
                                    { header: 'Employee', key: 'employee_name' },
                                    { header: 'Role', key: 'role' },
                                    { header: 'Allocation %', key: 'allocation_percent', render: (val) => `${val}%` },
                                    { header: 'Start Date', key: 'start_date' },
                                    { header: 'End Date', key: 'end_date' },
                                    { header: 'Billing Rate', key: 'billing_rate', render: (val) => `SAR ${val}/hr` },
                                    { header: 'Billable', key: 'is_billable', render: (val) => val ? 'Yes' : 'No' },
                                    { header: 'Status', key: 'status', isBadge: true }
                                ]}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'resources')}
                                onDelete={(item) => handleDelete(item, 'ResourceAllocation')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="timesheets">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('timesheets')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('timesheets')}
                                className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newTimesheet')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={timesheets}
                                columns={timesheetColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'timesheets')}
                                onDelete={(item) => handleDelete(item, 'Timesheet')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="expenses">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('projectExpenses')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('expenses')}
                                className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newExpense')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={expenses}
                                columns={expenseColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'expenses')}
                                onDelete={(item) => handleDelete(item, 'ProjectExpense')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="milestones">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('projectMilestones')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('milestones')}
                                className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('newMilestone')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={milestones}
                                columns={milestoneColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'milestones')}
                                onDelete={(item) => handleDelete(item, 'ProjectMilestone')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="invoices">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('projectInvoices')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={projectInvoices}
                                columns={invoiceColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reports">
                    <ProjectReports 
                        projects={projects}
                        tasks={projectTasks}
                        expenses={expenses}
                        timesheets={timesheets}
                        resourceAllocations={resourceAllocations}
                    />
                </TabsContent>
            </Tabs>

            {showDialog && activeTab === 'projects' && (
                <ProjectForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'timesheets' && (
                <TimesheetForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'expenses' && (
                <ExpenseForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'milestones' && (
                <MilestoneForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'tasks' && (
                <ProjectTaskForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'resources' && (
                <ResourceAllocationForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'bulk_resources' && (
                <BulkResourceAllocation onClose={handleCloseDialog} />
            )}

            {showBudgetTracker && selectedProject && (
                <Dialog open={showBudgetTracker} onOpenChange={setShowBudgetTracker}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Budget Tracker: {selectedProject.project_name}</DialogTitle>
                        </DialogHeader>
                        <ProjectBudgetTracker project={selectedProject} />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}