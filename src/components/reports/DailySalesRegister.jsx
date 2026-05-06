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

export default function DailySalesRegister() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [branchFilter, setBranchFilter] = useState("ALL");
    const [groupBy, setGroupBy] = useState("customer");

    const { data: sales = [] } = useQuery({
        queryKey: ['salesOrders'],
        queryFn: () => base44.entities.SalesOrder.list('-order_date'),
        initialData: []
    });

    const filteredSales = sales.filter(s => {
        const dateMatch = s.order_date === selectedDate;
        const branchMatch = branchFilter === 'ALL' || s.branch_code === branchFilter;
        return dateMatch && branchMatch;
    });

    const totalSales = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalVAT = filteredSales.reduce((sum, s) => sum + (s.vat_amount || 0), 0);
    const totalBeforeVAT = totalSales - totalVAT;

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
                <head>
                    <title>Daily Sales Register - ${selectedDate}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
                        h1 { color: #059669; text-align: center; }
                        .header { text-align: center; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .number { text-align: right; font-family: monospace; }
                        .total-row { font-weight: bold; background-color: #e5e7eb; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>MatrixERP - Daily Sales Register</h1>
                        <p><strong>Date:</strong> ${new Date(selectedDate).toLocaleDateString()}</p>
                        <p><strong>Branch:</strong> ${branchFilter === 'ALL' ? 'All Branches' : branchFilter}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Product</th>
                                <th>Qty</th>
                                <th class="number">Amount Before VAT</th>
                                <th class="number">VAT (15%)</th>
                                <th class="number">Total Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredSales.map(sale => `
                                <tr>
                                    <td>${sale.order_number}</td>
                                    <td>${sale.customer_name}</td>
                                    <td>${sale.product_name}</td>
                                    <td>${sale.quantity}</td>
                                    <td class="number">${(sale.subtotal || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(sale.vat_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td class="number">${(sale.total_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                    <td>${sale.status}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="4">TOTAL</td>
                                <td class="number">${totalBeforeVAT.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totalVAT.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="number">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="margin-top: 20px; font-size: 10px; color: #6b7280;">
                        Generated on: ${new Date().toLocaleString()} | MatrixERP Sales Reporting System
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
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Daily Sales Register
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
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Branch</Label>
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Branches</SelectItem>
                                <SelectItem value="JED">Jeddah</SelectItem>
                                <SelectItem value="RUH">Riyadh</SelectItem>
                                <SelectItem value="DMM">Dammam</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Group By</Label>
                        <Select value={groupBy} onValueChange={setGroupBy}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="customer">Customer</SelectItem>
                                <SelectItem value="product">Product</SelectItem>
                                <SelectItem value="salesman">Salesman</SelectItem>
                                <SelectItem value="branch">Branch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold text-blue-700">{filteredSales.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Amount Before VAT</p>
                            <p className="text-2xl font-bold text-emerald-700">
                                SAR {(totalBeforeVAT / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Sales (Inc. VAT)</p>
                            <p className="text-2xl font-bold text-indigo-700">
                                SAR {(totalSales / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Sales Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Order #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Amount Before VAT</TableHead>
                                <TableHead className="text-right">VAT</TableHead>
                                <TableHead className="text-right">Total Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSales.map((sale, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{sale.order_number}</TableCell>
                                    <TableCell>{sale.customer_name}</TableCell>
                                    <TableCell>{sale.product_name}</TableCell>
                                    <TableCell className="text-right">{sale.quantity}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(sale.subtotal || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {(sale.vat_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {(sale.total_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="capitalize">{sale.status}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={4}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalBeforeVAT.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalVAT.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}