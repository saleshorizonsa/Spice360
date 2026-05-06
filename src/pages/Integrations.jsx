import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
    Plus, 
    RefreshCw, 
    CheckCircle, 
    XCircle,
    AlertTriangle,
    Upload
} from "lucide-react";
import StatCard from "../components/erp/StatCard";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";

export default function Integrations() {
    const [activeTab, setActiveTab] = useState("overview");
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: configs = [] } = useQuery({
        queryKey: ['integrationConfigs'],
        queryFn: () => base44.entities.IntegrationConfig.list('-created_date'),
        initialData: []
    });

    const { data: logs = [] } = useQuery({
        queryKey: ['integrationLogs'],
        queryFn: () => base44.entities.IntegrationLog.list('-sync_date', 100),
        initialData: []
    });

    const { data: bankStatements = [] } = useQuery({
        queryKey: ['bankStatements'],
        queryFn: () => base44.entities.BankStatement.list('-transaction_date', 50),
        initialData: []
    });

    const { data: attendanceRecords = [] } = useQuery({
        queryKey: ['attendanceRecords'],
        queryFn: () => base44.entities.AttendanceRecord.list('-attendance_date', 50),
        initialData: []
    });

    const { data: posTransactions = [] } = useQuery({
        queryKey: ['posTransactions'],
        queryFn: () => base44.entities.POSTransaction.list('-transaction_date', 50),
        initialData: []
    });

    const activeIntegrations = configs.filter(c => c.status === 'active').length;
    const recentSyncs = logs.filter(l => 
        new Date(l.sync_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    const failedSyncs = logs.filter(l => 
        l.status === 'failed' && new Date(l.sync_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    const successRate = recentSyncs > 0 
        ? Math.round(((recentSyncs - failedSyncs) / recentSyncs) * 100) 
        : 0;

    const unreconciledBankTrans = bankStatements.filter(b => !b.reconciled).length;
    const pendingPOSSync = posTransactions.filter(p => !p.synced_to_erp).length;

    const getBadgeColor = (value) => {
        const colors = {
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            testing: "bg-yellow-100 text-yellow-800",
            error: "bg-red-100 text-red-800",
            success: "bg-green-100 text-green-800",
            failed: "bg-red-100 text-red-800",
            partial_success: "bg-yellow-100 text-yellow-800",
            running: "bg-blue-100 text-blue-800",
            banking: "bg-blue-100 text-blue-800",
            pos: "bg-purple-100 text-purple-800",
            ecommerce: "bg-indigo-100 text-indigo-800",
            attendance: "bg-green-100 text-green-800",
            api: "bg-blue-100 text-blue-800",
            sftp: "bg-orange-100 text-orange-800",
            file_upload: "bg-gray-100 text-gray-800",
            webhook: "bg-purple-100 text-purple-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const configColumns = [
        { header: "Name", key: "integration_name" },
        { header: "Type", key: "integration_type", isBadge: true },
        { header: "Provider", key: "provider" },
        { header: "Connection", key: "connection_type", isBadge: true },
        { header: "Sync Freq", key: "sync_frequency" },
        { header: "Last Sync", key: "last_sync_date", render: (val) => val ? new Date(val).toLocaleString() : 'Never' },
        { header: "Status", key: "status", isBadge: true }
    ];

    const logColumns = [
        { header: "Integration", key: "integration_name" },
        { header: "Type", key: "integration_type", isBadge: true },
        { header: "Direction", key: "sync_direction" },
        { header: "Date", key: "sync_date", render: (val) => new Date(val).toLocaleString() },
        { header: "Processed", key: "records_processed" },
        { header: "Created", key: "records_created" },
        { header: "Failed", key: "records_failed" },
        { header: "Status", key: "status", isBadge: true },
        { header: "Time (ms)", key: "processing_time_ms" }
    ];

    const bankStatementColumns = [
        { header: "Date", key: "transaction_date" },
        { header: "Bank", key: "bank_name" },
        { header: "Ref", key: "transaction_ref" },
        { header: "Description", key: "description" },
        { header: "Type", key: "transaction_type", isBadge: true },
        { header: "Amount", key: "amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Balance", key: "balance", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Reconciled", key: "reconciled", render: (val) => val ? "✓" : "✗" }
    ];

    const attendanceColumns = [
        { header: "Date", key: "attendance_date" },
        { header: "Emp #", key: "employee_number" },
        { header: "Name", key: "employee_name" },
        { header: "Check In", key: "check_in_time" },
        { header: "Check Out", key: "check_out_time" },
        { header: "Hours", key: "work_hours" },
        { header: "Status", key: "status", isBadge: true },
        { header: "Source", key: "imported_from", isBadge: true }
    ];

    const posColumns = [
        { header: "Date", key: "transaction_date", render: (val) => new Date(val).toLocaleString() },
        { header: "Order ID", key: "external_order_id" },
        { header: "Channel", key: "channel", isBadge: true },
        { header: "Store", key: "store_location" },
        { header: "Customer", key: "customer_name" },
        { header: "Amount", key: "total_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Payment", key: "payment_method" },
        { header: "Synced", key: "synced_to_erp", render: (val) => val ? "✓" : "✗" },
        { header: "Status", key: "sync_status", isBadge: true }
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Integrations</h1>
                    <p className="text-gray-500">Manage external system integrations</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Active Integrations"
                    value={activeIntegrations}
                    icon={CheckCircle}
                    trend="up"
                />
                <StatCard
                    title="Syncs (24h)"
                    value={recentSyncs}
                    icon={RefreshCw}
                    trend="neutral"
                />
                <StatCard
                    title="Success Rate"
                    value={`${successRate}%`}
                    icon={successRate >= 95 ? CheckCircle : AlertTriangle}
                    trend={successRate >= 95 ? "up" : "down"}
                />
                <StatCard
                    title="Failed Syncs"
                    value={failedSyncs}
                    icon={XCircle}
                    trend={failedSyncs > 0 ? "down" : "up"}
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="configurations">Configurations</TabsTrigger>
                    <TabsTrigger value="logs">Sync Logs</TabsTrigger>
                    <TabsTrigger value="banking">Banking</TabsTrigger>
                    <TabsTrigger value="pos">POS/E-commerce</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Integration Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {['banking', 'pos', 'attendance', 'ecommerce'].map(type => {
                                        const typeConfigs = configs.filter(c => c.integration_type === type);
                                        const active = typeConfigs.filter(c => c.status === 'active').length;
                                        return (
                                            <div key={type} className="flex justify-between items-center">
                                                <span className="capitalize">{type.replace('_', ' ')}</span>
                                                <Badge className={getBadgeColor(active > 0 ? 'active' : 'inactive')}>
                                                    {active} Active
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span>Unreconciled Bank Transactions</span>
                                        <Badge className={unreconciledBankTrans > 0 ? getBadgeColor('error') : getBadgeColor('success')}>
                                            {unreconciledBankTrans}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>POS Orders to Sync</span>
                                        <Badge className={pendingPOSSync > 0 ? getBadgeColor('error') : getBadgeColor('success')}>
                                            {pendingPOSSync}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Failed Syncs (24h)</span>
                                        <Badge className={failedSyncs > 0 ? getBadgeColor('error') : getBadgeColor('success')}>
                                            {failedSyncs}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {failedSyncs > 0 && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                You have {failedSyncs} failed sync(s) in the last 24 hours. Check the Sync Logs tab for details.
                            </AlertDescription>
                        </Alert>
                    )}
                </TabsContent>

                <TabsContent value="configurations">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Integration Configurations</CardTitle>
                                <Button size="sm">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Integration
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={configs}
                                columns={configColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="logs">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Logs (Last 100)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={logs}
                                columns={logColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="banking">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Bank Statement Import</CardTitle>
                                    <Button size="sm">
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Statement
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <DataTable
                                    data={bankStatements}
                                    columns={bankStatementColumns}
                                    getBadgeColor={getBadgeColor}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="pos">
                    <Card>
                        <CardHeader>
                            <CardTitle>POS/E-commerce Transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={posTransactions}
                                columns={posColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attendance">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Attendance Records</CardTitle>
                                    <Button size="sm">
                                        <Upload className="w-4 h-4 mr-2" />
                                        Import Attendance
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <DataTable
                                    data={attendanceRecords}
                                    columns={attendanceColumns}
                                    getBadgeColor={getBadgeColor}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}