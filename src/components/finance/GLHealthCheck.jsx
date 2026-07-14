import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Stethoscope } from "lucide-react";
import { buildGlHealthReport } from "@/lib/glHealthAudit";
import { useGLAccounts } from "@/hooks/useGLAccounts";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Read-only diagnostic for the damage left by the vendor-invoice journal defects
 * fixed in 9b03fc7. Reports only — it writes nothing and posts nothing.
 */
export default function GLHealthCheck() {
  const gl = useGLAccounts();

  const { data: vendorInvoices = [], isLoading: l1 } = useQuery({
    queryKey: ["vendorInvoices"],
    queryFn: () => matrixSales.entities.VendorInvoice.list(),
    initialData: [],
  });
  const { data: journalEntries = [], isLoading: l2 } = useQuery({
    queryKey: ["journalEntries"],
    queryFn: () => matrixSales.entities.JournalEntry.list(),
    initialData: [],
  });
  const { data: journalLines = [], isLoading: l3 } = useQuery({
    queryKey: ["journalLines"],
    queryFn: () => matrixSales.entities.JournalLine.list(),
    initialData: [],
  });

  const report = useMemo(
    () => buildGlHealthReport({ vendorInvoices, journalEntries, journalLines, gl }),
    [vendorInvoices, journalEntries, journalLines, gl]
  );

  if (l1 || l2 || l3) {
    return <div className="py-8 text-center text-sm text-gray-500">Checking the ledger…</div>;
  }

  const { unposted, purchaseCogs, grni, isHealthy } = report;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-indigo-600" />
          General Ledger Health Check
          {isHealthy ? (
            <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">Healthy</Badge>
          ) : (
            <Badge className="border border-red-300 bg-red-100 text-red-800">Action needed</Badge>
          )}
        </CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          Finds damage left by three vendor-invoice posting defects. Read-only — this changes nothing.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isHealthy && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            No unposted invoices, no purchase-side COGS, and GRNI is fully cleared.
          </div>
        )}

        {/* 1 — invoices that never reached the ledger */}
        {unposted.totals.count > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {unposted.totals.count} approved invoice(s) are NOT in the general ledger — LKR{" "}
              {money(unposted.totals.value)}
            </div>
            <p className="mt-1 text-xs text-red-700">
              These are recorded in Accounts Payable but never posted to the GL, so Trade Payables and your stock
              are understated by the <strong>full invoice value</strong>. {unposted.totals.withCharges} of them carry
              a transport charge — that is what unbalanced the entry and made the posting fail silently.
              <strong> To fix: open each invoice and re-approve it</strong> — it will post correctly now.
            </p>
            <div className="mt-2 overflow-x-auto rounded border border-red-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-red-100 text-red-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Invoice</th>
                    <th className="px-3 py-2 text-left font-medium">Vendor</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Transport</th>
                    <th className="px-3 py-2 text-right font-medium">Total missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unposted.missing.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-3 py-2 font-mono text-xs">{inv.vendor_invoice_number}</td>
                      <td className="px-3 py-2 text-gray-600">{inv.vendor_name || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{inv.invoice_date || "—"}</td>
                      <td className="px-3 py-2 text-right">{inv.freight_cost ? money(inv.freight_cost) : "—"}</td>
                      <td className="px-3 py-2 text-right font-bold text-red-700">{money(inv.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2 — COGS double counted */}
        {purchaseCogs.totals.count > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              COGS overstated by up to LKR {money(purchaseCogs.totals.value)} across{" "}
              {purchaseCogs.totals.count} purchase posting(s)
            </div>
            <p className="mt-1 text-xs text-amber-800">
              These journal entries debited Cost of Goods Sold at <strong>purchase</strong> time. Your sales invoices
              debit COGS again when the goods are <strong>sold</strong>, so anything bought and then sold was
              expensed twice — understating profit. Purchases no longer touch COGS. To correct the history, post a
              reclassification journal moving these amounts out of COGS (into Inventory, or reversing them if the
              goods were later sold and expensed again).
            </p>
          </div>
        )}

        {/* 3 — GRNI never cleared */}
        {grni.uncleared >= 0.01 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Goods Received Not Invoiced is carrying LKR {money(grni.uncleared)} that was never cleared
            </div>
            <p className="mt-1 text-xs text-amber-800">
              GRNI is a clearing account: a GRN credits it, and the vendor invoice should debit it back. Nothing
              ever debited it, so it has accumulated as a phantom liability on your Balance Sheet. Credited{" "}
              <strong>{money(grni.credited)}</strong>, debited <strong>{money(grni.debited)}</strong>.
              Invoices posted from now on will clear it. Receipts already invoiced under the old behaviour need a
              reclassification journal (Dr GRNI / Cr the account their cost was wrongly sent to).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
