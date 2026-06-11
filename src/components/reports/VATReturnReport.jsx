import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileCheck, Printer, TrendingUp, TrendingDown, Calculator } from "lucide-react";
import { useLanguage } from "@/components/utils/languageContext";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getQuarterRange(year, quarter) {
  const m = (quarter - 1) * 3;
  const start = new Date(year, m, 1);
  const end = new Date(year, m + 3, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `Q${quarter} ${year}`
  };
}

export default function VATReturnReport() {
  const { isRTL } = useLanguage();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const [year, setYear] = useState(String(currentYear));
  const [quarter, setQuarter] = useState(String(currentQuarter));

  const { start, end, label } = getQuarterRange(Number(year), Number(quarter));

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ["vat-invoices"],
    queryFn: () => matrixSales.entities.Invoice.list("-invoice_date", 9999),
    initialData: []
  });

  const { data: vendorInvoices = [], isLoading: loadingVI } = useQuery({
    queryKey: ["vat-vendor-invoices"],
    queryFn: async () => {
      try {
        return await matrixSales.entities.VendorInvoice.list("-invoice_date", 9999);
      } catch {
        return [];
      }
    },
    initialData: []
  });

  const stats = useMemo(() => {
    const outboundRaw = Array.isArray(invoices)
      ? invoices.filter(Boolean).filter((inv) => inv.invoice_date >= start && inv.invoice_date <= end && inv.status !== "cancelled")
      : [];
    const inboundRaw = Array.isArray(vendorInvoices)
      ? vendorInvoices.filter(Boolean).filter((vi) => (vi.invoice_date || vi.vendor_invoice_date || "") >= start && (vi.invoice_date || vi.vendor_invoice_date || "") <= end && vi.status !== "cancelled")
      : [];

    const outputTaxBase = outboundRaw.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const outputVAT = outboundRaw.reduce((s, i) => s + Number(i.tax_amount || 0), 0);
    const outputTotal = outboundRaw.reduce((s, i) => s + Number(i.total_amount || 0), 0);

    const inputTaxBase = inboundRaw.reduce((s, i) => s + Number(i.subtotal || i.amount_before_tax || 0), 0);
    const inputVAT = inboundRaw.reduce((s, i) => s + Number(i.tax_amount || i.vat_amount || 0), 0);
    const inputTotal = inboundRaw.reduce((s, i) => s + Number(i.total_amount || 0), 0);

    const netVAT = outputVAT - inputVAT;

    return { outboundRaw, inboundRaw, outputTaxBase, outputVAT, outputTotal, inputTaxBase, inputVAT, inputTotal, netVAT };
  }, [invoices, vendorInvoices, start, end]);

  const isLoading = loadingInv || loadingVI;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>VAT Return ${label}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}h1{color:#24466f;margin-bottom:4px}h3{margin:20px 0 8px;color:#475569}
table{width:100%;border-collapse:collapse;margin:0 0 16px}th{background:#24466f;color:#fff;padding:10px;text-align:left}
td{padding:10px;border-bottom:1px solid #e2e8f0}.num{text-align:right;font-family:monospace}
.bold{font-weight:700}.total-row{background:#f8fafc;font-weight:700}
.net{background:#24466f;color:#fff;font-weight:700;font-size:15px}
@media print{@page{size:A4;margin:15mm}}</style></head><body>
<h1>VAT Return Summary — ${label}</h1>
<p style="color:#64748b;margin-bottom:24px">Period: ${start} to ${end}</p>
<h3>Output Tax (Sales)</h3>
<table><tr><th>Description</th><th style="text-align:right">SAR</th></tr>
<tr><td>Taxable Sales (excl. VAT)</td><td class="num">${fmt(stats.outputTaxBase)}</td></tr>
<tr class="total-row"><td>Output VAT @ 15%</td><td class="num">${fmt(stats.outputVAT)}</td></tr>
<tr><td>Total incl. VAT</td><td class="num">${fmt(stats.outputTotal)}</td></tr></table>
<h3>Input Tax (Purchases)</h3>
<table><tr><th>Description</th><th style="text-align:right">SAR</th></tr>
<tr><td>Taxable Purchases (excl. VAT)</td><td class="num">${fmt(stats.inputTaxBase)}</td></tr>
<tr class="total-row"><td>Recoverable Input VAT</td><td class="num">${fmt(stats.inputVAT)}</td></tr>
<tr><td>Total incl. VAT</td><td class="num">${fmt(stats.inputTotal)}</td></tr></table>
<h3>Net VAT</h3>
<table><tr><th>Description</th><th style="text-align:right">SAR</th></tr>
<tr><td>Output VAT</td><td class="num">${fmt(stats.outputVAT)}</td></tr>
<tr><td>Less: Input VAT</td><td class="num">(${fmt(stats.inputVAT)})</td></tr>
<tr class="net"><td>${stats.netVAT >= 0 ? "VAT Payable to ZATCA" : "VAT Refundable"}</td><td class="num">${fmt(Math.abs(stats.netVAT))}</td></tr></table>
<p style="margin-top:24px;font-size:11px;color:#94a3b8">Generated ${new Date().toLocaleDateString()} — HORIZON ERP</p>
<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(String);

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>{isRTL ? "السنة" : "Year"}</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{isRTL ? "الربع" : "Quarter"}</Label>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 mb-0.5" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          {isRTL ? "طباعة / تصدير PDF" : "Print / PDF"}
        </Button>
      </div>

      <p className="text-sm text-slate-500">
        {isRTL ? "الفترة" : "Period"}: <strong>{label}</strong> ({start} – {end})
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-500">{isRTL ? "جارٍ التحميل..." : "Loading..."}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
                <TrendingUp className="h-4 w-4" />
                {isRTL ? "ضريبة المخرجات (المبيعات)" : "Output Tax (Sales)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{isRTL ? "المبيعات الخاضعة للضريبة" : "Taxable Sales"}</span>
                <span className="font-mono font-medium">LKR {fmt(stats.outputTaxBase)}</span>
              </div>
              <div className="flex justify-between border-t border-emerald-100 pt-2">
                <span className="font-semibold text-emerald-700">{isRTL ? "ضريبة القيمة المضافة 15%" : "VAT @ 15%"}</span>
                <span className="font-mono font-bold text-emerald-700">LKR {fmt(stats.outputVAT)}</span>
              </div>
              <p className="text-xs text-slate-400">{stats.outboundRaw.length} {isRTL ? "فاتورة" : "invoices"}</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-700">
                <TrendingDown className="h-4 w-4" />
                {isRTL ? "ضريبة المدخلات (المشتريات)" : "Input Tax (Purchases)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{isRTL ? "المشتريات الخاضعة للضريبة" : "Taxable Purchases"}</span>
                <span className="font-mono font-medium">LKR {fmt(stats.inputTaxBase)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-100 pt-2">
                <span className="font-semibold text-amber-700">{isRTL ? "ضريبة قابلة للاسترداد" : "Recoverable VAT"}</span>
                <span className="font-mono font-bold text-amber-700">LKR {fmt(stats.inputVAT)}</span>
              </div>
              <p className="text-xs text-slate-400">{stats.inboundRaw.length} {isRTL ? "فاتورة مورد" : "vendor invoices"}</p>
            </CardContent>
          </Card>

          <Card className={stats.netVAT >= 0 ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 text-base ${stats.netVAT >= 0 ? "text-red-700" : "text-blue-700"}`}>
                <Calculator className="h-4 w-4" />
                {isRTL ? "صافي الضريبة" : "Net VAT Position"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{isRTL ? "ضريبة المخرجات" : "Output VAT"}</span>
                <span className="font-mono">LKR {fmt(stats.outputVAT)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isRTL ? "ناقص: ضريبة المدخلات" : "Less: Input VAT"}</span>
                <span className="font-mono">(LKR {fmt(stats.inputVAT)})</span>
              </div>
              <div className={`flex justify-between border-t pt-2 ${stats.netVAT >= 0 ? "border-red-200" : "border-blue-200"}`}>
                <span className={`font-bold ${stats.netVAT >= 0 ? "text-red-700" : "text-blue-700"}`}>
                  {stats.netVAT >= 0
                    ? (isRTL ? "مستحق لهيئة الزكاة" : "Payable to ZATCA")
                    : (isRTL ? "مستحق الاسترداد" : "Refundable")}
                </span>
                <span className={`font-mono font-bold text-lg ${stats.netVAT >= 0 ? "text-red-700" : "text-blue-700"}`}>
                  LKR {fmt(Math.abs(stats.netVAT))}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && stats.outboundRaw.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck className="h-4 w-4 text-[#24466f]" />
              {isRTL ? "فواتير المبيعات في الفترة" : "Sales Invoices in Period"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400">
                    <th className="pb-2 text-left">{isRTL ? "رقم الفاتورة" : "Invoice #"}</th>
                    <th className="pb-2 text-left">{isRTL ? "التاريخ" : "Date"}</th>
                    <th className="pb-2 text-left">{isRTL ? "العميل" : "Customer"}</th>
                    <th className="pb-2 text-right">{isRTL ? "قبل الضريبة" : "Excl. VAT"}</th>
                    <th className="pb-2 text-right">{isRTL ? "الضريبة" : "VAT"}</th>
                    <th className="pb-2 text-right">{isRTL ? "الإجمالي" : "Total"}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.outboundRaw.slice(0, 50).map((inv) => (
                    <tr key={inv.id || inv.invoice_number} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="py-2 text-slate-500">{inv.invoice_date}</td>
                      <td className="py-2">{inv.customer_name}</td>
                      <td className="py-2 text-right font-mono">{fmt(inv.subtotal)}</td>
                      <td className="py-2 text-right font-mono text-emerald-600">{fmt(inv.tax_amount)}</td>
                      <td className="py-2 text-right font-mono font-semibold">{fmt(inv.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                    <td colSpan={3} className="py-2 text-slate-600">
                      {isRTL ? "الإجمالي" : "Total"} ({stats.outboundRaw.length})
                    </td>
                    <td className="py-2 text-right font-mono">LKR {fmt(stats.outputTaxBase)}</td>
                    <td className="py-2 text-right font-mono text-emerald-600">LKR {fmt(stats.outputVAT)}</td>
                    <td className="py-2 text-right font-mono">LKR {fmt(stats.outputTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
