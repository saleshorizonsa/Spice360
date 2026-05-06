import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function IntegrationErrorLogReport() {
    const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
    const [integrationType, setIntegrationType] = useState("ALL");

    const { data: integrationLogs = [] } = useQuery({
        queryKey: ['integrationLogs'],
        queryFn: () => matrixSales.entities.IntegrationLog.list('-sync_date'),
        initialData: []
    });

    const filteredLogs = integrationLogs.filter(log => {
        const dateMatch = log.sync_date >= periodStart && log.sync_date <= periodEnd;
        const typeMatch = integrationType === 'ALL' || log.integration_type === integrationType;
        const errorMatch = log.status === 'failed' || log.status === 'partial_success';
        return dateMatch && typeMatch && errorMatch;
    });

    // Group by integration type
    const errorsByType = {};
    filteredLogs.forEach(log => {
        if (!errorsByType[log.integration_type]) {
            errorsByType[log.integration_type] = {
                count: 0,
                records_failed: 0
            };
        }
        errorsByType[log.integration_type].count += 1;
        errorsByType[log.integration_type].records_failed += (log.records_failed || 0);
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Integration Error Log Report
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                        <Button variant="outline" size="sm">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry Failed
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Start Date</Label>
                        <Input
                            type="date"
                            value={periodStart}
                            onChange={(e) => setPeriodStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>End Date</Label>
                        <Input
                            type="date"
                            value={periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Integration Type</Label>
                        <Select value={integrationType} onValueChange={setIntegrationType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Types</SelectItem>
                                <SelectItem value="banking">Banking</SelectItem>
                                <SelectItem value="pos">POS</SelectItem>
                                <SelectItem value="attendance">Attendance</SelectItem>
                                <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
                                <SelectItem value="shipping">Shipping</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Summary by Type */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {Object.entries(errorsByType).map(([type, data]) => (
                        <Card key={type}>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-600 capitalize">{type.replace(/_/g, ' ')}</p>
                                <p className="text-xl font-bold text-red-600">{data.count}</p>
                                <p className="text-xs text-gray-500">{data.records_failed} records</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Error Logs Table */}
                <div className="rounded-lg border overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                                <TableHead>Date/Time</TableHead>
                                <TableHead>Integration</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Direction</TableHead>
                                <TableHead className="text-right">Processed</TableHead>
                                <TableHead className="text-right">Failed</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Error Message</TableHead>
                                <TableHead>Retry</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.map((log, idx) => (
                                <TableRow key={idx} className="hover:bg-gray-50">
                                    <TableCell className="text-sm">
                                        {new Date(log.sync_date).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="font-medium">{log.integration_name}</TableCell>
                                    <TableCell className="capitalize">
                                        {log.integration_type.replace(/_/g, ' ')}
                                    </TableCell>
                                    <TableCell className="capitalize">{log.sync_direction}</TableCell>
                                    <TableCell className="text-right">{log.records_processed || 0}</TableCell>
                                    <TableCell className="text-right text-red-600 font-semibold">
                                        {log.records_failed || 0}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={
                                            log.status === 'failed' ? 'bg-red-600' :
                                            log.status === 'partial_success' ? 'bg-orange-600' :
                                            'bg-gray-600'
                                        }>
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs">
                                        <div className="text-xs text-red-600 truncate" title={log.error_message}>
                                            {log.error_message || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-gray-600">
                                            {log.retry_attempt || 0}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}