
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardCheck, CheckCircle2, AlertTriangle, FileText, Scan } from "lucide-react";
import StatCard from "../components/erp/StatCard";
import DataTable from "../components/erp/DataTable";
import AssetVerificationTaskForm from "../components/assets/AssetVerificationTaskForm";
import AssetVerificationInterface from "../components/assets/AssetVerificationInterface";
import VerificationReport from "../components/assets/VerificationReport";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "../components/utils/languageContext";

export default function AssetVerification() {
    const [activeTab, setActiveTab] = useState("tasks");
    const [showTaskDialog, setShowTaskDialog] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [activeVerificationTask, setActiveVerificationTask] = useState(null);
    const [reportTask, setReportTask] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: tasks = [] } = useQuery({
        queryKey: ['verificationTasks'],
        queryFn: () => base44.entities.AssetVerificationTask.list('-scheduled_date'),
        initialData: []
    });

    const { data: verifications = [] } = useQuery({
        queryKey: ['verifications'],
        queryFn: () => base44.entities.AssetVerification.list('-verification_date'),
        initialData: []
    });

    // KPIs
    const tasksScheduled = tasks.filter(t => t.status === 'scheduled').length;
    const tasksInProgress = tasks.filter(t => t.status === 'in_progress').length;
    const tasksOverdue = tasks.filter(t => 
        t.status === 'scheduled' && new Date(t.scheduled_date) < new Date()
    ).length;
    const totalVerified = verifications.filter(v => v.verification_status === 'verified').length;
    const totalDiscrepancies = verifications.filter(v => 
        v.verification_status === 'discrepancy' || v.verification_status === 'not_found'
    ).length;
    const verificationRate = verifications.length > 0 
        ? ((totalVerified / verifications.length) * 100).toFixed(1)
        : 0;

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => base44.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully'),
            });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            scheduled: "bg-blue-100 text-blue-800",
            in_progress: "bg-indigo-100 text-indigo-800",
            completed: "bg-green-100 text-green-800",
            cancelled: "bg-gray-100 text-gray-800",
            overdue: "bg-red-100 text-red-800",
            verified: "bg-green-100 text-green-800",
            discrepancy: "bg-yellow-100 text-yellow-800",
            not_found: "bg-red-100 text-red-800",
            damaged: "bg-orange-100 text-orange-800",
            requires_maintenance: "bg-purple-100 text-purple-800",
            low: "bg-gray-100 text-gray-800",
            normal: "bg-blue-100 text-blue-800",
            high: "bg-orange-100 text-orange-800",
            urgent: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const taskColumns = [
        { header: "Task ID", key: "task_id" },
        { header: "Task Name", key: "task_name" },
        { header: t('type'), key: "task_type" },
        { header: "Scheduled", key: "scheduled_date" },
        { header: t('location'), key: "location_name" },
        { header: "Assets", key: "total_assets" },
        { header: "Verified", key: "verified_count" },
        { header: "Discrepancies", key: "discrepancy_count" },
        { header: "Progress", key: "completion_percentage", render: (val) => `${val || 0}%` },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const verificationColumns = [
        { header: t('assetTag'), key: "asset_tag", render: (val) => <span className="font-mono text-xs">{val}</span> },
        { header: t('assetName'), key: "asset_name" },
        { header: t('date'), key: "verification_date", render: (val) => new Date(val).toLocaleString() },
        { header: "Verified By", key: "verified_by_name" },
        { header: "Method", key: "verification_method" },
        { header: t('location'), key: "location_match", render: (val) => val ? "✓ Match" : "✗ Mismatch" },
        { header: "Condition", key: "actual_condition", isBadge: true },
        { header: t('status'), key: "verification_status", isBadge: true }
    ];

    const discrepancyColumns = [
        { header: "Task", key: "task_id" },
        { header: t('assetTag'), key: "asset_tag", render: (val) => <span className="font-mono text-xs">{val}</span> },
        { header: t('assetName'), key: "asset_name" },
        { header: "Issue", key: "verification_status", isBadge: true },
        { header: "Details", key: "discrepancy_details" },
        { header: "Action Required", key: "action_required", render: (val) => val ? "Yes" : "No" },
        { header: "Follow-up", key: "follow_up_completed", render: (val) => val ? "✓ Done" : "⏳ Pending" },
        { header: t('date'), key: "verification_date", render: (val) => new Date(val).toLocaleDateString() }
    ];

    const discrepancies = verifications.filter(v => 
        v.verification_status !== 'verified'
    );

    const handleCreateTask = () => {
        setEditingTask(null);
        setShowTaskDialog(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowTaskDialog(true);
    };

    const handleDeleteTask = (task) => {
        if (confirm(t('areYouSure'))) {
            deleteMutation.mutate({ entity: 'AssetVerificationTask', id: task.id });
        }
    };

    const handleStartVerification = (task) => {
        setActiveVerificationTask(task.task_id);
        setActiveTab('verify');
    };

    const handleViewReport = (task) => {
        setReportTask(task);
        setActiveTab('report');
    };

    const handleCloseTaskDialog = () => {
        setShowTaskDialog(false);
        setEditingTask(null);
    };

    const getTaskVerifications = (taskId) => {
        return verifications.filter(v => v.task_id === taskId);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('assetVerification')}</h1>
                    <p className="text-gray-600 mt-1">Physical verification tasks, mobile scanning & discrepancy tracking</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Tasks Scheduled"
                    value={tasksScheduled}
                    icon={ClipboardCheck}
                    trend={`${tasksInProgress} ${t('inProgress')}`}
                    color="blue"
                />
                <StatCard
                    title="Assets Verified"
                    value={totalVerified}
                    icon={CheckCircle2}
                    trend={`${verificationRate}% accuracy rate`}
                    color="emerald"
                />
                <StatCard
                    title="Discrepancies"
                    value={totalDiscrepancies}
                    icon={AlertTriangle}
                    trend="Require follow-up"
                    color="amber"
                />
                <StatCard
                    title={`${t('overdue')} Tasks`}
                    value={tasksOverdue}
                    icon={AlertTriangle}
                    trend="Need immediate action"
                    color="red"
                />
            </div>

            {/* Alerts */}
            {tasksOverdue > 0 && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-900">
                        <strong>{tasksOverdue} verification tasks</strong> are {t('overdue')} - please complete them
                    </AlertDescription>
                </Alert>
            )}

            {totalDiscrepancies > 0 && (
                <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-900">
                        <strong>{totalDiscrepancies} assets</strong> have discrepancies requiring follow-up
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="verify">Verify Assets</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
                    <TabsTrigger value="report">{t('reports')}</TabsTrigger>
                </TabsList>

                <TabsContent value="tasks">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Verification Tasks</CardTitle>
                            <Button 
                                onClick={handleCreateTask}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Task
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={tasks}
                                columns={taskColumns}
                                searchFields={["task_id", "task_name", "location_name"]}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEditTask}
                                onDelete={handleDeleteTask}
                                onPrint={(task) => handleStartVerification(task)}
                            />
                            <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-3 rounded">
                                <strong>Tip:</strong> Click the print icon (👁) on any task to start verifying assets for that task
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="verify">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Scan className="w-5 h-5 text-emerald-600" />
                                Perform Physical Verification
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {activeVerificationTask ? (
                                <AssetVerificationInterface 
                                    taskId={activeVerificationTask}
                                    onComplete={() => {
                                        queryClient.invalidateQueries();
                                        toast({
                                            title: t('success'),
                                            description: "Verification task completed successfully",
                                        });
                                    }}
                                />
                            ) : (
                                <div className="text-center py-12">
                                    <ClipboardCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        No Active Verification Task
                                    </h3>
                                    <p className="text-gray-600 mb-4">
                                        Select a task from the "Tasks" tab to start verifying assets
                                    </p>
                                    <Button onClick={() => setActiveTab('tasks')}>
                                        View Tasks
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Verification History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={verifications}
                                columns={verificationColumns}
                                searchFields={["verification_id", "asset_tag", "asset_name", "verified_by_name"]}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="discrepancies">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                Discrepancies & Issues ({discrepancies.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={discrepancies}
                                columns={discrepancyColumns}
                                searchFields={["asset_tag", "asset_name", "discrepancy_details", "task_id"]}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="report">
                    <div className="space-y-4">
                        {!reportTask ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Select Task to Generate Report</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-3">
                                        {tasks.map(task => {
                                            const taskVerifications = getTaskVerifications(task.task_id);
                                            return (
                                                <div 
                                                    key={task.id}
                                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                                                >
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold">{task.task_name}</h4>
                                                        <p className="text-sm text-gray-600">
                                                            {taskVerifications.length} / {task.total_assets} assets verified
                                                            ({task.completion_percentage || 0}%)
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => setReportTask(task)}
                                                        disabled={taskVerifications.length === 0}
                                                        size="sm"
                                                    >
                                                        <FileText className="w-4 h-4 mr-2" />
                                                        View Report
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setReportTask(null)}
                                    size="sm"
                                >
                                    ← {t('back')} to Task Selection
                                </Button>
                                <VerificationReport 
                                    task={reportTask}
                                    verifications={getTaskVerifications(reportTask.task_id)}
                                />
                            </>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showTaskDialog && (
                <AssetVerificationTaskForm 
                    item={editingTask} 
                    onClose={handleCloseTaskDialog} 
                />
            )}
        </div>
    );
}
