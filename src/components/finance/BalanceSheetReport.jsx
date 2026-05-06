import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { BarChart3, Download } from "lucide-react";

export default function BalanceSheetReport() {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const { data: journals = [] } = useQuery({
        queryKey: ['journals', asOfDate],
        queryFn: async () => {
            const allJournals = await matrixSales.entities.JournalEntry.list('-posting_date');
            return allJournals.filter(j => j.posting_date <= asOfDate && j.status === 'posted');
        },
        initialData: []
    });

    const { data: arTransactions = [] } = useQuery({
        queryKey: ['ar'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: []
    });

    const { data: apTransactions = [] } = useQuery({
        queryKey: ['ap'],
        queryFn: () => matrixSales.entities.AccountsPayable.list(),
        initialData: []
    });

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list(),
        initialData: []
    });

    const calculateBalance = (accountCode, accountType) => {
        const accountJournals = journals.filter(j => j.account_code === accountCode);
        const debits = accountJournals.reduce((sum, j) => sum + (j.debit_amount || 0), 0);
        const credits = accountJournals.reduce((sum, j) => sum + (j.credit_amount || 0), 0);
        
        if (accountType === 'asset' || accountType === 'expense') {
            return debits - credits;
        } else {
            return credits - debits;
        }
    };

    const assetAccounts = chartOfAccounts
        .filter(a => a.account_type === 'asset')
        .map(a => ({ ...a, balance: calculateBalance(a.account_code, a.account_type) }))
        .filter(a => a.balance !== 0);

    const liabilityAccounts = chartOfAccounts
        .filter(a => a.account_type === 'liability')
        .map(a => ({ ...a, balance: calculateBalance(a.account_code, a.account_type) }))
        .filter(a => a.balance !== 0);

    const equityAccounts = chartOfAccounts
        .filter(a => a.account_type === 'equity')
        .map(a => ({ ...a, balance: calculateBalance(a.account_code, a.account_type) }))
        .filter(a => a.balance !== 0);

    const totalAR = arTransactions.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);
    const totalAP = apTransactions.reduce((sum, ap) => sum + (ap.outstanding_amount || 0), 0);
    const totalFixedAssets = assets.reduce((sum, a) => sum + (a.net_book_value || 0), 0);

    const totalAssets = assetAccounts.reduce((sum, a) => sum + a.balance, 0) + totalAR + totalFixedAssets;
    const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.balance, 0) + totalAP;
    const totalEquity = equityAccounts.reduce((sum, a) => sum + a.balance, 0);

    const handleExport = () => {
        const csv = [
            ['Balance Sheet'],
            [`As of: ${asOfDate}`],
            [''],
            ['ASSETS'],
            ...assetAccounts.map(acc => [acc.account_name, acc.balance.toFixed(2)]),
            ['Accounts Receivable', totalAR.toFixed(2)],
            ['Fixed Assets (NBV)', totalFixedAssets.toFixed(2)],
            ['Total Assets', totalAssets.toFixed(2)],
            [''],
            ['LIABILITIES'],
            ...liabilityAccounts.map(acc => [acc.account_name, acc.balance.toFixed(2)]),
            ['Accounts Payable', totalAP.toFixed(2)],
            ['Total Liabilities', totalLiabilities.toFixed(2)],
            [''],
            ['EQUITY'],
            ...equityAccounts.map(acc => [acc.account_name, acc.balance.toFixed(2)]),
            ['Total Equity', totalEquity.toFixed(2)],
            [''],
            ['Total Liabilities + Equity', (totalLiabilities + totalEquity).toFixed(2)]
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `balance_sheet_${asOfDate}.csv`;
        a.click();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Balance Sheet
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label>As of Date</Label>
                    <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="max-w-xs" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-3 text-blue-700">ASSETS</h3>
                        <Table>
                            <TableBody>
                                {assetAccounts.map((acc, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{acc.account_name}</TableCell>
                                        <TableCell className="text-right">{acc.balance.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell>Accounts Receivable</TableCell>
                                    <TableCell className="text-right">{totalAR.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Fixed Assets (NBV)</TableCell>
                                    <TableCell className="text-right">{totalFixedAssets.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-50 font-bold">
                                    <TableCell>Total Assets</TableCell>
                                    <TableCell className="text-right">SAR {totalAssets.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div>
                        <div>
                            <h3 className="font-semibold text-lg mb-3 text-red-700">LIABILITIES</h3>
                            <Table>
                                <TableBody>
                                    {liabilityAccounts.map((acc, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{acc.account_name}</TableCell>
                                            <TableCell className="text-right">{acc.balance.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell>Accounts Payable</TableCell>
                                        <TableCell className="text-right">{totalAP.toLocaleString()}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-red-50 font-bold">
                                        <TableCell>Total Liabilities</TableCell>
                                        <TableCell className="text-right">SAR {totalLiabilities.toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-6">
                            <h3 className="font-semibold text-lg mb-3 text-indigo-700">EQUITY</h3>
                            <Table>
                                <TableBody>
                                    {equityAccounts.map((acc, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{acc.account_name}</TableCell>
                                            <TableCell className="text-right">{acc.balance.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-indigo-50 font-bold">
                                        <TableCell>Total Equity</TableCell>
                                        <TableCell className="text-right">SAR {totalEquity.toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 rounded-lg border-2">
                    <div className="flex justify-between items-center text-xl font-bold">
                        <span>Total Liabilities + Equity</span>
                        <span>SAR {(totalLiabilities + totalEquity).toLocaleString()}</span>
                    </div>
                </div>

                {Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 && (
                    <div className="bg-red-50 p-4 rounded border border-red-200">
                        <p className="text-red-800 font-semibold">⚠️ Balance Sheet is not balanced!</p>
                        <p className="text-sm">
                            Difference: SAR {Math.abs(totalAssets - (totalLiabilities + totalEquity)).toLocaleString()}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}