import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TrendingUp, Download, Printer } from "lucide-react";

export default function IncomeStatementReport() {
    const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: journals = [] } = useQuery({
        queryKey: ['journals', fromDate, toDate],
        queryFn: async () => {
            const allJournals = await matrixSales.entities.JournalEntry.list('-posting_date');
            return allJournals.filter(j => 
                j.posting_date >= fromDate && 
                j.posting_date <= toDate &&
                j.status === 'posted'
            );
        },
        initialData: []
    });

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    // Calculate revenue and expenses
    const revenueAccounts = chartOfAccounts.filter(a => a.account_type === 'revenue');
    const expenseAccounts = chartOfAccounts.filter(a => a.account_type === 'expense');

    const calculateAccountBalance = (accountCode) => {
        const accountJournals = journals.filter(j => j.account_code === accountCode);
        const credits = accountJournals.reduce((sum, j) => sum + (j.credit_amount || 0), 0);
        const debits = accountJournals.reduce((sum, j) => sum + (j.debit_amount || 0), 0);
        return credits - debits; // Revenue increases with credits
    };

    const revenueData = revenueAccounts.map(acc => ({
        ...acc,
        amount: calculateAccountBalance(acc.account_code)
    })).filter(acc => acc.amount !== 0);

    const expenseData = expenseAccounts.map(acc => ({
        ...acc,
        amount: Math.abs(calculateAccountBalance(acc.account_code))
    })).filter(acc => acc.amount !== 0);

    const totalRevenue = revenueData.reduce((sum, acc) => sum + acc.amount, 0);
    const totalExpenses = expenseData.reduce((sum, acc) => sum + acc.amount, 0);
    const netIncome = totalRevenue - totalExpenses;
    const grossProfit = totalRevenue * 0.4; // Simplified - you'd calculate from COGS
    const operatingIncome = totalRevenue - totalExpenses;

    const handleExport = () => {
        const csv = [
            ['Income Statement'],
            [`Period: ${fromDate} to ${toDate}`],
            [''],
            ['REVENUE'],
            ...revenueData.map(acc => [acc.account_name, acc.amount.toFixed(2)]),
            ['Total Revenue', totalRevenue.toFixed(2)],
            [''],
            ['EXPENSES'],
            ...expenseData.map(acc => [acc.account_name, acc.amount.toFixed(2)]),
            ['Total Expenses', totalExpenses.toFixed(2)],
            [''],
            ['Net Income', netIncome.toFixed(2)]
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `income_statement_${fromDate}_${toDate}.csv`;
        a.click();
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>Income Statement</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        h1 { color: #059669; text-align: center; }
                        h3 { color: #374151; margin-top: 30px; }
                        .period { text-align: center; color: #6b7280; margin-bottom: 30px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                        th { background-color: #f3f4f6; font-weight: 600; }
                        .total { font-weight: bold; background-color: #f9fafb; }
                        .net-income { font-size: 1.2em; font-weight: bold; background-color: #d1fae5; }
                        .amount { text-align: right; }
                        .positive { color: #059669; }
                        .negative { color: #dc2626; }
                    </style>
                </head>
                <body>
                    <h1>Income Statement (Profit & Loss)</h1>
                    <p class="period">Period: ${fromDate} to ${toDate}</p>
                    
                    <h3>REVENUE</h3>
                    <table>
                        ${revenueData.map(acc => `
                            <tr>
                                <td>${acc.account_name}</td>
                                <td class="amount">SAR ${acc.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td>Total Revenue</td>
                            <td class="amount">SAR ${totalRevenue.toLocaleString()}</td>
                        </tr>
                    </table>
                    
                    <h3>EXPENSES</h3>
                    <table>
                        ${expenseData.map(acc => `
                            <tr>
                                <td>${acc.account_name}</td>
                                <td class="amount">SAR ${acc.amount.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        <tr class="total">
                            <td>Total Expenses</td>
                            <td class="amount">SAR ${totalExpenses.toLocaleString()}</td>
                        </tr>
                    </table>
                    
                    <table style="margin-top: 30px;">
                        <tr class="net-income">
                            <td><strong>NET INCOME</strong></td>
                            <td class="amount ${netIncome >= 0 ? 'positive' : 'negative'}">
                                SAR ${netIncome.toLocaleString()}
                            </td>
                        </tr>
                    </table>
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
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                        Income Statement (P&L)
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>From Date</Label>
                        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div>
                        <Label>To Date</Label>
                        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-3 text-emerald-700">REVENUE</h3>
                        <Table>
                            <TableBody>
                                {revenueData.map((acc, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{acc.account_name}</TableCell>
                                        <TableCell className="text-right">SAR {acc.amount.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-emerald-50 font-semibold">
                                    <TableCell>Total Revenue</TableCell>
                                    <TableCell className="text-right">SAR {totalRevenue.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg mb-3 text-red-700">EXPENSES</h3>
                        <Table>
                            <TableBody>
                                {expenseData.map((acc, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{acc.account_name}</TableCell>
                                        <TableCell className="text-right">SAR {acc.amount.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-red-50 font-semibold">
                                    <TableCell>Total Expenses</TableCell>
                                    <TableCell className="text-right">SAR {totalExpenses.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className={`p-6 rounded-lg border-2 ${netIncome >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-bold">NET INCOME</span>
                            <span className={`text-3xl font-bold ${netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                SAR {netIncome.toLocaleString()}
                            </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                            Profit Margin: {totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : 0}%
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}