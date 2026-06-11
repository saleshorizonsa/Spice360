import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Landmark, Download } from "lucide-react";

export default function CashFlowStatementReport() {
    const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: payments = [] } = useQuery({
        queryKey: ['payments', fromDate, toDate],
        queryFn: async () => {
            const allPayments = await matrixSales.entities.Payment.list('-payment_date');
            return allPayments.filter(p => 
                p.payment_date >= fromDate && 
                p.payment_date <= toDate &&
                p.status === 'cleared'
            );
        },
        initialData: []
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices', fromDate, toDate],
        queryFn: async () => {
            const allInvoices = await matrixSales.entities.Invoice.list('-invoice_date');
            return allInvoices.filter(i => 
                i.invoice_date >= fromDate && 
                i.invoice_date <= toDate &&
                i.payment_status === 'paid'
            );
        },
        initialData: []
    });

    const { data: vendorInvoices = [] } = useQuery({
        queryKey: ['vendorInvoices', fromDate, toDate],
        queryFn: async () => {
            const allVInvoices = await matrixSales.entities.VendorInvoice.list('-invoice_date');
            return allVInvoices.filter(v => 
                v.invoice_date >= fromDate && 
                v.invoice_date <= toDate
            );
        },
        initialData: []
    });

    // Operating Activities
    const cashFromCustomers = invoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
    const cashToSuppliers = vendorInvoices.reduce((sum, v) => sum + (v.paid_amount || 0), 0);
    const cashFromOperations = cashFromCustomers - cashToSuppliers;

    // Investing Activities
    const investingPayments = payments.filter(p => 
        p.payment_type === 'outgoing' && 
        (p.category === 'fixed_asset' || p.category === 'investment')
    );
    const cashUsedInInvesting = investingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Financing Activities
    const financingInflows = payments.filter(p => 
        p.payment_type === 'incoming' && 
        p.category === 'loan'
    ).reduce((sum, p) => sum + (p.amount || 0), 0);

    const financingOutflows = payments.filter(p => 
        p.payment_type === 'outgoing' && 
        (p.category === 'loan_repayment' || p.category === 'dividend')
    ).reduce((sum, p) => sum + (p.amount || 0), 0);

    const cashFromFinancing = financingInflows - financingOutflows;

    // Net Change in Cash
    const netCashChange = cashFromOperations - cashUsedInInvesting + cashFromFinancing;

    const handleExport = () => {
        const csv = [
            ['Cash Flow Statement'],
            [`Period: ${fromDate} to ${toDate}`],
            [''],
            ['OPERATING ACTIVITIES'],
            ['Cash from Customers', cashFromCustomers.toFixed(2)],
            ['Cash to Suppliers', (-cashToSuppliers).toFixed(2)],
            ['Net Cash from Operations', cashFromOperations.toFixed(2)],
            [''],
            ['INVESTING ACTIVITIES'],
            ['Capital Expenditure', (-cashUsedInInvesting).toFixed(2)],
            ['Net Cash from Investing', (-cashUsedInInvesting).toFixed(2)],
            [''],
            ['FINANCING ACTIVITIES'],
            ['Loan Proceeds', financingInflows.toFixed(2)],
            ['Loan Repayments', (-financingOutflows).toFixed(2)],
            ['Net Cash from Financing', cashFromFinancing.toFixed(2)],
            [''],
            ['NET CHANGE IN CASH', netCashChange.toFixed(2)]
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash_flow_${fromDate}_${toDate}.csv`;
        a.click();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-indigo-600" />
                        Cash Flow Statement
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
                        <h3 className="font-semibold text-lg mb-3 text-emerald-700">OPERATING ACTIVITIES</h3>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Cash from Customers</TableCell>
                                    <TableCell className="text-right text-green-700">LKR {cashFromCustomers.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Cash to Suppliers</TableCell>
                                    <TableCell className="text-right text-red-700">(LKR {cashToSuppliers.toLocaleString()})</TableCell>
                                </TableRow>
                                <TableRow className="bg-emerald-50 font-semibold">
                                    <TableCell>Net Cash from Operations</TableCell>
                                    <TableCell className="text-right">LKR {cashFromOperations.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg mb-3 text-blue-700">INVESTING ACTIVITIES</h3>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Capital Expenditure</TableCell>
                                    <TableCell className="text-right text-red-700">(LKR {cashUsedInInvesting.toLocaleString()})</TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-50 font-semibold">
                                    <TableCell>Net Cash from Investing</TableCell>
                                    <TableCell className="text-right">(LKR {cashUsedInInvesting.toLocaleString()})</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg mb-3 text-purple-700">FINANCING ACTIVITIES</h3>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Loan Proceeds</TableCell>
                                    <TableCell className="text-right text-green-700">LKR {financingInflows.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Loan Repayments & Dividends</TableCell>
                                    <TableCell className="text-right text-red-700">(LKR {financingOutflows.toLocaleString()})</TableCell>
                                </TableRow>
                                <TableRow className="bg-purple-50 font-semibold">
                                    <TableCell>Net Cash from Financing</TableCell>
                                    <TableCell className="text-right">LKR {cashFromFinancing.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className={`p-6 rounded-lg border-2 ${netCashChange >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-bold">NET CHANGE IN CASH</span>
                            <span className={`text-3xl font-bold ${netCashChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                LKR {netCashChange.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}