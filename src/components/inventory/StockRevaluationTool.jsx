import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Calculator, CheckCircle2, ShieldAlert } from "lucide-react";
import { buildRevaluationPlan } from "@/lib/stockRevaluation";
import { logAuditTrail } from "../utils/auditTrail";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Recompute inventory valuation from stock movement history.
 *
 * Repairs data left behind by the stale-cost defect: `unit_cost` was never
 * recalculated on receipt, so any position received at more than one price
 * carries the wrong cost and total_value. Fixing the code stopped it getting
 * worse; this repairs what is already stored.
 *
 * Dry run by default — nothing is written until "Apply" is pressed, and positions
 * whose movement history does not reconcile are never touched.
 */
export default function StockRevaluationTool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(null);

  const { data: stockLevels = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stockLevels"],
    queryFn: () => matrixSales.entities.StockLevel.list(),
    initialData: [],
  });

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["stockMovements"],
    queryFn: () => matrixSales.entities.StockMovement.list(),
    initialData: [],
  });

  const plan = useMemo(
    () => buildRevaluationPlan({ stockLevels, movements }),
    [stockLevels, movements]
  );

  const isLoading = loadingStock || loadingMovements;

  const handleApply = async () => {
    if (!plan.changes.length) return;
    setIsApplying(true);
    let ok = 0;
    const failures = [];

    for (const row of plan.changes) {
      try {
        await matrixSales.entities.StockLevel.update(row.id, {
          unit_cost: row.newCost,
          total_value: row.newValue,
        });
        await logAuditTrail({
          entityType: "stock_level",
          entityId: row.id,
          documentNumber: `${row.material_code} @ ${row.warehouse_code}`,
          actionType: "revalue",
          beforeData: { unit_cost: row.storedCost, total_value: row.storedValue },
          afterData: { unit_cost: row.newCost, total_value: row.newValue },
          severity: "warning",
        }).catch(() => {});
        ok += 1;
      } catch (error) {
        failures.push(`${row.material_code} @ ${row.warehouse_code}: ${error?.message || "failed"}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
    setApplied({ ok, failures });
    setIsApplying(false);

    toast({
      title: failures.length ? "Revaluation partly applied" : "Revaluation applied",
      description: failures.length
        ? `${ok} position(s) updated, ${failures.length} failed.`
        : `${ok} position(s) revalued.`,
      variant: failures.length ? "destructive" : "default",
    });
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-500">Reading stock and movement history…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold">Recompute inventory valuation from movement history</p>
          <p className="mt-1">
            Stock cost was previously not recalculated when goods were received at a new price, so any item
            bought at more than one price carries a stale unit cost and a wrong stock value. This replays the
            stock movements and recomputes the weighted average cost.
          </p>
          <p className="mt-1">
            Nothing is written until you press <strong>Apply</strong>. Positions whose movement history does not
            reconcile are never touched.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">Positions checked</p>
          <p className="text-xl font-bold">{plan.totals.positions}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">To revalue</p>
          <p className="text-xl font-bold text-amber-800">{plan.totals.changeCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">Already correct</p>
          <p className="text-xl font-bold text-emerald-800">{plan.totals.unchangedCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">Cannot verify</p>
          <p className="text-xl font-bold text-red-800">{plan.totals.unreliableCount}</p>
        </div>
      </div>

      {plan.changes.length === 0 && plan.unreliable.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Every stock position is already valued correctly. Nothing to do.
        </div>
      )}

      {/* Proposed changes */}
      {plan.changes.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">
              Proposed revaluation
              <span className="ml-2 text-sm font-normal text-gray-500">
                net change{" "}
                <strong className={plan.totals.valueDelta >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {plan.totals.valueDelta >= 0 ? "+" : ""}LKR {money(plan.totals.valueDelta)}
                </strong>
              </span>
            </h3>
            <Button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isApplying ? "Applying…" : `Apply to ${plan.changes.length} position(s)`}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Material</th>
                  <th className="px-3 py-2 text-left font-medium">Warehouse</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Cost now</th>
                  <th className="px-3 py-2 text-right font-medium">Cost should be</th>
                  <th className="px-3 py-2 text-right font-medium">Value now</th>
                  <th className="px-3 py-2 text-right font-medium">Value should be</th>
                  <th className="px-3 py-2 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plan.changes.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{row.material_code}</span>
                      <div className="text-xs text-gray-500">{row.material_name}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {row.warehouse_code}
                      {row.batch_number ? <div className="text-xs text-gray-400">Lot {row.batch_number}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right">{row.storedQty}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{money(row.storedCost)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{money(row.newCost)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{money(row.storedValue)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(row.newValue)}</td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        row.valueDelta >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {row.valueDelta >= 0 ? "+" : ""}
                      {money(row.valueDelta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This changes what your inventory is worth, so it will move the Inventory balance on your Balance
              Sheet. It writes to StockLevel only — it does <strong>not</strong> post a journal entry. If you need
              the GL to agree, post an inventory adjustment for the net difference above.
            </span>
          </div>
        </div>
      )}

      {/* Cannot verify */}
      {plan.unreliable.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold text-red-800">
            <ShieldAlert className="h-4 w-4" />
            Cannot verify — left untouched
            <Badge variant="outline" className="border-red-300 text-red-700">
              {plan.unreliable.length}
            </Badge>
          </h3>
          <p className="text-sm text-gray-600">
            The movement history for these does not add up to the quantity on hand, so the recomputed cost cannot
            be trusted either. They are reported rather than changed — correct them with a cycle count.
          </p>
          <div className="overflow-x-auto rounded-lg border border-red-200">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-red-800">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Material</th>
                  <th className="px-3 py-2 text-left font-medium">Warehouse</th>
                  <th className="px-3 py-2 text-right font-medium">Qty on hand</th>
                  <th className="px-3 py-2 text-right font-medium">Qty from history</th>
                  <th className="px-3 py-2 text-left font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plan.unreliable.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-xs">{row.material_code}</td>
                    <td className="px-3 py-2 text-gray-600">{row.warehouse_code}</td>
                    <td className="px-3 py-2 text-right">{row.storedQty}</td>
                    <td className="px-3 py-2 text-right">{row.replayedQty}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {applied && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Applied to {applied.ok} position(s).
          {applied.failures.length > 0 && (
            <ul className="ml-5 mt-1 list-disc text-red-700">
              {applied.failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
