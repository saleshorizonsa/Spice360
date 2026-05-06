import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    FileText, 
    Users,
    AlertTriangle,
    CheckCircle2,
    Clock
} from "lucide-react";
import VATReturnReport from "../components/reports/VATReturnReport";
import ZATCAInvoiceLogsReport from "../components/reports/ZATCAInvoiceLogsReport";
import CreditDebitNoteRegister from "../components/reports/CreditDebitNoteRegister";
import WPSReport from "../components/reports/WPSReport";
import GOSIReport from "../components/reports/GOSIReport";
import NitaqatReport from "../components/reports/NitaqatReport";
import DocumentExpiryReport from "../components/reports/DocumentExpiryReport";
import DocumentArchivalReport from "../components/reports/DocumentArchivalReport";

export default function ComplianceReports() {
    const [activeTab, setActiveTab] = useState("vat");

    const { data: vatReturns = [] } = useQuery({
        queryKey: ['vatReturns'],
        queryFn: () => base44.entities.VATReturn.list('-period_start'),
        initialData: []
    });

    const { data: invoiceLogs = [] } = useQuery({
        queryKey: ['zatcaLogs'],
        queryFn: () => base44.entities.ZATCASubmissionLog.list('-submission_date'),
        initialData: []
    });

    const { data: gosiRecords = [] } = useQuery({
        queryKey: ['gosi'],
        queryFn: () => base44.entities.GOSIContribution.list('-contribution_month'),
        initialData: []
    });

    const { data: nitaqatSnapshots = [] } = useQuery({
        queryKey: ['nitaqat'],
        queryFn: () => base44.entities.NitaqatSnapshot.list('-snapshot_date'),
        initialData: []
    });

    const { data: expiringDocs = [] } = useQuery({
        queryKey: ['expiringDocs'],
        queryFn: () => base44.entities.DocumentExpiryTracking.filter({ status: 'expiring_soon' }),
        initialData: []
    });

    // KPIs
    const pendingVAT = vatReturns.filter(v => v.filing_status === 'draft').length;
    const zatcaSuccess = invoiceLogs.filter(l => l.validation_status === 'pass').length;
    const zatcaFailed = invoiceLogs.filter(l => l.validation_status === 'fail').length;
    const latestNitaqat = nitaqatSnapshots[0] || {};
    const criticalExpiries = expiringDocs.filter(d => d.alert_level === 'red').length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Saudi Compliance Reports</h1>
                    <p className="text-gray-600 mt-1">VAT, ZATCA, GOSI, Nitaqat & Document Management</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending VAT Returns</p>
                                <p className="text-2xl font-bold text-gray-900">{pendingVAT}</p>
                            </div>
                            <FileText className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">ZATCA Success</p>
                                <p className="text-2xl font-bold text-green-600">{zatcaSuccess}</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">ZATCA Failed</p>
                                <p className="text-2xl font-bold text-red-600">{zatcaFailed}</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Saudization Rate</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {latestNitaqat.saudization_percentage?.toFixed(1) || 0}%
                                </p>
                            </div>
                            <Users className="w-8 h-8 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Critical Expiries</p>
                                <p className="text-2xl font-bold text-red-600">{criticalExpiries}</p>
                            </div>
                            <Clock className="w-8 h-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
                    <TabsTrigger value="vat">VAT Returns</TabsTrigger>
                    <TabsTrigger value="zatca">ZATCA Logs</TabsTrigger>
                    <TabsTrigger value="credit_debit">Credit/Debit Notes</TabsTrigger>
                    <TabsTrigger value="wps">WPS Payroll</TabsTrigger>
                    <TabsTrigger value="gosi">GOSI</TabsTrigger>
                    <TabsTrigger value="nitaqat">Nitaqat</TabsTrigger>
                    <TabsTrigger value="expiry">Document Expiry</TabsTrigger>
                    <TabsTrigger value="archival">Archival Index</TabsTrigger>
                </TabsList>

                <TabsContent value="vat">
                    <VATReturnReport />
                </TabsContent>

                <TabsContent value="zatca">
                    <ZATCAInvoiceLogsReport />
                </TabsContent>

                <TabsContent value="credit_debit">
                    <CreditDebitNoteRegister />
                </TabsContent>

                <TabsContent value="wps">
                    <WPSReport />
                </TabsContent>

                <TabsContent value="gosi">
                    <GOSIReport />
                </TabsContent>

                <TabsContent value="nitaqat">
                    <NitaqatReport />
                </TabsContent>

                <TabsContent value="expiry">
                    <DocumentExpiryReport />
                </TabsContent>

                <TabsContent value="archival">
                    <DocumentArchivalReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}