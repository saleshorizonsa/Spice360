import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TrialBalanceReport() {
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
    const [branchCode, setBranchCode] = useState("ALL");
    const [showZeroBalances, setShowZeroBalances] = useState(false);

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const { data: journalEntries = [] } = useQuery({
        queryKey: ['journalEntries'],
        queryFn: () => matrixSales.entities.JournalEntry.list(),
        initialData: []
    });

    // Calculate trial balance
    const calculateTrialBalance = () => {
        const balances = {};
        
        // Initialize all accounts
        chartOfAccounts.forEach(account => {
            balances[account.account_code] = {
                account_code: account.account_code,
                account_name: account.account_name,
                account_type: account.account_type,
                debit: 0,
                credit: 0,
                balance: account.opening_balance || 0
            };
        });

        // Sum up journal entries up to period end
        journalEntries.forEach(entry => {
            if (entry.posting_date <= periodEnd && entry.status === 'posted') {
                if (balances[entry.account_code]) {
                    balances[entry.account_code].debit += entry.debit_amount || 0;
                    balances[entry.account_code].credit += entry.credit_amount || 0;
                }
            }
        });

        // Calculate net balance
        Object.keys(balances).forEach(code => {
            const acc = balances[code];
            if (['asset', 'expense'].includes(acc.account_type)) {
                acc.balance = acc.balance + acc.debit - acc.credit;
            } else {
                acc.balance = acc.balance + acc.credit - acc.debit;
            }
        });

        return Object.values(balances).filter(acc => 
            showZeroBalances || Math.abs(acc.balance) > 0.01
        );
    };

    const trialBalanceData = calculateTrialBalance();
    
    const totalDebit = trialBalanceData.reduce((sum, acc) => 
        sum + (acc.balance > 0 && ['asset', 'expense'].includes(acc.account_type) ? acc.balance : 0), 0
    );
    
    const totalCredit = trialBalanceData.reduce((sum, acc) => 
        sum + (acc.balance > 0 && ['liability', 'equity', 'revenue'].includes(acc.account_type) ? acc.balance : 0), 0
    );

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>Trial Balance - ${periodEnd}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 30px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .number { text-align: right; }
                        .total-row { font-weight: bold; background-color: #e5e7eb; }
                        .footer { margin-top: 30px; font-size: 12px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP</h1>
                        <h2>Trial Balance</h2>
                        <p>As of ${new Date(periodEnd).toLocaleDateString()}</p>
                        <p>${branchCode === 'ALL' ? 'Consolidated - All Branches' : `Branch: ${branchCode}`}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Account Code</th>
                                <th>Account Name</th>
                                <th>Type</th>
                                <th class="number">Debit (SAR)</th>
                                <th class="number">Credit (SAR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trialBalanceData.map(acc => `
                                <tr>
                                    <td>${acc.account_code}</td>
                                    <td>${acc.account_name}</td>
                                    <td>${acc.account_type}</td>
                                    <td class="number">${acc.balance > 0 && ['asset', 'expense'].includes(acc.account_type) ? acc.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                    <td class="number">${acc.balance > 0 && ['liability', 'equity', 'revenue'].includes(acc.account_type) ? acc.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="3">TOTAL</td>
                                <td class="number">${totalDebit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td class="number">${totalCredit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="3">DIFFERENCE</td>
                                <td colspan="2" class="number">${Math.abs(totalDebit - totalCredit).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
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
                        Trial Balance Report
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>Period End Date</Label>
                        <Input
                            type="date"
                            value={periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Branch</Label>
                        <Select value={branchCode} onValueChange={setBranchCode}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Branches (Consolidated)</SelectItem>
                                <SelectItem value="JED">Jeddah</SelectItem>
                                <SelectItem value="RUH">Riyadh</SelectItem>
                                <SelectItem value="DMM">Dammam</SelectItem>
                                <SelectItem value="YAN">Yanbu</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showZeroBalances}
                                onChange={(e) => setShowZeroBalances(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm">Show Zero Balances</span>
                        </label>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Report Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Debit</p>
                            <p className="text-2xl font-bold text-blue-700">
                                SAR {totalDebit.toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Credit</p>
                            <p className="text-2xl font-bold text-emerald-700">
                                SAR {totalCredit.toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className={Math.abs(totalDebit - totalCredit) < 0.01 ? "bg-green-50" : "bg-red-50"}>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Difference</p>
                            <p className={`text-2xl font-bold ${Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>
                                SAR {Math.abs(totalDebit - totalCredit).toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Trial Balance Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Account Code</TableHead>
                                <TableHead>Account Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Debit (SAR)</TableHead>
                                <TableHead className="text-right">Credit (SAR)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {trialBalanceData.map((acc, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{acc.account_code}</TableCell>
                                    <TableCell>{acc.account_name}</TableCell>
                                    <TableCell className="capitalize">{acc.account_type}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {acc.balance > 0 && ['asset', 'expense'].includes(acc.account_type)
                                            ? acc.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                                            : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {acc.balance > 0 && ['liability', 'equity', 'revenue'].includes(acc.account_type)
                                            ? acc.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                                            : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={3}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalDebit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalCredit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}