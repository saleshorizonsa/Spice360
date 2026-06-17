import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Leaf, Scissors, Package, Truck, FlaskConical, ChevronRight } from "lucide-react";

const fmt = (v) =>
    `LKR ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const kg = (v) => `${(parseFloat(v) || 0).toFixed(3)} kg`;

const STAGE_LABELS = {
    pre_processing:  "Pre-Processing",
    rubbing_peeling: "Rubbing & Peeling",
    cutting:         "Cutting",
    grading:         "Grading",
    moisture_qc:     "Moisture QC",
    packaging:       "Packaging",
};

const STAGE_ICONS = {
    pre_processing:  Leaf,
    rubbing_peeling: Leaf,
    cutting:         Scissors,
    grading:         FlaskConical,
    moisture_qc:     FlaskConical,
    packaging:       Package,
};

function StageRow({ icon: Icon, label, children }) {
    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="w-0.5 bg-emerald-100 flex-1 mt-1" />
            </div>
            <div className="pb-4 flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 mb-1">{label}</p>
                {children}
            </div>
        </div>
    );
}

export default function CinnamonBatchTraceDialog({ batch, onClose }) {
    const batchNumber = batch.batch_number;

    const { data: steps = [] } = useQuery({
        queryKey: ["cinnamonProcessSteps", batchNumber],
        queryFn:  () => matrixSales.entities.CinnamonProcessStep.filter({ batch_number: batchNumber }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: gradingOutputs = [] } = useQuery({
        queryKey: ["cinnamonGradingOutputs", batchNumber],
        queryFn:  () => matrixSales.entities.CinnamonGradingOutput.filter({ batch_number: batchNumber }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: packaging = [] } = useQuery({
        queryKey: ["cinnamonPackaging", batchNumber],
        queryFn:  () => matrixSales.entities.CinnamonPackaging.filter({ batch_number: batchNumber }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ["deliveries", batchNumber],
        queryFn:  () => matrixSales.entities.Delivery.filter({ batch_number: batchNumber }).catch(() => []),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    // Summary numbers
    const totalProcessCost = useMemo(() =>
        steps.reduce((sum, s) => {
            if (s.stage === "cutting") return sum + (parseFloat(s.step_total_cost) || 0);
            return sum + (parseFloat(s.labour_cost_total) || 0);
        }, 0),
        [steps]
    );
    const totalGradedKg   = gradingOutputs.reduce((s, g) => s + (parseFloat(g.output_weight_kg) || 0), 0);
    const totalPackedPacks = packaging.reduce((s, p) => s + (parseInt(p.qty_packs) || 0), 0);
    const totalSalesValue  = packaging.reduce((s, p) => s + (parseFloat(p.total_sales_value) || 0), 0);
    const totalDelivered  = deliveries.reduce((s, d) => s + (parseFloat(d.quantity_delivered) || 0), 0);

    const landedCostBase = (parseFloat(batch.landed_cost_per_kg) || 0) * (parseFloat(batch.usable_weight_kg) || 0);
    const grandTotalCost = landedCostBase + totalProcessCost;
    const netProfit      = totalSalesValue - grandTotalCost;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-emerald-600" />
                        Batch Trace — {batchNumber}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* ── Batch summary header ─────────────────────────────── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: "Grand Total Cost", value: fmt(grandTotalCost), color: "text-red-700" },
                            { label: "Total Sales",      value: fmt(totalSalesValue), color: "text-green-700" },
                            { label: "Net Profit",       value: fmt(netProfit),       color: netProfit >= 0 ? "text-emerald-700" : "text-orange-700" },
                            { label: "Delivered",        value: `${totalDelivered.toFixed(0)} packs`, color: "text-blue-700" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="bg-slate-50 rounded-lg border p-3 text-center">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className={`font-bold text-sm ${color}`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Timeline ─────────────────────────────────────────── */}
                    <div className="pt-2">

                        {/* 1 — Intake */}
                        <StageRow icon={Leaf} label="1 · Intake">
                            <div className="bg-white border rounded-lg p-3 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Supplier</span>
                                    <span className="font-medium">{batch.supplier || "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">GRN Reference</span>
                                    <span className="font-medium font-mono text-xs">{batch.grn_reference || "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Input Weight</span>
                                    <span className="font-medium">{kg(batch.input_weight_kg)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Usable (after shrinkage)</span>
                                    <span className="font-medium">{kg(batch.usable_weight_kg)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Purchase Price</span>
                                    <span className="font-medium">{fmt(batch.purchase_price_per_kg)}/kg</span>
                                </div>
                                <div className="flex justify-between border-t pt-1 mt-1">
                                    <span className="text-slate-500">Landed Cost/kg</span>
                                    <span className="font-bold text-emerald-700">{fmt(batch.landed_cost_per_kg)}/kg</span>
                                </div>
                            </div>
                        </StageRow>

                        {/* 2 — Processing Steps */}
                        {steps.length > 0 && (
                            <StageRow icon={Scissors} label={`2 · Processing Steps (${steps.length})`}>
                                <div className="space-y-2">
                                    {steps
                                        .slice()
                                        .sort((a, b) => (a.started_at || "") < (b.started_at || "") ? -1 : 1)
                                        .map((s) => {
                                            const Icon = STAGE_ICONS[s.stage] || Leaf;
                                            const cost = s.stage === "cutting"
                                                ? parseFloat(s.step_total_cost) || 0
                                                : parseFloat(s.labour_cost_total) || 0;
                                            return (
                                                <div key={s.id} className="bg-white border rounded-lg p-3 text-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium flex items-center gap-1">
                                                            <Icon className="w-3.5 h-3.5 text-emerald-600" />
                                                            {STAGE_LABELS[s.stage] || s.stage}
                                                        </span>
                                                        <span className="text-slate-400 text-xs">
                                                            {(s.completed_at || s.started_at || "").slice(0, 10)}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mt-1.5 text-xs text-slate-600">
                                                        <span>In: {kg(s.input_weight_kg)}</span>
                                                        <span>Out: {kg(s.output_weight_kg)}</span>
                                                        {cost > 0 && <span className="text-right font-medium text-amber-700">{fmt(cost)}</span>}
                                                    </div>
                                                    {s.stage === "cutting" && (parseFloat(s.off_cut_kg) > 0 || parseFloat(s.powder_kg) > 0) && (
                                                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                                                            {parseFloat(s.off_cut_kg) > 0 && <span>Off-cut: {kg(s.off_cut_kg)}</span>}
                                                            {parseFloat(s.powder_kg)  > 0 && <span>Powder: {kg(s.powder_kg)}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                                <div className="flex justify-end mt-1">
                                    <span className="text-xs text-slate-500">Total process cost: <strong className="text-amber-700">{fmt(totalProcessCost)}</strong></span>
                                </div>
                            </StageRow>
                        )}

                        {/* 3 — Grading Outputs */}
                        {gradingOutputs.length > 0 && (
                            <StageRow icon={FlaskConical} label={`3 · Grading Outputs (${totalGradedKg.toFixed(3)} kg)`}>
                                <div className="bg-white border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="p-2 text-left">Grade</th>
                                                <th className="p-2 text-right">Weight</th>
                                                <th className="p-2 text-right">Landed Cost/kg</th>
                                                <th className="p-2 text-right">Cost Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gradingOutputs.map((g) => (
                                                <tr key={g.id} className="border-b last:border-0">
                                                    <td className="p-2">
                                                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">{g.grade_code}</Badge>
                                                    </td>
                                                    <td className="p-2 text-right">{kg(g.output_weight_kg)}</td>
                                                    <td className="p-2 text-right">{fmt(g.landed_cost_per_kg)}</td>
                                                    <td className="p-2 text-right font-medium">{fmt(g.cost_value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </StageRow>
                        )}

                        {/* 4 — Packaging */}
                        {packaging.length > 0 && (
                            <StageRow icon={Package} label={`4 · Packaging (${totalPackedPacks} packs)`}>
                                <div className="bg-white border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="p-2 text-left">SKU</th>
                                                <th className="p-2 text-right">Packs</th>
                                                <th className="p-2 text-right">Weight</th>
                                                <th className="p-2 text-right">Price/Pack</th>
                                                <th className="p-2 text-right">Sales Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {packaging.map((p) => (
                                                <tr key={p.id} className="border-b last:border-0">
                                                    <td className="p-2 font-mono">{p.finished_sku || `${p.grade_code}-${p.pack_size}`}</td>
                                                    <td className="p-2 text-right">{p.qty_packs}</td>
                                                    <td className="p-2 text-right">{kg(p.total_weight_kg)}</td>
                                                    <td className="p-2 text-right">{fmt(p.sale_price_per_pack)}</td>
                                                    <td className="p-2 text-right font-medium text-green-700">{fmt(p.total_sales_value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </StageRow>
                        )}

                        {/* 5 — Deliveries */}
                        <StageRow icon={Truck} label={`5 · Deliveries (${deliveries.length})`}>
                            {deliveries.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No deliveries recorded against this batch yet.</p>
                            ) : (
                                <div className="bg-white border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="p-2 text-left">Delivery #</th>
                                                <th className="p-2 text-left">Date</th>
                                                <th className="p-2 text-left">Customer</th>
                                                <th className="p-2 text-right">Qty</th>
                                                <th className="p-2 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deliveries.map((d) => (
                                                <tr key={d.id} className="border-b last:border-0">
                                                    <td className="p-2 font-mono">{d.delivery_number}</td>
                                                    <td className="p-2">{d.delivery_date}</td>
                                                    <td className="p-2">{d.customer_name || "—"}</td>
                                                    <td className="p-2 text-right">{parseFloat(d.quantity_delivered || 0).toFixed(0)} packs</td>
                                                    <td className="p-2 text-right">
                                                        <Badge className={d.status === "delivered" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}>
                                                            {d.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </StageRow>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
