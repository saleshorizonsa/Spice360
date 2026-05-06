import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function VATReturnReport() {
    const [periodFilter, setPeriodFilter] = useState("2025-01");
    const [frequencyFilter, setFrequencyFilter] = useState("all");

    const { data: vatReturns = [] } = useQuery({
        queryKey: ['vatReturns'],
        queryFn: () => base44.entities.VATReturn.list('-period_start'),
        initialData: []
    });

    const filteredReturns = vatReturns.filter(vat => {
        const periodMatch = !periodFilter || vat.return_period.includes(periodFilter);
        const freqMatch = frequencyFilter === 'all' || vat.filing_frequency === frequencyFilter;
        return periodMatch && freqMatch;
    });

    const handleExportPDF = (vatReturn) => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>VAT Return - ${vatReturn.return_period}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 12px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 30px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .number { text-align: right; font-family: monospace; }
                        .section { font-weight: bold; background-color: #e5e7eb; }
                        .total { font-weight: bold; background-color: #d1d5db; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>VAT RETURN</h1>
                        <p><strong>Period:</strong> ${vatReturn.return_period}</p>
                        <p><strong>From:</strong> ${vatReturn.period_start} <strong>To:</strong> ${vatReturn.period_end}</p>
                        <p><strong>Frequency:</strong> ${vatReturn.filing_frequency}</p>
                    </div>
                    <table>
                        <tr class="section">
                            <td colspan="2">OUTPUT VAT (Sales)</td>
                        </tr>
                        <tr>
                            <td>Standard Rated Sales (15%)</td>
                            <td class="number">${vatReturn.standard_rated_sales?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>VAT on Standard Sales</td>
                            <td class="number">${vatReturn.standard_rated_vat?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>Zero-Rated Sales (Exports)</td>
                            <td class="number">${vatReturn.zero_rated_sales?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>Exempt Sales</td>
                            <td class="number">${vatReturn.exempt_sales?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td><strong>Total Sales</strong></td>
                            <td class="number"><strong>${vatReturn.total_sales?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Total Output VAT</strong></td>
                            <td class="number"><strong>${vatReturn.output_vat_total?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</strong></td>
                        </tr>
                        <tr class="section">
                            <td colspan="2">INPUT VAT (Purchases)</td>
                        </tr>
                        <tr>
                            <td>Standard Rated Purchases</td>
                            <td class="number">${vatReturn.standard_rated_purchases?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>Recoverable Input VAT</td>
                            <td class="number">${vatReturn.input_vat?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>Imports Subject to VAT</td>
                            <td class="number">${vatReturn.imports_subject_to_vat?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>VAT Paid on Imports</td>
                            <td class="number">${vatReturn.imports_vat_paid?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>RCM Purchases</td>
                            <td class="number">${vatReturn.rcm_purchases?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td>RCM VAT</td>
                            <td class="number">${vatReturn.rcm_vat?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr>
                            <td><strong>Total Input VAT</strong></td>
                            <td class="number"><strong>${vatReturn.input_vat_total?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</strong></td>
                        </tr>
                        <tr class="total">
                            <td><strong>NET VAT</strong></td>
                            <td class="number"><strong>${vatReturn.net_vat?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</strong></td>
                        </tr>
                        <tr>
                            <td>Corrections from Previous Periods</td>
                            <td class="number">${vatReturn.corrections_previous_period?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}</td>
                        </tr>
                        <tr class="total">
                            <td><strong>NET VAT DUE</strong></td>
                            <td class="number"><strong>${vatReturn.net_vat_due?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'} SAR</strong></td>
                        </tr>
                    </table>
                    <p style="margin-top: 30px;">
                        <strong>Status:</strong> ${vatReturn.filing_status}<br>
                        <strong>Prepared By:</strong> ${vatReturn.prepared_by || 'N/A'}<br>
                        <strong>Reviewed By:</strong> ${vatReturn.reviewed_by || 'N/A'}<br>
                        <strong>Approved By:</strong> ${vatReturn.approved_by || 'N/A'}
                    </p>
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Compliance System
                    </p>
                </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    const getBadgeColor = (status) => {
        const colors = {
            draft: "bg-gray-100 text-gray-800",
            submitted: "bg-blue-100 text-blue-800",
            accepted: "bg-green-100 text-green-800",
            paid: "bg-emerald-100 text-emerald-800",
            amended: "bg-yellow-100 text-yellow-800"
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        VAT Return Summary (Standard/Zero-Rated/Exempt/RCM)
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export Excel
                        </Button>
                        <Button variant="outline" size="sm">
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Period</Label>
                        <Input
                            type="month"
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Frequency</Label>
                        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* VAT Returns Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Period</TableHead>
                                <TableHead>Frequency</TableHead>
                                <TableHead className="text-right">Standard Sales</TableHead>
                                <TableHead className="text-right">Output VAT</TableHead>
                                <TableHead className="text-right">Input VAT</TableHead>
                                <TableHead className="text-right">Net VAT Due</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReturns.map((vat, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{vat.return_period}</TableCell>
                                    <TableCell className="capitalize">{vat.filing_frequency}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vat.standard_rated_sales?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vat.output_vat_total?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vat.input_vat_total?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {vat.net_vat_due?.toLocaleString('en-US', {minimumFractionDigits: 2}) || '0.00'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={getBadgeColor(vat.filing_status)}>
                                            {vat.filing_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleExportPDF(vat)}
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
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