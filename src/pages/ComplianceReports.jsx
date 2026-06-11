import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
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
import CreditDebitNoteRegister from "../components/reports/CreditDebitNoteRegister";
import DocumentExpiryReport from "../components/reports/DocumentExpiryReport";
import DocumentArchivalReport from "../components/reports/DocumentArchivalReport";

export default function ComplianceReports() {
    const [activeTab, setActiveTab] = useState("vat");

    const { data: vatReturns = [] } = useQuery({
        queryKey: ['vatReturns'],
        queryFn: () => matrixSales.entities.VATReturn.list('-period_start'),
        initialData: []
    });

    const { data: slVatReturns = [] } = useQuery({
        queryKey: ['slVatReturns'],
        queryFn: () => matrixSales.entities.SLVATReturn.list('-period_month'),
        initialData: []
    });

    const { data: slWhtReturns = [] } = useQuery({
        queryKey: ['slWhtReturns'],
        queryFn: () => matrixSales.entities.SLWHTReturn.list('-period_month'),
        initialData: []
    });

    const { data: slEpfContributions = [] } = useQuery({
        queryKey: ['slEpfContributions'],
        queryFn: () => matrixSales.entities.SLEPFContribution.list('-period_month'),
        initialData: []
    });

    const { data: expiringDocs = [] } = useQuery({
        queryKey: ['expiringDocs'],
        queryFn: () => matrixSales.entities.DocumentExpiryTracking.filter({ status: 'expiring_soon' }),
        initialData: []
    });

    const pendingVAT = slVatReturns.filter(v => v.status === 'draft').length;
    const pendingWHT = slWhtReturns.filter(w => w.status === 'draft').length;
    const pendingEPF = slEpfContributions.filter(e => e.status === 'draft').length;
    const criticalExpiries = expiringDocs.filter(d => d.alert_level === 'red').length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Sri Lanka Compliance Reports</h1>
                    <p className="text-gray-600 mt-1">VAT, WHT, EPF/ETF, SSCL & Document Management</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                <p className="text-sm text-gray-600">Pending WHT Returns</p>
                                <p className="text-2xl font-bold text-amber-600">{pendingWHT}</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Pending EPF Returns</p>
                                <p className="text-2xl font-bold text-indigo-600">{pendingEPF}</p>
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
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="vat">VAT Returns</TabsTrigger>
                    <TabsTrigger value="credit_debit">Credit/Debit Notes</TabsTrigger>
                    <TabsTrigger value="wht">WHT Returns</TabsTrigger>
                    <TabsTrigger value="expiry">Document Expiry</TabsTrigger>
                    <TabsTrigger value="archival">Archival Index</TabsTrigger>
                </TabsList>

                <TabsContent value="vat">
                    <VATReturnReport />
                </TabsContent>

                <TabsContent value="credit_debit">
                    <CreditDebitNoteRegister />
                </TabsContent>

                <TabsContent value="wht">
                    <Card>
                        <CardContent className="p-6">
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">WHT Return Register</p>
                                <p className="text-gray-400 text-sm mt-1">
                                    Withholding tax returns filed under the Inland Revenue Act. Track 5–14% WHT deductions on payments to vendors and contractors.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
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
