import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Package, AlertTriangle } from "lucide-react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

const PACK_SIZES = [
    { label: "50g",  value: "50g",  kg: 0.05 },
    { label: "100g", value: "100g", kg: 0.1  },
    { label: "200g", value: "200g", kg: 0.2  },
    { label: "500g", value: "500g", kg: 0.5  },
    { label: "1kg",  value: "1kg",  kg: 1.0  },
];

const MOISTURE_THRESHOLD = 12;

const parseMoistureFromNotes = (notes) => {
    const match = String(notes || "").match(/Moisture QC:\s*([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
};

export default function CinnamonPackagingForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const isEdit = Boolean(item?.id);
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);

    const { data: batches = [] } = useQuery({
        queryKey: ["cinnamonBatches"],
        queryFn: () => matrixSales.entities.CinnamonBatch.filter({ status: "active" }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: gradingOutputs = [] } = useQuery({
        queryKey: ["cinnamonGradingOutputs"],
        queryFn: () => matrixSales.entities.CinnamonGradingOutput.list(),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: processSteps = [] } = useQuery({
        queryKey: ["cinnamonProcessSteps"],
        queryFn: () => matrixSales.entities.CinnamonProcessStep.list(),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: allPackaging = [] } = useQuery({
        queryKey: ["cinnamonPackaging"],
        queryFn: () => matrixSales.entities.CinnamonPackaging.list(),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const [formData, setFormData] = useState({
        packaging_number:    item?.packaging_number    || `CIN-PKG-${Date.now()}`,
        batch_number:        item?.batch_number        || "",
        grade_code:          item?.grade_code          || "",
        pack_size:           item?.pack_size           || "",
        qty_packs:           item?.qty_packs           || "",
        sale_price_per_pack: item?.sale_price_per_pack || "",
        location:            item?.location            || "",
    });

    const handleChange = (field, value) => {
        setIsDirty(true);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const safeBatches        = Array.isArray(batches)        ? batches        : [];
    const safeGradingOutputs = Array.isArray(gradingOutputs) ? gradingOutputs : [];
    const safeProcessSteps   = Array.isArray(processSteps)   ? processSteps   : [];
    const safeAllPackaging   = Array.isArray(allPackaging)   ? allPackaging   : [];

    const selectedBatch = safeBatches.find((b) => b.batch_number === formData.batch_number);
    const batchGrades   = safeGradingOutputs.filter((g) => g.batch_number === formData.batch_number);

    // Moisture QC gate
    const latestMoistureStep = safeProcessSteps
        .filter((s) => s.batch_number === formData.batch_number && s.stage === "moisture_qc")
        .sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at))[0];

    const latestMoisture = latestMoistureStep
        ? parseMoistureFromNotes(latestMoistureStep.notes) ?? parseFloat(selectedBatch?.moisture_in_pct) ?? 0
        : parseFloat(selectedBatch?.moisture_in_pct) || 0;
    const moistureBlocked = selectedBatch && latestMoisture > MOISTURE_THRESHOLD;

    // Pack calculations
    const selectedPackSize = PACK_SIZES.find((p) => p.value === formData.pack_size);
    const qtyPacks         = parseInt(formData.qty_packs) || 0;
    const totalWeightKg    = selectedPackSize ? qtyPacks * selectedPackSize.kg : 0;
    const salePricePerPack = parseFloat(formData.sale_price_per_pack) || 0;
    const totalSalesValue  = qtyPacks * salePricePerPack;
    const finishedSku      = formData.grade_code && formData.pack_size
        ? `${formData.grade_code}-${formData.pack_size}` : "";

    // ── Batch P&L summary ────────────────────────────────────────────────────
    const batchSteps = safeProcessSteps.filter((s) => s.batch_number === formData.batch_number);

    const totalLabourCost = batchSteps.reduce(
        (sum, s) => sum + (parseFloat(s.labour_cost_total) || 0), 0
    );
    const totalCuttingCost = batchSteps
        .filter((s) => s.stage === "cutting")
        .reduce((sum, s) => sum + (parseFloat(s.step_total_cost) || 0), 0);

    const landedCostBase = (parseFloat(selectedBatch?.landed_cost_per_kg) || 0)
        * (parseFloat(selectedBatch?.usable_weight_kg) || 0);
    const grandTotalCost = landedCostBase + totalLabourCost + totalCuttingCost;

    const batchPacks = safeAllPackaging.filter(
        (p) => p.batch_number === formData.batch_number && p.id !== item?.id
    );
    const existingSales      = batchPacks.reduce((sum, p) => sum + (parseFloat(p.total_sales_value) || 0), 0);
    const projectedTotalSales = existingSales + totalSalesValue;
    const netProfit          = projectedTotalSales - grandTotalCost;
    const showSummary        = selectedBatch && grandTotalCost > 0;

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (moistureBlocked) {
                throw new Error(
                    `Moisture is ${latestMoisture}% — above threshold of ${MOISTURE_THRESHOLD}%. ` +
                    "Complete moisture remediation before packaging."
                );
            }

            const packData = {
                ...formData,
                qty_packs:           qtyPacks,
                total_weight_kg:     totalWeightKg,
                finished_sku:        finishedSku,
                sale_price_per_pack: salePricePerPack,
                total_sales_value:   totalSalesValue,
            };

            const packRecord = await (isEdit
                ? matrixSales.entities.CinnamonPackaging.update(item.id, packData)
                : matrixSales.entities.CinnamonPackaging.create({ ...packData, status: "completed" }));

            if (!isEdit) {
                // Post finished goods stock movement
                await matrixSales.entities.StockMovement.create({
                    movement_type:    "production_output",
                    reference_number: formData.packaging_number,
                    reference_type:   "cinnamon_packaging",
                    material_code:    finishedSku,
                    material_name:    `Cinnamon ${formData.grade_code} – ${formData.pack_size}`,
                    quantity:         qtyPacks,
                    unit:             "packs",
                    weight_kg:        totalWeightKg,
                    location_code:    formData.location,
                    movement_date:    new Date().toISOString().split("T")[0],
                    posting_date:     new Date().toISOString().split("T")[0],
                    notes:            `Packaged from cinnamon batch ${formData.batch_number}`,
                    batch_number:     formData.batch_number,
                    status:           "posted",
                });

                // Register finished SKU as sellable Material if not already present
                try {
                    const existing = await matrixSales.entities.Material.filter({ material_code: finishedSku });
                    if (existing.length === 0) {
                        await matrixSales.entities.Material.create({
                            material_code:              finishedSku,
                            material_name:              `Cinnamon ${formData.grade_code} – ${formData.pack_size}`,
                            material_type:              "finished_product",
                            unit_of_measure:            "packs",
                            unit_price:                 salePricePerPack,
                            status:                     "active",
                            inventory_tracking_enabled: true,
                        });
                    }
                } catch (_) {
                    // Non-fatal
                }

                if (selectedBatch) {
                    await matrixSales.entities.CinnamonBatch.update(selectedBatch.id, {
                        current_stage: "packaging",
                    });
                }
            }

            return packRecord;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cinnamonPackaging"] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonBatches"] });
            queryClient.invalidateQueries({ queryKey: ["stockMovements"] });
            queryClient.invalidateQueries({ queryKey: ["materials"] });
            toast({
                title: "Success",
                description: isEdit ? "Packaging updated" : "Packaging recorded and stock posted",
            });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" />
                        {isEdit ? "Edit Packaging" : "Record Packaging"}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Packaging Number</Label>
                            <Input value={formData.packaging_number} disabled />
                        </div>
                        <div>
                            <Label>Batch *</Label>
                            <Select
                                value={formData.batch_number}
                                onValueChange={(v) => {
                                    handleChange("batch_number", v);
                                    handleChange("grade_code", "");
                                }}
                                required
                            >
                                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                                <SelectContent>
                                    {safeBatches.map((b) => (
                                        <SelectItem key={b.id} value={b.batch_number}>
                                            {b.batch_number} — {b.supplier}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Moisture QC gate */}
                    {selectedBatch && (
                        <Alert className={moistureBlocked ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                            {moistureBlocked
                                ? <AlertTriangle className="w-4 h-4 text-red-600" />
                                : <Package className="w-4 h-4 text-green-600" />}
                            <AlertDescription>
                                {moistureBlocked ? (
                                    <span className="text-red-700 font-semibold">
                                        Moisture is {latestMoisture}% — above threshold ({MOISTURE_THRESHOLD}%).
                                        Packaging is blocked.
                                    </span>
                                ) : (
                                    <span className="text-green-700">
                                        Moisture: {latestMoisture}% — within threshold. Packaging allowed.
                                    </span>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Grade *</Label>
                            <Select
                                value={formData.grade_code}
                                onValueChange={(v) => handleChange("grade_code", v)}
                                required disabled={!formData.batch_number}
                            >
                                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                                <SelectContent>
                                    {batchGrades.map((g) => (
                                        <SelectItem key={g.id} value={g.grade_code}>
                                            {g.grade_code} ({parseFloat(g.output_weight_kg || 0).toFixed(3)} kg graded)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Pack Size *</Label>
                            <Select
                                value={formData.pack_size}
                                onValueChange={(v) => handleChange("pack_size", v)}
                                required
                            >
                                <SelectTrigger><SelectValue placeholder="Select pack size" /></SelectTrigger>
                                <SelectContent>
                                    {PACK_SIZES.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Quantity (packs) *</Label>
                            <Input type="number" min="1" step="1"
                                value={formData.qty_packs}
                                onChange={(e) => handleChange("qty_packs", e.target.value)} required />
                        </div>
                        <div>
                            <Label>Sale Price / Pack (LKR)</Label>
                            <Input type="number" min="0" step="0.01"
                                value={formData.sale_price_per_pack}
                                onChange={(e) => handleChange("sale_price_per_pack", e.target.value)}
                                placeholder="0.00" />
                        </div>
                        <div>
                            <Label>Storage Location</Label>
                            <Input value={formData.location}
                                onChange={(e) => handleChange("location", e.target.value)}
                                placeholder="e.g., WH-A-03" />
                        </div>
                    </div>

                    {finishedSku && qtyPacks > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg border text-sm space-y-1">
                            <p>Finished SKU: <strong>{finishedSku}</strong></p>
                            <p>Total Weight: <strong>{totalWeightKg.toFixed(3)} kg</strong></p>
                            {salePricePerPack > 0 && (
                                <p>Total Sales Value: <strong className="text-green-700">LKR {totalSalesValue.toFixed(2)}</strong></p>
                            )}
                        </div>
                    )}

                    {/* Batch Cost vs Sales Summary */}
                    {showSummary && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                            <h3 className="font-semibold text-sm text-slate-800">Batch Cost vs Sales Summary</h3>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-slate-500">Material + Freight</p>
                                    <p className="font-bold">LKR {landedCostBase.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Processing Labour</p>
                                    <p className="font-bold">LKR {totalLabourCost.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Cutting Costs</p>
                                    <p className="font-bold">LKR {totalCuttingCost.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-3">
                                <div className="bg-red-50 rounded p-2">
                                    <p className="text-xs text-red-600">Total Batch Cost</p>
                                    <p className="text-lg font-bold text-red-800">LKR {grandTotalCost.toFixed(2)}</p>
                                </div>
                                <div className="bg-green-50 rounded p-2">
                                    <p className="text-xs text-green-600">Total Sales (projected)</p>
                                    <p className="text-lg font-bold text-green-800">LKR {projectedTotalSales.toFixed(2)}</p>
                                </div>
                                <div className={`${netProfit >= 0 ? "bg-emerald-50" : "bg-orange-50"} rounded p-2`}>
                                    <p className={`text-xs ${netProfit >= 0 ? "text-emerald-600" : "text-orange-600"}`}>Net Profit</p>
                                    <p className={`text-lg font-bold ${netProfit >= 0 ? "text-emerald-800" : "text-orange-800"}`}>
                                        {netProfit >= 0 ? "+" : ""}LKR {netProfit.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">Cost = landed material + labour + cutting costs. Per-grade allocation is a separate task.</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={
                                !formData.batch_number || !formData.grade_code ||
                                !formData.pack_size || !qtyPacks ||
                                moistureBlocked || saveMutation.isPending
                            }
                            onClick={() => saveMutation.mutate()}
                        >
                            <Package className="w-4 h-4 mr-2" />
                            {isEdit ? "Update" : "Post to Stock"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
