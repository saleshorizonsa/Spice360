import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileText, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DocumentNumberingGapsReport() {
    const [branch, setBranch] = useState("ALL");

    const { data: documentSeries = [] } = useQuery({
        queryKey: ['documentSeries'],
        queryFn: () => base44.entities.DocumentNumberSeries.list(),
        initialData: []
    });

    const filteredSeries = documentSeries.filter(s => 
        branch === 'ALL' || s.branch_code === branch
    );

    // Detect gaps/issues
    const seriesWithIssues = filteredSeries.map(series => {
        const issues = [];
        
        // Check if nearing exhaustion
        const remaining = (series.max_number || 999999) - (series.current_number || 0);
        if (remaining < 100) {
            issues.push(`Only ${remaining} numbers remaining`);
        }
        
        // Check if exhausted
        if (series.status === 'exhausted') {
            issues.push('Series exhausted');
        }
        
        // Check reserved numbers
        if (series.reserved_numbers && series.reserved_numbers.length > 0) {
            issues.push(`${series.reserved_numbers.length} reserved/voided numbers`);
        }
        
        return {
            ...series,
            issues,
            remaining
        };
    }).filter(s => s.issues.length > 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Document Numbering Gaps/Voids Report
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Branch</Label>
                        <Select value={branch} onValueChange={setBranch}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Branches</SelectItem>
                                <SelectItem value="JED">Jeddah</SelectItem>
                                <SelectItem value="RUH">Riyadh</SelectItem>
                                <SelectItem value="DMM">Dammam</SelectItem>
                                <SelectItem value="YAN">Yanbu</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Series</p>
                            <p className="text-2xl font-bold text-gray-900">{filteredSeries.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Issues Detected</p>
                            <p className="text-2xl font-bold text-orange-600">{seriesWithIssues.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Exhausted</p>
                            <p className="text-2xl font-bold text-red-600">
                                {filteredSeries.filter(s => s.status === 'exhausted').length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Issues Table */}
                {seriesWithIssues.length > 0 && (
                    <Card className="bg-orange-50 border-orange-200 mb-6">
                        <CardHeader>
                            <CardTitle className="text-lg text-orange-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Number Series Requiring Attention
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border border-orange-200 overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-orange-100">
                                            <TableHead>Document Type</TableHead>
                                            <TableHead>Branch</TableHead>
                                            <TableHead>Current Number</TableHead>
                                            <TableHead>Max Number</TableHead>
                                            <TableHead>Remaining</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Issues</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {seriesWithIssues.map((series, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{series.document_type}</TableCell>
                                                <TableCell>{series.branch_code}</TableCell>
                                                <TableCell>{series.current_number}</TableCell>
                                                <TableCell>{series.max_number}</TableCell>
                                                <TableCell>
                                                    <Badge className={series.remaining < 50 ? 'bg-red-600' : 'bg-orange-600'}>
                                                        {series.remaining}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="capitalize">{series.status}</TableCell>
                                                <TableCell>
                                                    {series.issues.map((issue, i) => (
                                                        <div key={i} className="text-xs text-orange-700">{issue}</div>
                                                    ))}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* All Series Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Document Type</TableHead>
                                <TableHead>Prefix</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Fiscal Year</TableHead>
                                <TableHead>Current Number</TableHead>
                                <TableHead>Max Number</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Generated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSeries.map((series, idx) => (
                                <TableRow key={idx} className="hover:bg-gray-50">
                                    <TableCell className="font-medium capitalize">
                                        {series.document_type.replace(/_/g, ' ')}
                                    </TableCell>
                                    <TableCell>{series.prefix}</TableCell>
                                    <TableCell>{series.branch_code}</TableCell>
                                    <TableCell>{series.fiscal_year}</TableCell>
                                    <TableCell className="font-mono">{series.current_number}</TableCell>
                                    <TableCell className="font-mono">{series.max_number}</TableCell>
                                    <TableCell>
                                        <Badge className={
                                            series.status === 'active' ? 'bg-green-600' :
                                            series.status === 'exhausted' ? 'bg-red-600' :
                                            'bg-gray-600'
                                        }>
                                            {series.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {series.last_generated_date 
                                            ? new Date(series.last_generated_date).toLocaleDateString()
                                            : '-'}
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