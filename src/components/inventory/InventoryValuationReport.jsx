import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Download, ShieldAlert, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildInventoryValuation, COSTING_METHODS } from "@/lib/inventoryCosting";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InventoryValuationReport() {
  const [method, setMethod] = useState("weighted_average");

  const { data: stockLevels = [] } = useQuery({
    queryKey: ["stockLevels"],
    queryFn: () => matrixSales.entities.StockLevel.list(),
    initialData: [],
  });

  // Every movement, not just goods_receipt. The old report read receipts only, so
  // stock created by production or an inbound transfer had no history and was
  // silently valued at zero, and receipt reversals were never subtracted.
  const { data: movements = [] } = useQuery({
    queryKey: ["stockMovements"],
    queryFn: () => matrixSales.entities.StockMovement.list(),
    initialData: [],
  });

  const { rows, unreconciled, totals } = useMemo(
    () => buildInventoryValuation({ stockLevels, movements, method }),
    [stockLevels, movements, method]
  );

  const meta = COSTING_METHODS[method];

  const handleExport = () => {
    const csv = [
      ["Material Code", "Material Name", "Quantity", "UOM", "Unit Cost", "Total Value", "Method"],
      ...rows.map((r) => [
        r.material_code,
        r.material_name,
        r.quantity,
        r.unit_of_measure,
        r.unitCost.toFixed(2),
        r.totalValue.toFixed(2),
        meta.label,
      ]),
    ]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_valuation_${method}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" />
            Inventory Valuation Report
          </CardTitle>
          <div className="flex gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COSTING_METHODS).map(([key, m]) => (
                  <SelectItem key={key} value={key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-gray-600">Total Inventory Value</div>
              <div className="text-3xl font-bold text-indigo-700">LKR {money(totals.value)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Method</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-indigo-600">{meta.label}</span>
                {meta.authoritative ? (
                  <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">Book value</Badge>
                ) : (
                  <Badge className="border border-amber-300 bg-amber-100 text-amber-800">Indicative</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* What this method means, and whether you may report on it. */}
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            meta.authoritative
              ? "border-blue-200 bg-blue-50 text-blue-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {meta.authoritative ? (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{meta.note}</span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-gray-500">
                    No stock on hand.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((item) => (
                <TableRow key={item.material_code}>
                  <TableCell className="font-mono text-sm">{item.material_code}</TableCell>
                  <TableCell>
                    {item.material_name}
                    {item.hasUnreconciled && (
                      <Badge variant="outline" className="ml-2 border-red-300 text-xs text-red-700">
                        unverified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                  <TableCell>{item.unit_of_measure}</TableCell>
                  <TableCell className="text-right">{money(item.unitCost)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(item.totalValue)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-gray-100 font-bold">
                <TableCell colSpan={5}>TOTAL</TableCell>
                <TableCell className="text-right">LKR {money(totals.value)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Positions whose movement history does not add up to the quantity on
            hand. Their cost cannot be derived, so they contribute quantity but no
            value — rather than being quietly valued at zero or at a guess. */}
        {unreconciled.length > 0 && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <ShieldAlert className="h-4 w-4" />
              {unreconciled.length} position(s) could not be valued from movement history
            </div>
            <p className="text-xs text-red-700">
              The movements do not add up to the quantity on hand, so no cost can be derived. The quantity is
              included above but contributes <strong>no value</strong> to the total — it is not silently valued at
              zero or guessed. Correct these with a cycle count.
            </p>
            <ul className="ml-5 list-disc text-xs text-red-700">
              {unreconciled.slice(0, 8).map((u) => (
                <li key={u.key}>
                  <strong>{u.material_code}</strong> @ {u.warehouse_code} — {u.reason}
                </li>
              ))}
              {unreconciled.length > 8 && <li>…and {unreconciled.length - 8} more</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
