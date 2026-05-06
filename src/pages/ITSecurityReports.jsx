import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
    Shield, 
    AlertTriangle, 
    FileText,
    RefreshCw,
    Users
} from "lucide-react";
import UserRolesMatrixReport from "../components/reports/UserRolesMatrixReport";
import MasterDataChangesReport from "../components/reports/MasterDataChangesReport";
import DocumentNumberingGapsReport from "../components/reports/DocumentNumberingGapsReport";
import IntegrationErrorLogReport from "../components/reports/IntegrationErrorLogReport";
import BackupVerificationReport from "../components/reports/BackupVerificationReport";

export default function ITSecurityReports() {
    const [activeTab, setActiveTab] = useState("user_roles");

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => matrixSales.entities.User.list(),
        initialData: []
    });

    const { data: integrationLogs = [] } = useQuery({
        queryKey: ['integrationLogs'],
        queryFn: () => matrixSales.entities.IntegrationLog.list('-sync_date'),
        initialData: []
    });

    const { data: documentSeries = [] } = useQuery({
        queryKey: ['documentSeries'],
        queryFn: () => matrixSales.entities.DocumentNumberSeries.list(),
        initialData: []
    });

    // KPIs
    const activeUsers = users.filter(u => u.status === 'active').length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const recentErrors = integrationLogs.filter(log => 
        log.status === 'failed' && 
        log.sync_date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    ).length;
    const exhaustedSeries = documentSeries.filter(s => s.status === 'exhausted').length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">IT, Security & Audit Reports</h1>
                    <p className="text-gray-600 mt-1">System security, data integrity & audit compliance tracking</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh Data
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Users</p>
                                <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
                                <p className="text-xs text-gray-500 mt-1">{adminUsers} admins</p>
                            </div>
                            <Users className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Integration Errors</p>
                                <p className="text-2xl font-bold text-orange-600">{recentErrors}</p>
                                <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Number Series</p>
                                <p className="text-2xl font-bold text-gray-900">{documentSeries.length}</p>
                                <p className="text-xs text-gray-500 mt-1">{exhaustedSeries} exhausted</p>
                            </div>
                            <FileText className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">System Health</p>
                                <p className="text-2xl font-bold text-green-600">98.5%</p>
                                <p className="text-xs text-gray-500 mt-1">Uptime</p>
                            </div>
                            <Shield className="w-8 h-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
                    <TabsTrigger value="user_roles">User/Roles</TabsTrigger>
                    <TabsTrigger value="master_data">Master Data</TabsTrigger>
                    <TabsTrigger value="numbering_gaps">Number Gaps</TabsTrigger>
                    <TabsTrigger value="integration_errors">Integration Errors</TabsTrigger>
                    <TabsTrigger value="backup_verification">Backup/Restore</TabsTrigger>
                </TabsList>

                <TabsContent value="user_roles">
                    <UserRolesMatrixReport />
                </TabsContent>

                <TabsContent value="master_data">
                    <MasterDataChangesReport />
                </TabsContent>

                <TabsContent value="numbering_gaps">
                    <DocumentNumberingGapsReport />
                </TabsContent>

                <TabsContent value="integration_errors">
                    <IntegrationErrorLogReport />
                </TabsContent>

                <TabsContent value="backup_verification">
                    <BackupVerificationReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}