import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, CheckCircle2, XCircle, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function InspectionResultsReport() {
    const [periodStart, setPeriodStart] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
    const [inspectionType, setInspectionType] = useState("ALL");
    const [resultFilter, setResultFilter] = useState("ALL");

    const { data: inspectionLots = [] } = useQuery({
        queryKey: ['inspectionLots'],
        queryFn: () => base44.entities.InspectionLot.list('-lot_date'),
        initialData: []
    });

    const { data: inspectionResults = [] } = useQuery({
        queryKey: ['inspectionResults'],
        queryFn: () => base44.entities.InspectionResult.list(),
        initialData: []
    });

    const filteredInspections = inspectionLots.filter(lot => {
        const dateMatch = lot.lot_date >= periodStart && lot.lot_date <= periodEnd;
        const typeMatch = inspectionType === 'ALL' || lot.inspection_type === inspectionType;
        const resultMatch = resultFilter === 'ALL' || lot.result === resultFilter;
        return dateMatch && typeMatch && resultMatch;
    });

    // Summary by type
    const summary = {
        incoming: filteredInspections.filter(i => i.inspection_type === 'incoming'),
        in_process: filteredInspections.filter(i => i.inspection_type === 'in_process'),
        final: filteredInspections.filter(i => i.inspection_type === 'final'),
        random: filteredInspections.filter(i => i.inspection_type === 'random')
    };

    const getResultBadge = (result) => {
        const colors = {
            accepted: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            conditional: "bg-yellow-100 text-yellow-800",
            pending: "bg-gray-100 text-gray-800"
        };
        return colors[result] || colors.pending;
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>Inspection Results Report - ${periodStart} to ${periodEnd}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .accepted { background-color: #d1fae5; }
                        .rejected { background-color: #fee2e2; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - Inspection Results Report</h1>
                        <p><strong>Period:</strong> ${new Date(periodStart).toLocaleDateString()} to ${new Date(periodEnd).toLocaleDateString()}</p>
                        <p><strong>Total Inspections:</strong> ${filteredInspections.length}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Lot #</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Material</th>
                                <th>Batch</th>
                                <th>Inspector</th>
                                <th>Sample Size</th>
                                <th>Result</th>
                                <th>Disposition</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredInspections.map(lot => `
                                <tr class="${lot.result}">
                                    <td>${lot.inspection_lot_number}</td>
                                    <td>${new Date(lot.lot_date).toLocaleDateString()}</td>
                                    <td>${lot.inspection_type}</td>
                                    <td>${lot.material_name}</td>
                                    <td>${lot.batch_number || '-'}</td>
                                    <td>${lot.inspector_name}</td>
                                    <td>${lot.sample_size}</td>
                                    <td><strong>${lot.result}</strong></td>
                                    <td>${lot.disposition}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Quality Management System
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
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Incoming / In-Process / FG Inspection Results
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
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
                        <Label>Inspection Type</Label>
                        <Select value={inspectionType} onValueChange={setInspectionType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Types</SelectItem>
                                <SelectItem value="incoming">Incoming</SelectItem>
                                <SelectItem value="in_process">In-Process</SelectItem>
                                <SelectItem value="final">Final / FG</SelectItem>
                                <SelectItem value="random">Random</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Result</Label>
                        <Select value={resultFilter} onValueChange={setResultFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Results</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="conditional">Conditional</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            <Search className="w-4 h-4 mr-2" />
                            Generate
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Incoming</p>
                            <p className="text-2xl font-bold text-blue-700">{summary.incoming.length}</p>
                            <p className="text-xs text-gray-600 mt-1">
                                Pass: {summary.incoming.filter(i => i.result === 'accepted').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">In-Process</p>
                            <p className="text-2xl font-bold text-purple-700">{summary.in_process.length}</p>
                            <p className="text-xs text-gray-600 mt-1">
                                Pass: {summary.in_process.filter(i => i.result === 'accepted').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Final / FG</p>
                            <p className="text-2xl font-bold text-emerald-700">{summary.final.length}</p>
                            <p className="text-xs text-gray-600 mt-1">
                                Pass: {summary.final.filter(i => i.result === 'accepted').length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Random</p>
                            <p className="text-2xl font-bold text-amber-700">{summary.random.length}</p>
                            <p className="text-xs text-gray-600 mt-1">
                                Pass: {summary.random.filter(i => i.result === 'accepted').length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Inspection Table */}
                <div className="rounded-lg border overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                                <TableHead>Lot #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Material</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Inspector</TableHead>
                                <TableHead className="text-right">Sample Size</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Disposition</TableHead>
                                <TableHead>COA</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInspections.map((lot, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{lot.inspection_lot_number}</TableCell>
                                    <TableCell>{new Date(lot.lot_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="capitalize">{lot.inspection_type.replace('_', ' ')}</TableCell>
                                    <TableCell>{lot.material_name}</TableCell>
                                    <TableCell>{lot.batch_number || '-'}</TableCell>
                                    <TableCell>{lot.inspector_name}</TableCell>
                                    <TableCell className="text-right font-mono">{lot.sample_size}</TableCell>
                                    <TableCell>
                                        <Badge className={getResultBadge(lot.result)}>
                                            {lot.result === 'accepted' ? <CheckCircle2 className="w-3 h-3 mr-1 inline" /> : 
                                             lot.result === 'rejected' ? <XCircle className="w-3 h-3 mr-1 inline" /> : null}
                                            {lot.result}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="capitalize">{lot.disposition.replace('_', ' ')}</TableCell>
                                    <TableCell>
                                        {lot.coa_generated ? (
                                            <Badge className="bg-green-100 text-green-800">
                                                {lot.coa_number}
                                            </Badge>
                                        ) : (
                                            <span className="text-gray-400 text-sm">Pending</span>
                                        )}
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