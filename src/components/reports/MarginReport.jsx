import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MarginReport() {
    const [periodStart, setPeriodStart] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
    const [analysisLevel, setAnalysisLevel] = useState("invoice");

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => base44.entities.Invoice.list('-invoice_date'),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const filteredInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.invoice_date);
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        return invDate >= start && invDate <= end;
    });

    // Calculate margins
    const marginData = filteredInvoices.map(inv => {
        const material = materials.find(m => m.material_code === inv.product_code);
        const cost = (material?.unit_cost || 0) * (inv.quantity || 0);
        const revenue = inv.line_extension_amount || 0;
        const margin = revenue - cost;
        const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

        return {
            invoice_number: inv.invoice_number,
            customer_name: inv.customer_name,
            product_name: inv.product_name,
            quantity: inv.quantity,
            revenue,
            cost,
            margin,
            marginPercent
        };
    });

    const totalRevenue = marginData.reduce((sum, m) => sum + m.revenue, 0);
    const totalCost = marginData.reduce((sum, m) => sum + m.cost, 0);
    const totalMargin = totalRevenue - totalCost;
    const avgMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Margin Analysis Report
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>From Date</Label>
                        <Input
                            type="date"
                            value={periodStart}
                            onChange={(e) => setPeriodStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>To Date</Label>
                        <Input
                            type="date"
                            value={periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Analysis Level</Label>
                        <Select value={analysisLevel} onValueChange={setAnalysisLevel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoice">By Invoice</SelectItem>
                                <SelectItem value="customer">By Customer</SelectItem>
                                <SelectItem value="product">By Product</SelectItem>
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
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-blue-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Revenue</p>
                            <p className="text-2xl font-bold text-blue-700">
                                SAR {(totalRevenue / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Cost</p>
                            <p className="text-2xl font-bold text-orange-700">
                                SAR {(totalCost / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Total Margin</p>
                            <p className="text-2xl font-bold text-emerald-700">
                                SAR {(totalMargin / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-600">Avg Margin %</p>
                            <p className="text-2xl font-bold text-indigo-700">
                                {avgMarginPercent.toFixed(1)}%
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Margin Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Margin (SAR)</TableHead>
                                <TableHead className="text-right">Margin %</TableHead>
                                <TableHead>Trend</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {marginData.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{item.invoice_number}</TableCell>
                                    <TableCell>{item.customer_name}</TableCell>
                                    <TableCell>{item.product_name}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.revenue.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.cost.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {item.margin.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {item.marginPercent.toFixed(1)}%
                                    </TableCell>
                                    <TableCell>
                                        {item.marginPercent >= 20 ? (
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <TrendingDown className="w-5 h-5 text-red-600" />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={4}>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalCost.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totalMargin.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {avgMarginPercent.toFixed(1)}%
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