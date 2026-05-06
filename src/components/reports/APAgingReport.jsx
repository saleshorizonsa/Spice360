
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function APAgingReport() {
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: apRecords = [] } = useQuery({
        queryKey: ['accountsPayable'],
        queryFn: () => base44.entities.AccountsPayable.list(),
        initialData: []
    });

    const calculateAging = () => {
        const today = new Date(asOfDate);
        const agingData = [];

        // Group by vendor
        const vendorGroups = {};
        apRecords.forEach(ap => {
            if (ap.payment_status !== 'paid') {
                if (!vendorGroups[ap.vendor_code]) {
                    vendorGroups[ap.vendor_code] = {
                        vendor_code: ap.vendor_code,
                        vendor_name: ap.vendor_name,
                        current: 0,
                        days_1_30: 0,
                        days_31_60: 0,
                        days_61_90: 0,
                        days_90_plus: 0,
                        total: 0
                    };
                }

                const dueDate = new Date(ap.due_date);
                const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                const outstanding = ap.outstanding_amount || 0;

                if (daysPastDue <= 0) {
                    vendorGroups[ap.vendor_code].current += outstanding;
                } else if (daysPastDue <= 30) {
                    vendorGroups[ap.vendor_code].days_1_30 += outstanding;
                } else if (daysPastDue <= 60) {
                    vendorGroups[ap.vendor_code].days_31_60 += outstanding;
                } else if (daysPastDue <= 90) {
                    vendorGroups[ap.vendor_code].days_61_90 += outstanding;
                } else {
                    vendorGroups[ap.vendor_code].days_90_plus += outstanding;
                }

                vendorGroups[ap.vendor_code].total += outstanding;
            }
        });

        return Object.values(vendorGroups).sort((a, b) => b.total - a.total);
    };

    const agingData = calculateAging();
    
    const totals = {
        current: agingData.reduce((sum, v) => sum + v.current, 0),
        days_1_30: agingData.reduce((sum, v) => sum + v.days_1_30, 0),
        days_31_60: agingData.reduce((sum, v) => sum + v.days_31_60, 0),
        days_61_90: agingData.reduce((sum, v) => sum + v.days_61_90, 0),
        days_90_plus: agingData.reduce((sum, v) => sum + v.days_90_plus, 0),
        total: agingData.reduce((sum, v) => sum + v.total, 0)
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Accounts Payable Aging Report
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <Label>As of Date</Label>
                        <Input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                        />
                    </div>
                    <div className="col-span-2 flex items-end">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                            Generate Report
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                    <Card className="bg-green-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Current</p>
                            <p className="text-lg font-bold text-green-700">
                                {(totals.current / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">1-30 Days</p>
                            <p className="text-lg font-bold text-blue-700">
                                {(totals.days_1_30 / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">31-60 Days</p>
                            <p className="text-lg font-bold text-yellow-700">
                                {(totals.days_31_60 / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">61-90 Days</p>
                            <p className="text-lg font-bold text-orange-700">
                                {(totals.days_61_90 / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">{">"}90 Days</p>
                            <p className="text-lg font-bold text-red-700">
                                {(totals.days_90_plus / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                        <CardContent className="p-3">
                            <p className="text-xs text-gray-600">Total</p>
                            <p className="text-lg font-bold text-indigo-700">
                                {(totals.total / 1000).toFixed(0)}K
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Aging Table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Vendor</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">1-30 Days</TableHead>
                                <TableHead className="text-right">31-60 Days</TableHead>
                                <TableHead className="text-right">61-90 Days</TableHead>
                                <TableHead className="text-right">{">"}90 Days</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agingData.map((vendor, idx) => (
                                <TableRow key={idx} className={vendor.days_90_plus > 0 ? 'bg-red-50' : vendor.days_61_90 > 0 ? 'bg-yellow-50' : ''}>
                                    <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vendor.current.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vendor.days_1_30.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vendor.days_31_60.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vendor.days_61_90.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {vendor.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                        {vendor.total.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell>TOTAL</TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.current.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.days_1_30.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.days_31_60.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.days_61_90.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.days_90_plus.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {totals.total.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
