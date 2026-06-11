import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Mail, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function GeneralLedgerReport() {
    const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
    const [selectedAccount, setSelectedAccount] = useState("ALL");
    const [costCenter, setCostCenter] = useState("ALL");

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const { data: journalEntries = [] } = useQuery({
        queryKey: ['journalEntries'],
        queryFn: () => matrixSales.entities.JournalEntry.list('-posting_date'),
        initialData: []
    });

    const filteredEntries = journalEntries.filter(entry => {
        const dateMatch = entry.posting_date >= periodStart && entry.posting_date <= periodEnd;
        const accountMatch = selectedAccount === 'ALL' || entry.account_code === selectedAccount;
        const costCenterMatch = costCenter === 'ALL' || entry.cost_center === costCenter;
        const statusMatch = entry.status === 'posted';
        return dateMatch && accountMatch && costCenterMatch && statusMatch;
    });

    let runningBalance = 0;
    const ledgerData = filteredEntries.map(entry => {
        runningBalance += (entry.debit_amount || 0) - (entry.credit_amount || 0);
        return {
            ...entry,
            running_balance: runningBalance
        };
    });

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const accountName = selectedAccount === 'ALL' ? 'All Accounts' : 
            chartOfAccounts.find(a => a.account_code === selectedAccount)?.account_name || selectedAccount;
        
        const content = `
            <html>
                <head>
                    <title>General Ledger - ${accountName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 12px; }
                        h1 { color: #059669; text-align: center; font-size: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .number { text-align: right; }
                        .footer { margin-top: 30px; font-size: 10px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - General Ledger Detail</h1>
                        <p><strong>Account:</strong> ${accountName}</p>
                        <p><strong>Period:</strong> ${new Date(periodStart).toLocaleDateString()} to ${new Date(periodEnd).toLocaleDateString()}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Document</th>
                                <th>Description</th>
                                <th>Cost Center</th>
                                <th class="number">Debit</th>
                                <th class="number">Credit</th>
                                <th class="number">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ledgerData.map(entry => `
                                <tr>
                                    <td>${new Date(entry.posting_date).toLocaleDateString()}</td>
                                    <td>${entry.journal_number}</td>
                                    <td>${entry.description}</td>
                                    <td>${entry.cost_center || '-'}</td>
                                    <td class="number">${entry.debit_amount ? entry.debit_amount.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}</td>
                                    <td class="number">${entry.credit_amount ? entry.credit_amount.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}</td>
                                    <td class="number">${entry.running_balance.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="footer">
                        <p>Generated on: ${new Date().toLocaleString()}</p>
                        <p>MatrixERP Financial Reporting System</p>
                    </div>
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
                        <FileText className="w-5 h-5 text-emerald-600" />
                        General Ledger Detail
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
                        <Button variant="outline" size="sm">
                            <Mail className="w-4 h-4 mr-2" />
                            Email
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
                        <Label>Account</Label>
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Accounts</SelectItem>
                                {chartOfAccounts.map(acc => (
                                    <SelectItem key={acc.account_code} value={acc.account_code}>
                                        {acc.account_code} - {acc.account_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Cost Center</Label>
                        <Select value={costCenter} onValueChange={setCostCenter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Cost Centers</SelectItem>
                                <SelectItem value="PROD">Production</SelectItem>
                                <SelectItem value="SALES">Sales</SelectItem>
                                <SelectItem value="ADMIN">Admin</SelectItem>
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
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Entries</p>
                            <p className="text-2xl font-bold text-blue-700">{ledgerData.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Debit</p>
                            <p className="text-xl font-bold text-emerald-700">
                                LKR {ledgerData.reduce((sum, e) => sum + (e.debit_amount || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Credit</p>
                            <p className="text-xl font-bold text-amber-700">
                                LKR {ledgerData.reduce((sum, e) => sum + (e.credit_amount || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Ending Balance</p>
                            <p className="text-xl font-bold text-indigo-700">
                                LKR {(ledgerData[ledgerData.length - 1]?.running_balance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Ledger Table */}
                <div className="rounded-lg border overflow-hidden max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Document #</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead>Cost Center</TableHead>
                                <TableHead className="text-right">Debit (LKR)</TableHead>
                                <TableHead className="text-right">Credit (LKR)</TableHead>
                                <TableHead className="text-right">Balance (LKR)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ledgerData.map((entry, idx) => (
                                <TableRow key={idx} className="hover:bg-gray-50">
                                    <TableCell>{new Date(entry.posting_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium">{entry.journal_number}</TableCell>
                                    <TableCell>{entry.description}</TableCell>
                                    <TableCell className="text-sm">{entry.account_code}</TableCell>
                                    <TableCell className="text-sm">{entry.cost_center || '-'}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {entry.debit_amount ? entry.debit_amount.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {entry.credit_amount ? entry.credit_amount.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                        {entry.running_balance.toLocaleString('en-US', {minimumFractionDigits: 2})}
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