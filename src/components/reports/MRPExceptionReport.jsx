import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, AlertTriangle, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function MRPExceptionReport() {
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [exceptionType, setExceptionType] = useState("ALL");

    const { data: mrpPlannedOrders = [] } = useQuery({
        queryKey: ['mrpPlannedOrders'],
        queryFn: () => base44.entities.MRPPlannedOrder.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    // Calculate exceptions
    const exceptions = mrpPlannedOrders.map(order => {
        const daysUntilRequired = Math.floor(
            (new Date(order.required_date) - new Date()) / (1000 * 60 * 60 * 24)
        );
        
        const material = materials.find(m => m.material_code === order.material_code);
        const currentStock = material?.current_stock || 0;
        const isShortage = currentStock < order.quantity;
        const isLateSupply = daysUntilRequired < 0;
        
        let exceptionMessage = '';
        let severity = 'low';
        
        if (isLateSupply && isShortage) {
            exceptionMessage = 'Late supply + Shortage';
            severity = 'critical';
        } else if (isLateSupply) {
            exceptionMessage = 'Late supply';
            severity = 'high';
        } else if (isShortage) {
            exceptionMessage = 'Material shortage';
            severity = 'medium';
        } else if (daysUntilRequired < 7) {
            exceptionMessage = 'Due soon';
            severity = 'low';
        }
        
        return {
            ...order,
            exception_message: exceptionMessage,
            severity,
            days_until_required: daysUntilRequired,
            current_stock: currentStock,
            shortage_qty: isShortage ? order.quantity - currentStock : 0
        };
    }).filter(e => e.exception_message);

    const filteredExceptions = exceptions.filter(e => {
        if (exceptionType === 'ALL') return true;
        if (exceptionType === 'SHORTAGE') return e.shortage_qty > 0;
        if (exceptionType === 'LATE') return e.days_until_required < 0;
        return true;
    });

    const getSeverityColor = (severity) => {
        const colors = {
            critical: "bg-red-100 text-red-800 border-red-300",
            high: "bg-orange-100 text-orange-800 border-orange-300",
            medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
            low: "bg-blue-100 text-blue-800 border-blue-300"
        };
        return colors[severity] || colors.low;
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>MRP Exception Messages Report - ${dateFilter}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .critical { background-color: #fee2e2; font-weight: bold; }
                        .high { background-color: #fed7aa; }
                        .medium { background-color: #fef3c7; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - MRP Exception Messages</h1>
                        <p><strong>Report Date:</strong> ${new Date(dateFilter).toLocaleDateString()}</p>
                        <p><strong>Total Exceptions:</strong> ${filteredExceptions.length}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Material Code</th>
                                <th>Material Name</th>
                                <th>Exception</th>
                                <th>Required Date</th>
                                <th>Days</th>
                                <th>Planned Qty</th>
                                <th>Current Stock</th>
                                <th>Shortage</th>
                                <th>Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredExceptions.map(exc => `
                                <tr class="${exc.severity}">
                                    <td>${exc.material_code}</td>
                                    <td>${exc.material_name}</td>
                                    <td><strong>${exc.exception_message}</strong></td>
                                    <td>${new Date(exc.required_date).toLocaleDateString()}</td>
                                    <td>${exc.days_until_required}</td>
                                    <td>${exc.quantity}</td>
                                    <td>${exc.current_stock}</td>
                                    <td>${exc.shortage_qty}</td>
                                    <td>${exc.source_of_demand || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Planning System
                    </p>
                </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        MRP Exception Messages (Shortages / Late Supply)
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                        <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Export Excel
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Report Date</Label>
                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Exception Type</Label>
                        <Select value={exceptionType} onValueChange={setExceptionType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Exceptions</SelectItem>
                                <SelectItem value="SHORTAGE">Material Shortages</SelectItem>
                                <SelectItem value="LATE">Late Supply</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-2 flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            <Search className="w-4 h-4 mr-2" />
                            Run MRP Check
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-red-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Critical</p>
                            <p className="text-xl font-bold text-red-700">
                                {exceptions.filter(e => e.severity === 'critical').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">High</p>
                            <p className="text-xl font-bold text-orange-700">
                                {exceptions.filter(e => e.severity === 'high').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Medium</p>
                            <p className="text-xl font-bold text-yellow-700">
                                {exceptions.filter(e => e.severity === 'medium').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Low</p>
                            <p className="text-xl font-bold text-blue-700">
                                {exceptions.filter(e => e.severity === 'low').length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Exception Table */}
                <div className="rounded-lg border overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                                <TableHead>Severity</TableHead>
                                <TableHead>Material Code</TableHead>
                                <TableHead>Material Name</TableHead>
                                <TableHead>Exception Message</TableHead>
                                <TableHead>Required Date</TableHead>
                                <TableHead className="text-right">Days</TableHead>
                                <TableHead className="text-right">Planned Qty</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right">Shortage</TableHead>
                                <TableHead>Source</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExceptions.map((exc, idx) => (
                                <TableRow key={idx} className={exc.severity === 'critical' ? 'bg-red-50' : ''}>
                                    <TableCell>
                                        <Badge className={getSeverityColor(exc.severity)}>
                                            {exc.severity.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{exc.material_code}</TableCell>
                                    <TableCell>{exc.material_name}</TableCell>
                                    <TableCell className="font-semibold text-gray-900">{exc.exception_message}</TableCell>
                                    <TableCell>{new Date(exc.required_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        <span className={exc.days_until_required < 0 ? 'text-red-600 font-bold' : ''}>
                                            {exc.days_until_required}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{exc.quantity}</TableCell>
                                    <TableCell className="text-right font-mono">{exc.current_stock}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        <span className={exc.shortage_qty > 0 ? 'text-red-600 font-bold' : ''}>
                                            {exc.shortage_qty}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm">{exc.source_of_demand || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}