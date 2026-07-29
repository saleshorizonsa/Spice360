import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, CheckCircle2, PackageSearch } from "lucide-react";
import { diagnoseFreightToStock, assessFreightGlLeg } from "@/lib/freightStockDiagnosis";
import { logAuditTrail } from "../utils/auditTrail";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useOrganization } from "../utils/OrganizationContext";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REASON_TEXT = {
  no_freight: "This invoice has no freight or other charges to capitalise.",
  no_grn_linked: "Freight is present but no GRN is linked, so there is no stock position to cost. Link the GRN on the invoice first.",
  stock_not_matched: "The linked GRN does not match any stock row (material / warehouse / bin / batch). The goods may have been moved, or received to a different location.",
  all_stranded: "The received material has already been fully issued or sold, so freight cannot be added to a per-unit cost. Use the Freight → Cost of Goods Sold tool instead.",
  nothing_to_apply: "Nothing to apply.",
};

/**
 * Repair a vendor invoice whose freight was posted to the Inventory GL but never
 * reached the per-unit stock cost. Looks the invoice up by number, shows exactly
 * where the capitalisation dropped out, and re-applies it on demand. Read-only until
 * Apply; refuses to run twice (checks landed_cost_applied).
 */
export default function FreightStockRepairTool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gl = useGLAccounts();
  const { currentOrg } = useOrganization();
  const [numberInput, setNumberInput] = useState("");
  const [query, setQuery] = useState("");
  const [glDate, setGlDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: invoices = [] } = useQuery({
    queryKey: ["vendorInvoices"],
    queryFn: () => matrixSales.entities.VendorInvoice.list("-invoice_date"),
    initialData: [],
  });
  const { data: grns = [] } = useQuery({
    queryKey: ["grns"],
    queryFn: () => matrixSales.entities.GoodsReceiptNote.list("-grn_date"),
    initialData: [],
  });
  const { data: stockLevels = [] } = useQuery({
    queryKey: ["stockLevels"],
    queryFn: () => matrixSales.entities.StockLevel.list(),
    initialData: [],
  });
  const { data: journalEntries = [] } = useQuery({
    queryKey: ["journalEntries"],
    queryFn: () => matrixSales.entities.JournalEntry.list(),
    initialData: [],
  });
  const { data: journalLines = [] } = useQuery({
    queryKey: ["journalLines"],
    queryFn: () => matrixSales.entities.JournalLine.list(),
    initialData: [],
  });

  const invoice = useMemo(() => {
    if (!query) return null;
    const q = query.trim().toLowerCase();
    return invoices.find((i) => String(i.vendor_invoice_number || "").toLowerCase() === q) || null;
  }, [query, invoices]);

  const diagnosis = useMemo(
    () => (invoice ? diagnoseFreightToStock({ invoice, grns, stockLevels }) : null),
    [invoice, grns, stockLevels]
  );

  const glLeg = useMemo(
    () => (invoice ? assessFreightGlLeg({ invoice, journalEntries, journalLines, gl }) : null),
    [invoice, journalEntries, journalLines, gl]
  );

  const alreadyApplied = !!invoice?.landed_cost_applied;
  const canApply = !!diagnosis && diagnosis.reason === null && !alreadyApplied;

  const postGlLegMutation = useMutation({
    mutationFn: async () => {
      const amount = glLeg?.glGap || 0;
      if (!(amount > 0)) throw new Error("No Inventory GL gap to post.");
      if (currentOrg?.id) await assertPeriodAllowed(glDate, currentOrg.id, "gl");

      const je = await postJournalEntry({
        lines: [
          { account_code: gl.inventory, account_name: "Inventory", debit: amount, credit: 0, description: `Capitalise freight — Vendor invoice ${invoice.vendor_invoice_number}` },
          { account_code: gl.freight_accrual, account_name: "Freight Accrual", debit: 0, credit: amount, description: `Inbound freight accrual — Vendor invoice ${invoice.vendor_invoice_number}` },
        ],
        referenceType: "vendor_invoice",
        referenceId: invoice.vendor_invoice_number,
        description: `Freight capitalisation — missing GL leg — Vendor invoice ${invoice.vendor_invoice_number}`,
        entryDate: glDate,
        entryType: "adjustment",
        orgId: currentOrg?.id,
        area: "gl",
      });
      await logAuditTrail({
        entityType: "vendor_invoice",
        entityId: invoice.id,
        documentNumber: invoice.vendor_invoice_number,
        actionType: "freight_gl_leg_repair",
        afterData: { amount, inventory: gl.inventory, freight_accrual: gl.freight_accrual },
        severity: "warning",
      }).catch(() => {});
      return je;
    },
    onSuccess: (je) => {
      queryClient.invalidateQueries();
      toast({ title: "Freight posted to Inventory GL", description: `Dr ${gl.inventory} / Cr ${gl.freight_accrual} LKR ${money(glLeg.glGap)} — ${je?.journal_number || ""}.` });
    },
    onError: (err) => {
      toast({ title: "Post failed", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const updates = diagnosis?.plan?.updates || [];
      for (const u of updates) {
        await matrixSales.entities.StockLevel.update(u.id, {
          unit_cost: u.newUnitCost,
          total_value: u.newTotalValue,
        });
      }
      await matrixSales.entities.VendorInvoice.update(invoice.id, { landed_cost_applied: true });
      await logAuditTrail({
        entityType: "vendor_invoice",
        entityId: invoice.id,
        documentNumber: invoice.vendor_invoice_number,
        actionType: "freight_stock_repair",
        afterData: { landedCost: diagnosis.landedCost, positions: updates.length },
        severity: "warning",
      }).catch(() => {});
      return updates.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries();
      toast({ title: "Freight capitalised into stock", description: `${n} stock position${n === 1 ? "" : "s"} re-costed.` });
    },
    onError: (err) => {
      toast({ title: "Repair failed", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-indigo-600" /> Freight → Stock Repair
        </CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          For a booked vendor invoice whose freight hit the Inventory GL but never moved the material&apos;s per-unit
          cost. Enter the invoice number to see where it dropped out and re-apply it. Read-only until you press Apply.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label>Vendor invoice number</Label>
            <Input
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="e.g. 7931"
              onKeyDown={(e) => e.key === "Enter" && setQuery(numberInput)}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setQuery(numberInput)}>Look up</Button>
        </div>

        {query && !invoice && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> No vendor invoice found with number &ldquo;{query}&rdquo;.
          </div>
        )}

        {invoice && diagnosis && (
          <>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              Invoice <strong>{invoice.vendor_invoice_number}</strong> — freight + other charges:{" "}
              <strong>LKR {money(diagnosis.landedCost)}</strong>. Applying re-averages this into the per-unit cost of the
              linked material only; it does not post to the GL (the invoice already did).
            </div>

            {/* Per-GRN resolution — shows exactly where capitalisation lands or fails. */}
            <div className="overflow-x-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">GRN</th>
                    <th className="px-3 py-2 text-left font-medium">Material</th>
                    <th className="px-3 py-2 text-left font-medium">Stock matched?</th>
                    <th className="px-3 py-2 text-right font-medium">On hand</th>
                    <th className="px-3 py-2 text-right font-medium">Unit cost now</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {diagnosis.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-xs">{r.grn_number || "—"}{!r.grnFound && " (not found)"}</td>
                      <td className="px-3 py-2">{r.material_code || "—"}</td>
                      <td className="px-3 py-2">
                        {r.stockMatched
                          ? <span className="text-emerald-700">yes</span>
                          : <span className="text-red-600">no</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{r.stockMatched ? money(r.currentQty) : ""}</td>
                      <td className="px-3 py-2 text-right">{r.stockMatched ? money(r.currentUnitCost) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {alreadyApplied ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> This invoice&apos;s freight has already been capitalised into
                stock. Nothing to do — re-applying is blocked so it can&apos;t double-count.
              </div>
            ) : diagnosis.reason ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {REASON_TEXT[diagnosis.reason] || diagnosis.reason}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border text-sm">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Material position</th>
                        <th className="px-3 py-2 text-right font-medium">Freight added</th>
                        <th className="px-3 py-2 text-right font-medium">New unit cost</th>
                        <th className="px-3 py-2 text-right font-medium">New total value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {diagnosis.plan.updates.map((u, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-xs">{u.key}</td>
                          <td className="px-3 py-2 text-right">{money(u.freightShare)}</td>
                          <td className="px-3 py-2 text-right text-emerald-700">{money(u.newUnitCost)}</td>
                          <td className="px-3 py-2 text-right">{money(u.newTotalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Apply only if the freight is not already in the unit cost shown above. This raises the per-unit cost, so
                  future COGS on the eventual sale reflects the landed cost.
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => applyMutation.mutate()}
                    disabled={!canApply || applyMutation.isPending}
                  >
                    {applyMutation.isPending ? "Applying…" : `Capitalise LKR ${money(diagnosis.landedCost)} into stock`}
                  </Button>
                </div>
              </>
            )}

            {glLeg && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <PackageSearch className="h-4 w-4 text-indigo-600" /> Inventory GL leg
                </div>

                {glLeg.lines.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border text-xs">
                    <table className="w-full">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Posted account</th>
                          <th className="px-3 py-1.5 text-right font-medium">Debit</th>
                          <th className="px-3 py-1.5 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {glLeg.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-mono">{l.account_code}{l.account_name ? ` — ${l.account_name}` : ""}</td>
                            <td className="px-3 py-1.5 text-right">{l.debit ? money(l.debit) : ""}</td>
                            <td className="px-3 py-1.5 text-right">{l.credit ? money(l.credit) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {glLeg.glGap <= 0.01 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> Freight is already in the Inventory GL. Nothing to post here.
                  </div>
                ) : glLeg.canAutoPost ? (
                  <>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                      The Inventory GL is short of this invoice&apos;s freight by <strong>LKR {money(glLeg.glGap)}</strong>. Posting{" "}
                      <strong>Dr {gl.inventory} Inventory / Cr {gl.freight_accrual} Freight Accrual</strong> brings the GL up to match the
                      stock ledger and records the freight owed to the carrier (clear it later with the Freight Invoice tool).
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <Label>Entry date</Label>
                        <Input type="date" value={glDate} onChange={(e) => setGlDate(e.target.value)} />
                      </div>
                      <Button
                        type="button"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => postGlLegMutation.mutate()}
                        disabled={postGlLegMutation.isPending}
                      >
                        {postGlLegMutation.isPending ? "Posting…" : `Post Dr ${gl.inventory} / Cr ${gl.freight_accrual} LKR ${money(glLeg.glGap)}`}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    The Inventory GL is short by LKR {money(glLeg.glGap)}, but this invoice already credits Freight Accrual — posting again
                    could double the liability. This one needs a manual correcting entry; send me the journal and I&apos;ll pin the exact fix.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
