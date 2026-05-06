import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { 
    FileText, 
    CheckCircle, 
    AlertTriangle, 
    XCircle, 
    Settings,
    Send
} from "lucide-react";
import StatCard from "../components/erp/StatCard";
import DataTable from "../components/erp/DataTable";
import ZATCAConfigForm from "../components/zatca/ZATCAConfigForm";
import VATReturnDashboard from "../components/zatca/VATReturnDashboard";
import { useToast } from "@/components/ui/use-toast";

export default function ZATCA() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => base44.entities.Invoice.list('-invoice_date'),
        initialData: []
    });

    const { data: submissionLogs = [] } = useQuery({
        queryKey: ['submissionLogs'],
        queryFn: () => base44.entities.ZATCASubmissionLog.list('-submission_date'),
        initialData: []
    });

    const { data: configs = [] } = useQuery({
        queryKey: ['zatcaConfigs'],
        queryFn: () => base44.entities.ZATCAConfiguration.list(),
        initialData: []
    });

    const { data: vendorInvoices = [] } = useQuery({
        queryKey: ['vendorInvoices'],
        queryFn: () => base44.entities.VendorInvoice.list('-invoice_date'),
        initialData: []
    });

    const activeConfig = configs.find(c => c.status === 'active');

    // KPI Calculations
    const totalInvoices = invoices.length;
    const submittedInvoices = invoices.filter(i => i.zatca_submitted).length;
    const clearedInvoices = invoices.filter(i => i.zatca_status === 'cleared').length;
    const rejectedInvoices = invoices.filter(i => i.zatca_status === 'rejected').length;
    const pendingInvoices = invoices.filter(i => !i.zatca_submitted && i.invoice_type !== 'draft').length;
    
    const clearanceRate = totalInvoices > 0 ? Math.round((clearedInvoices / totalInvoices) * 100) : 0;
    const submissionRate = totalInvoices > 0 ? Math.round((submittedInvoices / totalInvoices) * 100) : 0;

    const recentFailures = submissionLogs.filter(log => !log.success && 
        new Date(log.submission_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    const getBadgeColor = (value) => {
        const colors = {
            pending: "bg-yellow-100 text-yellow-800",
            cleared: "bg-green-100 text-green-800",
            reported: "bg-blue-100 text-blue-800",
            rejected: "bg-red-100 text-red-800",
            warning: "bg-orange-100 text-orange-800",
            standard: "bg-blue-100 text-blue-800",
            simplified: "bg-green-100 text-green-800",
            credit_note: "bg-red-100 text-red-800",
            debit_note: "bg-orange-100 text-orange-800",
            clearance: "bg-indigo-100 text-indigo-800",
            reporting: "bg-purple-100 text-purple-800",
            pass: "bg-green-100 text-green-800",
            pass_with_warning: "bg-yellow-100 text-yellow-800",
            fail: "bg-red-100 text-red-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const invoiceColumns = [
        { header: "Invoice #", key: "invoice_number" },
        { header: "Type", key: "invoice_type", isBadge: true },
        { header: "Customer", key: "customer_name" },
        { header: "Amount", key: "total_amount", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: "Date", key: "invoice_date" },
        { header: "UUID", key: "zatca_uuid", render: (val) => val ? val.substring(0, 8) + '...' : 'N/A' },
        { header: "ICV", key: "zatca_icv" },
        { header: "Status", key: "zatca_status", isBadge: true },
        { header: "Submitted", key: "zatca_submitted", render: (val) => val ? "✓" : "✗" }
    ];

    const logColumns = [
        { header: "Invoice #", key: "invoice_number" },
        { header: "Type", key: "invoice_type", isBadge: true },
        { header: "Method", key: "submission_method", isBadge: true },
        { header: "Date", key: "submission_date", render: (val) => new Date(val).toLocaleString() },
        { header: "Status", key: "validation_status", isBadge: true },
        { header: "HTTP Code", key: "response_status_code" },
        { header: "Retry", key: "retry_attempt" },
        { header: "Time (ms)", key: "processing_time_ms" },
        { header: "Success", key: "success", render: (val) => val ? "✓" : "✗" }
    ];

    const submitInvoiceMutation = useMutation({
        mutationFn: async (invoiceId) => {
            toast({
                title: "Submitting to ZATCA",
                description: "Invoice submission in progress...",
                variant: "default"
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['submissionLogs'] });
            toast({
                title: "Success",
                description: "Invoice submitted to ZATCA successfully",
                variant: "default"
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to submit invoice to ZATCA",
                variant: "destructive"
            });
        }
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">ZATCA E-Invoicing (Fatoora)</h1>
                    <p className="text-gray-600 mt-1">Saudi Arabia Electronic Invoice Compliance</p>
                </div>
                <Button 
                    onClick={() => setShowConfigDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Settings className="w-4 h-4 mr-2" />
                    Configuration
                </Button>
            </div>

            {!activeConfig && (
                <Alert className="bg-red-50 border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-900">
                        <strong>ZATCA not configured!</strong> Please configure ZATCA settings before submitting invoices.
                    </AlertDescription>
                </Alert>
            )}

            {activeConfig && activeConfig.onboarding_status !== 'active' && (
                <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-900">
                        <strong>Onboarding incomplete!</strong> Current status: {activeConfig.onboarding_status}. 
                        Complete CSID onboarding to submit invoices.
                    </AlertDescription>
                </Alert>
            )}

            {recentFailures > 0 && (
                <Alert className="bg-orange-50 border-orange-200">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-900">
                        <strong>{recentFailures} failed submissions</strong> in the last 24 hours. Check submission logs.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    title="Total Invoices"
                    value={totalInvoices}
                    icon={FileText}
                    trend={`${submittedInvoices} submitted`}
                    color="blue"
                />
                <StatCard
                    title="Clearance Rate"
                    value={`${clearanceRate}%`}
                    icon={CheckCircle}
                    trend={`${clearedInvoices} cleared`}
                    color="emerald"
                />
                <StatCard
                    title="Pending"
                    value={pendingInvoices}
                    icon={AlertTriangle}
                    trend="Not submitted"
                    color="amber"
                />
                <StatCard
                    title="Rejected"
                    value={rejectedInvoices}
                    icon={XCircle}
                    trend="Need attention"
                    color="red"
                />
                <StatCard
                    title="Submission Rate"
                    value={`${submissionRate}%`}
                    icon={Send}
                    trend="Overall"
                    color="indigo"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="vat_return">VAT Returns</TabsTrigger>
                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                    <TabsTrigger value="logs">Submission Logs</TabsTrigger>
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Submission Status Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {['pending', 'cleared', 'reported', 'rejected', 'warning'].map(status => {
                                        const count = invoices.filter(i => i.zatca_status === status).length;
                                        const percentage = totalInvoices > 0 ? (count / totalInvoices) * 100 : 0;
                                        return (
                                            <div key={status}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="capitalize">{status.replace('_', ' ')}</span>
                                                    <span className="font-semibold">{count}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className="bg-emerald-600 h-2 rounded-full" 
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Invoice Type Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {['standard', 'simplified', 'credit_note', 'debit_note'].map(type => {
                                        const count = invoices.filter(i => i.invoice_type === type).length;
                                        return (
                                            <div key={type} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                                <span className="font-medium capitalize">{type.replace('_', ' ')}</span>
                                                <Badge className={getBadgeColor(type)}>{count}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Submission Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {submissionLogs.slice(0, 5).map(log => (
                                        <div key={log.log_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                            <div>
                                                <p className="font-medium">{log.invoice_number}</p>
                                                <p className="text-sm text-gray-600">
                                                    {new Date(log.submission_date).toLocaleString()}
                                                </p>
                                            </div>
                                            <Badge className={getBadgeColor(log.validation_status)}>
                                                {log.validation_status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>System Configuration</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {activeConfig ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Environment:</span>
                                            <Badge className={getBadgeColor(activeConfig.environment)}>
                                                {activeConfig.environment}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">VAT Number:</span>
                                            <span className="font-medium">{activeConfig.vat_registration_number}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Onboarding Status:</span>
                                            <Badge className={activeConfig.onboarding_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                                {activeConfig.onboarding_status}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Auto Submit:</span>
                                            <span>{activeConfig.auto_submit ? '✓ Enabled' : '✗ Disabled'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Invoice Counter:</span>
                                            <span className="font-medium">{activeConfig.invoice_counter}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-500">No active configuration</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="vat_return">
                    <VATReturnDashboard invoices={invoices} vendorInvoices={vendorInvoices} />
                </TabsContent>

                <TabsContent value="invoices">
                    <Card>
                        <CardHeader>
                            <CardTitle>E-Invoices</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={invoices}
                                columns={invoiceColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="logs">
                    <Card>
                        <CardHeader>
                            <CardTitle>ZATCA Submission Logs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={submissionLogs}
                                columns={logColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="config">
                    <Card>
                        <CardHeader>
                            <CardTitle>ZATCA Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {activeConfig ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-gray-600">Organization Name</Label>
                                            <p className="font-medium">{activeConfig.organization_name}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Organization Name (Arabic)</Label>
                                            <p className="font-medium">{activeConfig.organization_name_ar}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">VAT Number</Label>
                                            <p className="font-medium">{activeConfig.vat_registration_number}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">CR Number</Label>
                                            <p className="font-medium">{activeConfig.cr_number}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">Device Serial</Label>
                                            <p className="font-medium">{activeConfig.device_serial_number}</p>
                                        </div>
                                        <div>
                                            <Label className="text-gray-600">CSID</Label>
                                            <p className="font-medium text-sm">{activeConfig.csid?.substring(0, 20)}...</p>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={() => setShowConfigDialog(true)}
                                        variant="outline"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Edit Configuration
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 mb-4">No ZATCA configuration found</p>
                                    <Button 
                                        onClick={() => setShowConfigDialog(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Create Configuration
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showConfigDialog && (
                <ZATCAConfigForm 
                    item={activeConfig} 
                    onClose={() => setShowConfigDialog(false)} 
                />
            )}
        </div>
    );
}