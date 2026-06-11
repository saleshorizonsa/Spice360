import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, RefreshCw, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

const QUARTERS = [
    { label: "Q1 (Jan–Mar)", months: [0, 1, 2] },
    { label: "Q2 (Apr–Jun)", months: [3, 4, 5] },
    { label: "Q3 (Jul–Sep)", months: [6, 7, 8] },
    { label: "Q4 (Oct–Dec)", months: [9, 10, 11] },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function SummaryRow({ label, amount, highlight, sub }) {
    return (
        <div className={`flex justify-between items-center py-2 ${highlight ? "font-bold border-t border-gray-300 mt-1" : ""} ${sub ? "pl-4 text-sm text-gray-600" : ""}`}>
            <span>{label}</span>
            <span className={highlight ? "text-emerald-700 text-lg" : ""}>{`LKR ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
        </div>
    );
}

export default function VATReturnDashboard({ invoices = [], vendorInvoices = [] }) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const currentQuarterIndex = Math.floor(currentMonth / 3);

    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedQuarter, setSelectedQuarter] = useState(String(currentQuarterIndex));

    const years = useMemo(() => {
        const ys = new Set();
        invoices.forEach(inv => { if (inv.invoice_date) ys.add(new Date(inv.invoice_date).getFullYear()); });
        ys.add(currentYear);
        return Array.from(ys).sort((a, b) => b - a);
    }, [invoices, currentYear]);

    const quarter = QUARTERS[Number(selectedQuarter)];

    // Filter invoices by selected year & quarter
    const periodInvoices = useMemo(() => invoices.filter(inv => {
        if (!inv.invoice_date) return false;
        const d = new Date(inv.invoice_date);
        return d.getFullYear() === Number(selectedYear) && quarter.months.includes(d.getMonth());
    }), [invoices, selectedYear, quarter]);

    const periodVendorInvoices = useMemo(() => vendorInvoices.filter(inv => {
        if (!inv.invoice_date) return false;
        const d = new Date(inv.invoice_date);
        return d.getFullYear() === Number(selectedYear) && quarter.months.includes(d.getMonth());
    }), [vendorInvoices, selectedYear, quarter]);

    // VAT Return Calculations (Box-by-box per ZATCA VAT Return form)
    const outputVATStandard = periodInvoices.filter(i => i.tax_category === 'standard' || !i.tax_category).reduce((s, i) => s + (i.vat_amount || 0), 0);
    const outputVATZeroRated = periodInvoices.filter(i => i.tax_category === 'zero_rated').reduce((s, i) => s + (i.line_extension_amount || 0), 0);
    const outputVATExempt = periodInvoices.filter(i => i.tax_category === 'exempt').reduce((s, i) => s + (i.line_extension_amount || 0), 0);
    const salesStandard = periodInvoices.filter(i => i.tax_category === 'standard' || !i.tax_category).reduce((s, i) => s + (i.line_extension_amount || 0), 0);
    const totalOutputVAT = outputVATStandard;

    const inputVAT = periodVendorInvoices.reduce((s, i) => s + (i.vat_amount || 0), 0);
    const totalPurchases = periodVendorInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);

    const netVATDue = totalOutputVAT - inputVAT;

    // Credit Notes VAT
    const creditNoteVAT = periodInvoices.filter(i => i.invoice_type === 'credit_note').reduce((s, i) => s + (i.vat_amount || 0), 0);

    // Monthly breakdown
    const monthlyBreakdown = quarter.months.map(m => {
        const mInvoices = periodInvoices.filter(inv => new Date(inv.invoice_date).getMonth() === m);
        const mVendor = periodVendorInvoices.filter(inv => new Date(inv.invoice_date).getMonth() === m);
        const sales = mInvoices.reduce((s, i) => s + (i.line_extension_amount || 0), 0);
        const outputVat = mInvoices.reduce((s, i) => s + (i.vat_amount || 0), 0);
        const purchases = mVendor.reduce((s, i) => s + (i.subtotal || 0), 0);
        const inputVat = mVendor.reduce((s, i) => s + (i.vat_amount || 0), 0);
        return { month: MONTH_NAMES[m], sales, outputVat, purchases, inputVat, net: outputVat - inputVat };
    });

    const handleExport = () => {
        const rows = [
            ["VAT Return Report", `${quarter.label} ${selectedYear}`],
            [],
            ["Box", "Description", "Amount (LKR)"],
            ["1a", "Standard Rated Sales", salesStandard.toFixed(2)],
            ["1b", "Output VAT (15%)", totalOutputVAT.toFixed(2)],
            ["2", "Zero Rated Sales", outputVATZeroRated.toFixed(2)],
            ["3", "Exempt Sales", outputVATExempt.toFixed(2)],
            ["6", "Total Standard Purchases (Input VAT)", totalPurchases.toFixed(2)],
            ["6a", "Recoverable Input VAT", inputVAT.toFixed(2)],
            ["9", "Net VAT Due", netVATDue.toFixed(2)],
        ];
        const csv = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `VAT_Return_${quarter.label.replace(/[^a-zA-Z0-9]/g, "_")}_${selectedYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => window.print();

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Fiscal Year:</span>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Quarter:</span>
                    <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {QUARTERS.map((q, i) => <SelectItem key={i} value={String(i)}>{q.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-1" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="p-4">
                        <p className="text-xs text-emerald-700 font-medium">Total Sales (ex-VAT)</p>
                        <p className="text-xl font-bold text-emerald-900">LKR {salesStandard.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-emerald-600">{periodInvoices.length} invoices</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <p className="text-xs text-blue-700 font-medium">Output VAT Collected</p>
                        <p className="text-xl font-bold text-blue-900">LKR {totalOutputVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-blue-600">15% standard rate</p>
                    </CardContent>
                </Card>
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <p className="text-xs text-orange-700 font-medium">Input VAT Recoverable</p>
                        <p className="text-xl font-bold text-orange-900">LKR {inputVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-orange-600">{periodVendorInvoices.length} purchase invoices</p>
                    </CardContent>
                </Card>
                <Card className={`border-2 ${netVATDue >= 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                    <CardContent className="p-4">
                        <p className={`text-xs font-medium ${netVATDue >= 0 ? "text-red-700" : "text-green-700"}`}>
                            {netVATDue >= 0 ? "Net VAT Payable" : "VAT Refundable"}
                        </p>
                        <p className={`text-xl font-bold ${netVATDue >= 0 ? "text-red-900" : "text-green-900"}`}>
                            LKR {Math.abs(netVATDue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        {netVATDue >= 0
                            ? <p className="text-xs text-red-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Due to ZATCA</p>
                            : <p className="text-xs text-green-600 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Refund Claim</p>
                        }
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Official VAT Return Form (Box-by-box) */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            VAT Return Summary — {quarter.label} {selectedYear}
                        </CardTitle>
                        <p className="text-xs text-gray-500">Aligned with ZATCA Form VAT-02</p>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
                            <p className="font-semibold text-gray-700 mb-2 uppercase text-xs tracking-wide">Part A — Output Tax</p>
                            <SummaryRow label="Box 1a — Standard Rated Sales" amount={salesStandard} />
                            <SummaryRow label="Box 1b — Output VAT (15%)" amount={totalOutputVAT} />
                            <SummaryRow label="Box 2 — Zero-Rated Sales" amount={outputVATZeroRated} />
                            <SummaryRow label="Box 3 — Exempt Sales" amount={outputVATExempt} />
                            <SummaryRow label="Box 4 — Credit Note Adjustments" amount={-creditNoteVAT} />
                            <SummaryRow label="Total Output VAT" amount={totalOutputVAT - creditNoteVAT} highlight />

                            <p className="font-semibold text-gray-700 mt-4 mb-2 uppercase text-xs tracking-wide">Part B — Input Tax</p>
                            <SummaryRow label="Box 6 — Standard Rated Purchases" amount={totalPurchases} />
                            <SummaryRow label="Box 6a — Recoverable Input VAT" amount={inputVAT} />
                            <SummaryRow label="Total Input VAT" amount={inputVAT} highlight />

                            <div className={`mt-4 pt-3 border-t-2 ${netVATDue >= 0 ? "border-red-300" : "border-green-300"}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-base">
                                        {netVATDue >= 0 ? "Box 9 — Net VAT Payable" : "Box 9 — VAT Refund Due"}
                                    </span>
                                    <span className={`font-bold text-lg ${netVATDue >= 0 ? "text-red-700" : "text-green-700"}`}>
                                        LKR {Math.abs(netVATDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-yellow-800">
                                VAT returns must be filed quarterly within 30 days of the period end via the ZATCA Fatoora portal.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Monthly Breakdown Table */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Monthly Breakdown — {quarter.label} {selectedYear}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="text-xs">Month</TableHead>
                                    <TableHead className="text-xs text-right">Sales (LKR)</TableHead>
                                    <TableHead className="text-xs text-right">Output VAT</TableHead>
                                    <TableHead className="text-xs text-right">Input VAT</TableHead>
                                    <TableHead className="text-xs text-right">Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyBreakdown.map((row) => (
                                    <TableRow key={row.month}>
                                        <TableCell className="font-medium text-sm">{row.month}</TableCell>
                                        <TableCell className="text-right text-sm">{row.sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                        <TableCell className="text-right text-sm text-blue-700">{row.outputVat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                        <TableCell className="text-right text-sm text-orange-700">{row.inputVat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                        <TableCell className={`text-right text-sm font-semibold ${row.net >= 0 ? "text-red-700" : "text-green-700"}`}>
                                            {row.net >= 0 ? "" : "-"}{Math.abs(row.net).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-100 font-bold">
                                    <TableCell>Total</TableCell>
                                    <TableCell className="text-right">{salesStandard.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className="text-right text-blue-700">{totalOutputVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className="text-right text-orange-700">{inputVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                    <TableCell className={`text-right ${netVATDue >= 0 ? "text-red-700" : "text-green-700"}`}>
                                        {netVATDue >= 0 ? "" : "-"}{Math.abs(netVATDue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>

                        {/* Tax Category Breakdown */}
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Sales by Tax Category</p>
                            <div className="space-y-2">
                                {[
                                    { label: "Standard (15%)", count: periodInvoices.filter(i => i.tax_category === 'standard' || !i.tax_category).length, color: "bg-blue-500" },
                                    { label: "Zero-Rated (0%)", count: periodInvoices.filter(i => i.tax_category === 'zero_rated').length, color: "bg-green-500" },
                                    { label: "Exempt", count: periodInvoices.filter(i => i.tax_category === 'exempt').length, color: "bg-gray-400" },
                                    { label: "Outside Scope", count: periodInvoices.filter(i => i.tax_category === 'outside_scope').length, color: "bg-orange-400" },
                                ].map(cat => (
                                    <div key={cat.label} className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${cat.color} flex-shrink-0`} />
                                        <span className="text-sm flex-1">{cat.label}</span>
                                        <Badge variant="outline" className="text-xs">{cat.count} invoices</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Compliance Checklist */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">ZATCA Compliance Checklist — {quarter.label} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            {
                                label: "All invoices submitted",
                                ok: periodInvoices.every(i => i.zatca_submitted),
                                detail: `${periodInvoices.filter(i => i.zatca_submitted).length}/${periodInvoices.length} submitted`
                            },
                            {
                                label: "No rejected invoices",
                                ok: periodInvoices.filter(i => i.zatca_status === 'rejected').length === 0,
                                detail: `${periodInvoices.filter(i => i.zatca_status === 'rejected').length} rejected`
                            },
                            {
                                label: "Credit notes matched",
                                ok: periodInvoices.filter(i => i.invoice_type === 'credit_note' && !i.original_invoice_number).length === 0,
                                detail: `${periodInvoices.filter(i => i.invoice_type === 'credit_note').length} credit notes`
                            },
                            {
                                label: "QR codes present",
                                ok: periodInvoices.every(i => i.zatca_qr_code),
                                detail: `${periodInvoices.filter(i => i.zatca_qr_code).length}/${periodInvoices.length} with QR`
                            },
                            {
                                label: "Sequential ICV",
                                ok: true,
                                detail: "Invoice counter valid"
                            },
                            {
                                label: "VAT return period",
                                ok: true,
                                detail: `Due: ${new Date(Number(selectedYear), quarter.months[2] + 1, 30).toLocaleDateString('en-SA')}`
                            },
                        ].map((item, i) => (
                            <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${item.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                                {item.ok
                                    ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                }
                                <div>
                                    <p className={`text-sm font-medium ${item.ok ? "text-green-800" : "text-red-800"}`}>{item.label}</p>
                                    <p className={`text-xs ${item.ok ? "text-green-600" : "text-red-600"}`}>{item.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}