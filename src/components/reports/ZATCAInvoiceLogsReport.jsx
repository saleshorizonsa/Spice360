import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ZATCAInvoiceLogsReport() {
    const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [dateTo, setDateeTo] = useState(new Date().toISOString().split('T')[0]);

    const { data: logs = [] } = useQuery({
        queryKey: ['zatcaLogs'],
        queryFn: () => matrixSales.entities.ZATCASubmissionLog.list('-submission_date'),
        initialData: []
    });

    const filteredLogs = logs.filter(log => {
        const logDate = new Date(log.submission_date);
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        return logDate >= from && logDate <= to;
    });

    const successCount = filteredLogs.filter(l => l.validation_status === 'pass').length;
    const warningCount = filteredLogs.filter(l => l.validation_status === 'pass_with_warning').length;
    const failCount = filteredLogs.filter(l => l.validation_status === 'fail').length;

    const getBadgeColor = (status) => {
        const colors = {
            pass: "bg-green-100 text-green-800",
            pass_with_warning: "bg-yellow-100 text-yellow-800",
            fail: "bg-red-100 text-red-800",
            cleared: "bg-emerald-100 text-emerald-800",
            not_cleared: "bg-gray-100 text-gray-800",
            rejected: "bg-red-100 text-red-800"
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    };

    const handleExportExcel = () => {
        // Export logic here
        alert('Exporting to Excel...');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        ZATCA E-Invoice Submission Logs
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <Download className="w-4 h-4 mr-2" />
                            Export Excel
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>From Date</Label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>To Date</Label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateeTo(e.target.value)}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-green-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                            <div>
                                <p className="text-sm text-gray-600">Success</p>
                                <p className="text-2xl font-bold text-green-700">{successCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-yellow-600" />
                            <div>
                                <p className="text-sm text-gray-600">With Warnings</p>
                                <p className="text-2xl font-bold text-yellow-700">{warningCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                            <div>
                                <p className="text-sm text-gray-600">Failed</p>
                                <p className="text-2xl font-bold text-red-700">{failCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Logs Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Submission Date</TableHead>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>UUID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Validation</TableHead>
                                <TableHead>Clearance</TableHead>
                                <TableHead>Hash</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.map((log, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>{new Date(log.submission_date).toLocaleString()}</TableCell>
                                    <TableCell className="font-medium">{log.invoice_number}</TableCell>
                                    <TableCell className="font-mono text-xs">{log.invoice_uuid?.substring(0, 8)}...</TableCell>
                                    <TableCell>
                                        <Badge className="bg-indigo-100 text-indigo-800">
                                            {log.invoice_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="capitalize">{log.submission_method}</TableCell>
                                    <TableCell>
                                        <Badge className={getBadgeColor(log.validation_status)}>
                                            {log.validation_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={getBadgeColor(log.clearance_status)}>
                                            {log.clearance_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{log.request_hash?.substring(0, 10)}...</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}