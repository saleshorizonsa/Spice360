import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, Scale, AlertTriangle, Copy } from "lucide-react";
import { reconcileInventoryToGl } from "@/lib/inventoryGlReconciliation";
import { useGLAccounts } from "@/hooks/useGLAccounts";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Shows the inventory subledger (sum of StockLevel.total_value) against the
 * Inventory GL account, attributes the GL balance by source, and flags opening
 * balances. Read-only — helps explain why the two do not tie.
 */
export default function InventoryGlReconciliation() {
  const gl = useGLAccounts();
  const { toast } = useToast();

  const { data: stockLevels = [], isLoading: l1 } = useQuery({
    queryKey: ["stockLevels"],
    queryFn: () => matrixSales.entities.StockLevel.list(),
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
  const { data: movements = [], isLoading: l4 } = useQuery({
    queryKey: ["stockMovements"],
    queryFn: () => matrixSales.entities.StockMovement.list(),
    initialData: [],
  });

  const r = useMemo(
    () => reconcileInventoryToGl({ stockLevels, journalEntries, journalLines, movements, gl }),
    [stockLevels, journalEntries, journalLines, movements, gl]
  );

  const copyFigures = () => {
    const lines = [
      "Inventory ↔ GL Reconciliation",
      `Stock book value : LKR ${money(r.stockBookValue)}`,
      `Inventory GL (${gl.inventory}): LKR ${money(r.glBalance)}`,
      `Difference       : LKR ${money(r.difference)} (${r.difference > 0 ? "stock higher" : r.difference < 0 ? "GL higher" : "tied"})`,
      r.openingCount ? `Opening-balance stock (no movements): LKR ${money(r.openingBalanceValue)} across ${r.openingCount} position(s)` : "",
      "",
      "Inventory GL by source:",
      ...r.bySource.map((s) => `  ${s.label}: ${s.net >= 0 ? "+" : ""}${money(s.net)}`),
    ].filter(Boolean).join("\n");

    navigator.clipboard?.writeText(lines).then(
      () => toast({ title: "Copied", description: "Paste the figures into the chat." }),
      () => toast({ title: "Copy failed", description: "Select and copy the numbers manually.", variant: "destructive" })
    );
  };

  if (l1 || l2 || l3 || l4) {
    return <div className="py-6 text-center text-sm text-gray-500">Reconciling inventory…</div>;
  }

  if (!r.ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" /> Inventory ↔ GL Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700">{r.reason}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-600" />
          Inventory ↔ GL Reconciliation
          {r.reconciled ? (
            <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">Tied</Badge>
          ) : (
            <Badge className="border border-red-300 bg-red-100 text-red-800">Out by {money(Math.abs(r.difference))}</Badge>
          )}
        </CardTitle>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Stock records vs the Inventory GL account. Read-only.</p>
          <Button type="button" variant="outline" size="sm" onClick={copyFigures} className="shrink-0">
            <Copy className="mr-2 h-4 w-4" /> Copy figures
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">Stock book value</p>
            <p className="text-lg font-bold">LKR {money(r.stockBookValue)}</p>
            <p className="text-xs text-gray-400">sum of stock records</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs text-gray-500">Inventory GL balance</p>
            <p className="text-lg font-bold">LKR {money(r.glBalance)}</p>
            <p className="text-xs text-gray-400">account {gl.inventory}</p>
          </div>
          <div className={`rounded-lg border p-3 ${r.reconciled ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className="text-xs text-gray-500">Difference</p>
            <p className={`text-lg font-bold ${r.reconciled ? "text-emerald-700" : "text-red-700"}`}>
              {r.difference >= 0 ? "+" : ""}LKR {money(r.difference)}
            </p>
            <p className="text-xs text-gray-400">{r.difference > 0 ? "stock higher" : r.difference < 0 ? "GL higher" : "tied"}</p>
          </div>
        </div>

        {r.reconciled && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            The inventory subledger ties to the Inventory GL account.
          </div>
        )}

        {!r.reconciled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Likely reasons the two differ
            </div>
            <ul className="ml-5 list-disc space-y-0.5">
              {r.openingBalanceValue !== 0 && (
                <li>
                  <strong>LKR {money(r.openingBalanceValue)}</strong> of stock across {r.openingCount} position(s) has
                  no movement history — opening balances loaded straight into stock, with no GL entry behind them
                  (pushes stock above GL).
                </li>
              )}
              <li>
                Inbound freight on vendor invoices posted <em>before</em> per-unit freight capitalisation went in — it
                hit the Inventory GL but not the stock cost (pushes GL above stock).
              </li>
              <li>
                Cycle-count adjustments and stock transfers update stock but post no GL entry.
              </li>
              <li>GRNs posted before the GL mapping was set updated stock but skipped their GL entry.</li>
            </ul>
          </div>
        )}

        {/* Attribution: what makes up the Inventory GL balance */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">What is in the Inventory GL account</h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Net to Inventory</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.bySource.length === 0 && (
                  <tr><td colSpan={2} className="px-3 py-3 text-center text-gray-500">No postings to this account.</td></tr>
                )}
                {r.bySource.map((s) => (
                  <tr key={s.reference_type}>
                    <td className="px-3 py-2">{s.label}</td>
                    <td className={`px-3 py-2 text-right font-medium ${s.net >= 0 ? "text-gray-800" : "text-red-700"}`}>
                      {s.net >= 0 ? "+" : ""}{money(s.net)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-3 py-2">Inventory GL balance</td>
                  <td className="px-3 py-2 text-right">LKR {money(r.glBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Share these figures and I can tell you exactly which driver accounts for your gap and how to correct it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
