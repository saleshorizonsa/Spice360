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
import { Scale, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

// One batch → multiple graded output rows, mirroring CoilSlittingForm.
export default function CinnamonGradingForm({ onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: batches = [] } = useQuery({
        queryKey: ["cinnamonBatches"],
        queryFn: () => matrixSales.entities.CinnamonBatch.filter({ status: "active" }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: grades = [] } = useQuery({
        queryKey: ["cinnamonGrades"],
        queryFn: () => matrixSales.entities.CinnamonGrade.list(),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: processSteps = [] } = useQuery({
        queryKey: ["cinnamonProcessSteps"],
        queryFn: () => matrixSales.entities.CinnamonProcessStep.list(),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const [selectedBatch, setSelectedBatch]         = useState(null);
    const [availableWeight, setAvailableWeight]     = useState(0);
    const [batchLandedCost, setBatchLandedCost]     = useState(0);
    const [wasteWeight, setWasteWeight]             = useState("");
    const [gradeRows, setGradeRows]                 = useState([{ grade_code: "", output_weight_kg: "" }]);
    const [gradingNumber]                           = useState(`CIN-GRD-${Date.now()}`);
    const [isDirty, setIsDirty]                     = useState(false);
    const { guardedOpenChange, guardedClose }       = useUnsavedChangesWarning(isDirty);

    const safeBatches      = Array.isArray(batches)      ? batches      : [];
    const safeGrades       = Array.isArray(grades)       ? grades       : [];
    const safeProcessSteps = Array.isArray(processSteps) ? processSteps : [];

    const handleBatchSelect = (batchNumber) => {
        setIsDirty(true);
        const batch = safeBatches.find((b) => b.batch_number === batchNumber);
        setSelectedBatch(batch || null);
        setBatchLandedCost(parseFloat(batch?.landed_cost_per_kg) || 0);

        // Available weight = last completed step output, or raw intake weight
        const batchSteps = safeProcessSteps
            .filter((s) => s.batch_number === batchNumber && s.stage !== "moisture_qc")
            .sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));

        const lastStep = batchSteps[0];
        setAvailableWeight(
            lastStep
                ? parseFloat(lastStep.output_weight_kg) || 0
                : parseFloat(batch?.usable_weight_kg) || parseFloat(batch?.input_weight_kg) || 0
        );
    };

    const totalGradeWeight = gradeRows.reduce((sum, r) => sum + (parseFloat(r.output_weight_kg) || 0), 0);
    const wasteKg          = parseFloat(wasteWeight) || 0;
    const totalUsed        = totalGradeWeight + wasteKg;
    const remaining        = availableWeight - totalUsed;
    const isOverweight     = totalUsed > availableWeight && availableWeight > 0;
    const totalCostValue   = totalGradeWeight * batchLandedCost;

    const addGradeRow    = () => { setIsDirty(true); setGradeRows((prev) => [...prev, { grade_code: "", output_weight_kg: "" }]); };
    const removeGradeRow = (index) => { setIsDirty(true); setGradeRows((prev) => prev.filter((_, i) => i !== index)); };
    const updateGradeRow = (index, field, value) => {
        setIsDirty(true);
        setGradeRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const gradingMutation = useMutation({
        mutationFn: async () => {
            if (!selectedBatch) throw new Error("No batch selected");
            if (isOverweight)   throw new Error("Total weight exceeds available batch weight");
            if (gradeRows.some((r) => !r.grade_code || !r.output_weight_kg)) {
                throw new Error("Every grade row needs a grade and a weight");
            }

            // Record a CinnamonProcessStep for grading
            await matrixSales.entities.CinnamonProcessStep.create({
                batch_number:       selectedBatch.batch_number,
                stage:              "grading",
                input_weight_kg:    availableWeight,
                output_weight_kg:   totalGradeWeight,
                waste_weight_kg:    wasteKg,
                yield_pct:          availableWeight > 0 ? (totalGradeWeight / availableWeight) * 100 : 0,
                started_at:         new Date().toISOString(),
                completed_at:       new Date().toISOString(),
                notes:              `Grading run: ${gradingNumber}`,
            });

            // Create one CinnamonGradingOutput per grade, carrying landed cost
            for (const row of gradeRows) {
                const outKg      = parseFloat(row.output_weight_kg) || 0;
                const costValue  = outKg * batchLandedCost;
                await matrixSales.entities.CinnamonGradingOutput.create({
                    batch_number:       selectedBatch.batch_number,
                    grading_number:     gradingNumber,
                    grade_code:         row.grade_code,
                    output_weight_kg:   outKg,
                    landed_cost_per_kg: batchLandedCost,
                    cost_value:         costValue,
                });
            }

            // Advance batch stage
            await matrixSales.entities.CinnamonBatch.update(selectedBatch.id, { current_stage: "grading" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cinnamonBatches"] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonProcessSteps"] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonGradingOutputs"] });
            toast({ title: "Success", description: "Grading recorded" });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scale className="w-5 h-5 text-emerald-600" />
                        Record Grading
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Grading Number</Label>
                            <Input value={gradingNumber} disabled />
                        </div>
                        <div>
                            <Label>Batch *</Label>
                            <Select onValueChange={handleBatchSelect} required>
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

                    {selectedBatch && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                    <Label className="text-xs text-blue-900">Supplier</Label>
                                    <p className="font-medium">{selectedBatch.supplier}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-blue-900">Available Weight</Label>
                                    <p className="font-medium">{availableWeight.toFixed(3)} kg</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-blue-900">Current Stage</Label>
                                    <p className="font-medium capitalize">{selectedBatch.current_stage?.replace(/_/g, " ")}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-blue-900">Landed Cost / kg</Label>
                                    <p className="font-bold text-amber-700">
                                        {batchLandedCost > 0 ? `LKR ${batchLandedCost.toFixed(4)}` : "—"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Grade output rows */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-base font-semibold">Grade Outputs</Label>
                            <Button
                                type="button" variant="outline" size="sm"
                                onClick={addGradeRow} disabled={!selectedBatch}
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add Grade
                            </Button>
                        </div>

                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_120px_110px_auto] gap-3 mb-1 px-1 text-xs font-medium text-gray-500">
                            <span>Grade</span>
                            <span>Weight (kg)</span>
                            <span>Cost Value (LKR)</span>
                            <span />
                        </div>

                        <div className="space-y-3">
                            {gradeRows.map((row, index) => (
                                <div key={index} className="grid grid-cols-[1fr_120px_110px_auto] gap-3 items-end">
                                    <div>
                                        <Select
                                            value={row.grade_code}
                                            onValueChange={(v) => updateGradeRow(index, "grade_code", v)}
                                            disabled={!selectedBatch}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                                            <SelectContent>
                                                {safeGrades.map((g) => (
                                                    <SelectItem key={g.id} value={g.grade_code}>
                                                        {g.grade_name} ({g.category})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Input
                                            type="number" step="0.001" min="0"
                                            value={row.output_weight_kg}
                                            onChange={(e) => updateGradeRow(index, "output_weight_kg", e.target.value)}
                                            disabled={!selectedBatch}
                                        />
                                    </div>
                                    <div className="h-9 px-3 flex items-center bg-amber-50 border border-amber-200 rounded-md text-sm font-semibold text-amber-800">
                                        {((parseFloat(row.output_weight_kg) || 0) * batchLandedCost).toFixed(2)}
                                    </div>
                                    <Button
                                        type="button" variant="ghost" size="icon"
                                        onClick={() => removeGradeRow(index)}
                                        disabled={gradeRows.length === 1}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {batchLandedCost > 0 && totalGradeWeight > 0 && (
                            <div className="flex justify-end mt-2 text-sm font-semibold text-amber-800">
                                Total Grade Cost: LKR {totalCostValue.toFixed(2)}
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>Waste / Loss (kg)</Label>
                        <Input
                            type="number" step="0.001" min="0"
                            value={wasteWeight}
                            onChange={(e) => { setIsDirty(true); setWasteWeight(e.target.value); }}
                            disabled={!selectedBatch}
                            className="max-w-xs"
                        />
                    </div>

                    {selectedBatch && (
                        <Alert className={isOverweight ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                                <div className="text-sm space-y-1">
                                    <p>Grade Outputs: <strong>{totalGradeWeight.toFixed(3)} kg</strong></p>
                                    <p>Waste: <strong>{wasteKg.toFixed(3)} kg</strong></p>
                                    <p>
                                        Total Used: <strong>{totalUsed.toFixed(3)} kg</strong>{" "}
                                        / {availableWeight.toFixed(3)} kg available
                                    </p>
                                    <p className={`font-bold ${remaining < 0 ? "text-red-700" : "text-green-700"}`}>
                                        Remaining: {remaining.toFixed(3)} kg
                                    </p>
                                    {isOverweight && (
                                        <p className="text-red-700 font-semibold">
                                            Total exceeds available weight — reduce outputs or waste
                                        </p>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={guardedClose(onClose)}>Cancel</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={!selectedBatch || isOverweight || gradingMutation.isPending}
                            onClick={() => gradingMutation.mutate()}
                        >
                            <Scale className="w-4 h-4 mr-2" />
                            Save Grading
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
