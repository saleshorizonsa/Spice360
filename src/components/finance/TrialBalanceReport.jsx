import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Printer, Download } from "lucide-react";

export default function TrialBalanceReport() {
    const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const { data: journals = [] } = useQuery({
        queryKey: ['journals', fromDate, toDate],
        queryFn: () => matrixSales.entities.JournalEntry.filter({
            posting_date: { $gte: fromDate, $lte: toDate },
            status: 'posted'
        }),
        initialData: []
    });

    const trialBalanceData = chartOfAccounts.map(account => {
        const accountJournals = journals.filter(j => j.account_code === account.account_code);
        const totalDebit = accountJournals.reduce((sum, j) => sum + (j.debit_amount || 0), 0);
        const totalCredit = accountJournals.reduce((sum, j) => sum + (j.credit_amount || 0), 0);
        const balance = totalDebit - totalCredit;

        return {
            account_code: account.account_code,
            account_name: account.account_name,
            account_type: account.account_type,
            opening_balance: account.opening_balance || 0,
            debit: totalDebit,
            credit: totalCredit,
            closing_balance: (account.opening_balance || 0) + balance
        };
    }).filter(acc => acc.debit > 0 || acc.credit > 0 || acc.opening_balance !== 0);

    const totalDebit = trialBalanceData.reduce((sum, acc) => sum + acc.debit, 0);
    const totalCredit = trialBalanceData.reduce((sum, acc) => sum + acc.credit, 0);
    const totalClosingBalance = trialBalanceData.reduce((sum, acc) => sum + Math.abs(acc.closing_balance), 0);

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const csv = [
            ['Account Code', 'Account Name', 'Type', 'Opening Balance', 'Debit', 'Credit', 'Closing Balance'],
            ...trialBalanceData.map(acc => [
                acc.account_code,
                acc.account_name,
                acc.account_type,
                acc.opening_balance.toFixed(2),
                acc.debit.toFixed(2),
                acc.credit.toFixed(2),
                acc.closing_balance.toFixed(2)
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial_balance_${fromDate}_${toDate}.csv`;
        a.click();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Trial Balance Report
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>From Date</Label>
                        <Input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>To Date</Label>
                        <Input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Account Code</TableHead>
                                <TableHead>Account Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Opening</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right">Closing</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {trialBalanceData.map((acc, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-mono">{acc.account_code}</TableCell>
                                    <TableCell>{acc.account_name}</TableCell>
                                    <TableCell className="capitalize">{acc.account_type}</TableCell>
                                    <TableCell className="text-right">
                                        {acc.opening_balance.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-green-700">
                                        {acc.debit > 0 ? acc.debit.toLocaleString() : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-red-700">
                                        {acc.credit > 0 ? acc.credit.toLocaleString() : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {acc.closing_balance.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={4}>TOTAL</TableCell>
                                <TableCell className="text-right text-green-700">
                                    {totalDebit.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-red-700">
                                    {totalCredit.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    {totalClosingBalance.toLocaleString()}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {totalDebit !== totalCredit && (
                    <div className="bg-red-50 p-4 rounded border border-red-200">
                        <p className="text-red-800 font-semibold">
                            ⚠️ Warning: Debits and Credits are not balanced!
                        </p>
                        <p className="text-sm text-red-600">
                            Difference: SAR {Math.abs(totalDebit - totalCredit).toLocaleString()}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}