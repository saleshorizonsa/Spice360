import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileText } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";

const BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"];
const BUCKET_LABELS  = { current: "Current", "1-30": "1–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "90+ days" };
const BUCKET_PREVIEW = { current: "bg-green-50 border-green-200 text-green-800", "1-30": "bg-yellow-50 border-yellow-200 text-yellow-800", "31-60": "bg-orange-50 border-orange-200 text-orange-800", "61-90": "bg-red-50 border-red-200 text-red-800", "90+": "bg-red-100 border-red-300 text-red-900" };

const fmt = (n) => `LKR ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CustomerStatementDialog({ onClose }) {
    const { currentOrg } = useOrganization();
    const [selectedCustomer, setSelectedCustomer] = useState("__all__");

    const { data: arRecords = [], isLoading } = useQuery({
        queryKey: ["ar-statement"],
        queryFn: () => matrixSales.entities.AccountsReceivable.list("-invoice_date"),
        initialData: [],
    });

    const customers = useMemo(() => {
        const seen = new Set();
        return arRecords
            .filter((ar) => ar.customer_name && !seen.has(ar.customer_name) && seen.add(ar.customer_name))
            .map((ar) => ({ name: ar.customer_name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [arRecords]);

    const filteredAR = useMemo(() =>
        arRecords.filter((ar) => {
            const outstanding = parseFloat(ar.outstanding_amount) || 0;
            if (outstanding <= 0.01) return false;
            if (ar.status === "closed") return false;
            if (selectedCustomer !== "__all__") return ar.customer_name === selectedCustomer;
            return true;
        }),
        [arRecords, selectedCustomer]
    );

    const grouped = useMemo(() => {
        const map = {};
        filteredAR.forEach((ar) => {
            const key = ar.customer_name;
            if (!map[key]) map[key] = { name: key, customer_code: ar.customer_code || "", rows: [], byBucket: {} };
            map[key].rows.push(ar);
            const b = ar.aging_bucket || "current";
            map[key].byBucket[b] = (map[key].byBucket[b] || 0) + (parseFloat(ar.outstanding_amount) || 0);
        });
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredAR]);

    const grandTotal = filteredAR.reduce((s, ar) => s + (parseFloat(ar.outstanding_amount) || 0), 0);

    // Bucket totals across all customers
    const bucketTotals = useMemo(() => {
        const t = {};
        filteredAR.forEach((ar) => {
            const b = ar.aging_bucket || "current";
            t[b] = (t[b] || 0) + (parseFloat(ar.outstanding_amount) || 0);
        });
        return t;
    }, [filteredAR]);

    const handlePrint = () => {
        const orgName = currentOrg?.organization_name || currentOrg?.trade_name || "COMPANY";
        const today = new Date().toLocaleDateString("en-LK", { day: "2-digit", month: "long", year: "numeric" });

        let rows = "";
        grouped.forEach((group) => {
            const groupTotal = group.rows.reduce((s, r) => s + (parseFloat(r.outstanding_amount) || 0), 0);
            rows += `
                <tr class="cust-header-row">
                    <td colspan="7" class="cust-header-cell">
                        <span>${group.name}</span>
                        <span>Outstanding: ${fmt(groupTotal)}</span>
                    </td>
                </tr>
                ${group.rows.map((ar) => `
                    <tr>
                        <td class="mono">${ar.invoice_number || "—"}</td>
                        <td>${ar.invoice_date || "—"}</td>
                        <td>${ar.due_date || "—"}</td>
                        <td class="num">${fmt(ar.invoice_amount)}</td>
                        <td class="num green">${fmt(ar.paid_amount)}</td>
                        <td class="num ${ar.aging_bucket !== "current" ? "red" : ""}">${fmt(ar.outstanding_amount)}</td>
                        <td class="center aging-${(ar.aging_bucket || "current").replace("+", "p")}">${ar.aging_bucket || "current"}</td>
                    </tr>
                `).join("")}
                <tr class="subtotal-row">
                    <td colspan="5" class="num"><strong>Sub-total</strong></td>
                    <td class="num"><strong>${fmt(groupTotal)}</strong></td>
                    <td></td>
                </tr>
                <tr class="bucket-row">
                    <td colspan="7" class="bucket-cell">
                        ${BUCKETS.map((b) => group.byBucket[b] > 0 ? `<span class="bk bk-${b.replace("+", "p")}">${BUCKET_LABELS[b]}: ${fmt(group.byBucket[b])}</span>` : "").join("")}
                    </td>
                </tr>
                <tr class="spacer"><td colspan="7"></td></tr>`;
        });

        const bucketSummaryHtml = BUCKETS.map((b) => bucketTotals[b] > 0
            ? `<div class="sum-bk bk-${b.replace("+", "p")}"><div class="bk-label">${BUCKET_LABELS[b]}</div><div class="bk-val">${fmt(bucketTotals[b])}</div></div>`
            : "").join("");

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Customer Aged Statement</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:20px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #059669;padding-bottom:12px;margin-bottom:20px}
.org{font-size:18px;font-weight:700;color:#059669}.title h1{font-size:15px;font-weight:700;text-align:right}.title .sub{font-size:10px;color:#64748b;text-align:right;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-bottom:4px}
th{background:#1e293b;color:#fff;padding:6px 8px;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.04em}
th.num,td.num{text-align:right}td.center{text-align:center}
td{padding:4px 8px;border-bottom:1px solid #f1f5f9}tr:nth-child(even)>td:not(.cust-header-cell){background:#f8fafc}
.mono{font-family:monospace;color:#4338ca}.green{color:#16a34a}.red{color:#dc2626}
.cust-header-row .cust-header-cell{background:#f1f5f9;border-left:4px solid #059669;font-weight:700;font-size:12px;padding:6px 10px;display:flex;justify-content:space-between}
.subtotal-row td{background:#f0fdf4;font-size:11px}
.bucket-cell{padding:4px 8px}.bk{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;margin-right:6px;border:1px solid #e2e8f0}
.bk-current{background:#d1fae5;color:#065f46}.bk-1-30{background:#fef3c7;color:#92400e}.bk-31-60{background:#ffedd5;color:#9a3412}.bk-61-90{background:#fee2e2;color:#991b1b}.bk-90p{background:#fecaca;color:#7f1d1d;font-weight:700}
.spacer td{height:12px}
.aging-current{color:#059669}.aging-1-30{color:#d97706}.aging-31-60{color:#ea580c}.aging-61-90{color:#dc2626}.aging-90p{color:#7f1d1d;font-weight:700}
.summary{margin-top:24px;border-top:2px solid #059669;padding-top:16px}
.sum-title{font-size:12px;font-weight:700;margin-bottom:10px}
.sum-grid{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px}
.sum-bk{padding:8px 14px;border-radius:6px;border:1px solid #e2e8f0;min-width:140px}.bk-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.bk-val{font-size:13px;font-weight:700}
.grand{text-align:right;font-size:16px;font-weight:700;color:#059669;margin-top:8px}
@media print{body{padding:10px}@page{size:A4 portrait;margin:10mm}}</style>
</head><body>
<div class="header"><div class="org">${orgName}</div><div class="title"><h1>Customer Aged Statement</h1><div class="sub">As at ${today} · ${selectedCustomer !== "__all__" ? selectedCustomer : "All Customers"}</div></div></div>
<table><thead><tr><th>Invoice #</th><th>Invoice Date</th><th>Due Date</th><th class="num">Invoice Amt (LKR)</th><th class="num">Paid (LKR)</th><th class="num">Outstanding (LKR)</th><th class="center">Aging</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="summary"><div class="sum-title">Aging Summary</div><div class="sum-grid">${bucketSummaryHtml}</div>
<div class="grand">Grand Total Outstanding: ${fmt(grandTotal)}</div></div>
<script>window.onload=()=>window.print()<\/script></body></html>`;

        const w = window.open("", "_blank");
        w.document.write(html);
        w.document.close();
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Customer Aged Statement
                    </DialogTitle>
                </DialogHeader>

                {/* Filters */}
                <div className="flex items-end gap-4 pb-4 border-b">
                    <div className="flex-1 max-w-xs">
                        <Label>Customer</Label>
                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Customers</SelectItem>
                                {customers.map((c) => (
                                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
                        <Printer className="w-4 h-4 mr-2" /> Print / PDF
                    </Button>
                </div>

                {/* Bucket summary bar */}
                {filteredAR.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-2">
                        {BUCKETS.map((b) => bucketTotals[b] > 0 ? (
                            <span key={b} className={`text-xs px-3 py-1 rounded-full border font-medium ${BUCKET_PREVIEW[b]}`}>
                                {BUCKET_LABELS[b]}: {fmt(bucketTotals[b])}
                            </span>
                        ) : null)}
                        <span className="text-xs px-3 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold ml-auto">
                            Total Outstanding: {fmt(grandTotal)}
                        </span>
                    </div>
                )}

                {/* Preview */}
                {isLoading ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
                ) : grouped.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">No outstanding AR records found.</div>
                ) : (
                    <div className="space-y-5">
                        {grouped.map((group) => {
                            const total = group.rows.reduce((s, r) => s + (parseFloat(r.outstanding_amount) || 0), 0);
                            return (
                                <div key={group.name} className="border rounded-lg overflow-hidden">
                                    <div className="flex justify-between items-center bg-gray-50 px-4 py-2 border-b border-l-4 border-l-emerald-500">
                                        <span className="font-semibold text-sm">{group.name}</span>
                                        <span className="text-sm font-bold text-emerald-700">{fmt(total)}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-700 text-white">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                                                    <th className="px-3 py-2 text-left font-medium">Invoice Date</th>
                                                    <th className="px-3 py-2 text-left font-medium">Due Date</th>
                                                    <th className="px-3 py-2 text-right font-medium">Invoice Amt</th>
                                                    <th className="px-3 py-2 text-right font-medium">Paid</th>
                                                    <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                                                    <th className="px-3 py-2 text-center font-medium">Aging</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {group.rows.map((ar) => (
                                                    <tr key={ar.id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-1.5 font-mono text-indigo-700 font-medium">{ar.invoice_number || "—"}</td>
                                                        <td className="px-3 py-1.5 text-gray-600">{ar.invoice_date || "—"}</td>
                                                        <td className="px-3 py-1.5 text-gray-600">{ar.due_date || "—"}</td>
                                                        <td className="px-3 py-1.5 text-right">{fmt(ar.invoice_amount)}</td>
                                                        <td className="px-3 py-1.5 text-right text-green-700">{fmt(ar.paid_amount)}</td>
                                                        <td className={`px-3 py-1.5 text-right font-semibold ${ar.aging_bucket !== "current" ? "text-red-600" : ""}`}>
                                                            {fmt(ar.outstanding_amount)}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${BUCKET_PREVIEW[ar.aging_bucket || "current"]}`}>
                                                                {ar.aging_bucket || "current"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-green-50">
                                                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Sub-total</td>
                                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(total)}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="flex flex-wrap gap-2 px-4 py-2 bg-gray-50 border-t">
                                        {BUCKETS.map((b) => group.byBucket[b] > 0 ? (
                                            <span key={b} className={`text-xs px-2 py-0.5 rounded-full border ${BUCKET_PREVIEW[b]}`}>
                                                {BUCKET_LABELS[b]}: <strong>{fmt(group.byBucket[b])}</strong>
                                            </span>
                                        ) : null)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
