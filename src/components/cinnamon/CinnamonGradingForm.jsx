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

// Analog of CoilSlittingForm: one batch → multiple graded output rows.
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

    const [selectedBatch, setSelectedBatch] = useState(null);
    const [availableWeight, setAvailableWeight] = useState(0);
    const [wasteWeight, setWasteWeight] = useState("");
    const [gradeRows, setGradeRows] = useState([{ grade_code: "", output_weight_kg: "" }]);
    const [gradingNumber] = useState(`CIN-GRD-${Date.now()}`);

    const safeBatches      = Array.isArray(batches)      ? batches      : [];
    const safeGrades       = Array.isArray(grades)       ? grades       : [];
    const safeProcessSteps = Array.isArray(processSteps) ? processSteps : [];

    const handleBatchSelect = (batchNumber) => {
        const batch = safeBatches.find((b) => b.batch_number === batchNumber);
        setSelectedBatch(batch || null);

        // Available weight = last completed process step's output, or raw intake weight
        const batchSteps = safeProcessSteps
            .filter((s) => s.batch_number === batchNumber && s.stage !== "moisture_qc")
            .sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));

        const lastStep = batchSteps[0];
        setAvailableWeight(
            lastStep
                ? parseFloat(lastStep.output_weight_kg) || 0
                : parseFloat(batch?.input_weight_kg) || 0
        );
    };

    const totalGradeWeight = gradeRows.reduce(
        (sum, r) => sum + (parseFloat(r.output_weight_kg) || 0),
        0
    );
    const wasteKg    = parseFloat(wasteWeight) || 0;
    const totalUsed  = totalGradeWeight + wasteKg;
    const remaining  = availableWeight - totalUsed;
    const isOverweight = totalUsed > availableWeight && availableWeight > 0;

    const addGradeRow    = () => setGradeRows((prev) => [...prev, { grade_code: "", output_weight_kg: "" }]);
    const removeGradeRow = (index) => setGradeRows((prev) => prev.filter((_, i) => i !== index));
    const updateGradeRow = (index, field, value) =>
        setGradeRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

    const gradingMutation = useMutation({
        mutationFn: async () => {
            if (!selectedBatch) throw new Error("No batch selected");
            if (isOverweight)   throw new Error("Total weight exceeds available batch weight");
            if (gradeRows.some((r) => !r.grade_code || !r.output_weight_kg)) {
                throw new Error("Every grade row needs a grade and a weight");
            }

            // Record a CinnamonProcessStep for the grading stage
            await matrixSales.entities.CinnamonProcessStep.create({
                batch_number:     selectedBatch.batch_number,
                stage:            "grading",
                input_weight_kg:  availableWeight,
                output_weight_kg: totalGradeWeight,
                waste_weight_kg:  wasteKg,
                yield_pct:        availableWeight > 0 ? (totalGradeWeight / availableWeight) * 100 : 0,
                started_at:       new Date().toISOString(),
                completed_at:     new Date().toISOString(),
                notes:            `Grading run: ${gradingNumber}`,
            });

            // Create one CinnamonGradingOutput row per grade
            for (const row of gradeRows) {
                await matrixSales.entities.CinnamonGradingOutput.create({
                    batch_number:     selectedBatch.batch_number,
                    grading_number:   gradingNumber,
                    grade_code:       row.grade_code,
                    output_weight_kg: parseFloat(row.output_weight_kg) || 0,
                });
            }

            // Advance batch stage
            await matrixSales.entities.CinnamonBatch.update(selectedBatch.id, {
                current_stage: "grading",
            });
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
        <Dialog open={true} onOpenChange={onClose}>
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
                                <SelectTrigger>
                                    <SelectValue placeholder="Select batch" />
                                </SelectTrigger>
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
                            <div className="grid grid-cols-3 gap-4 text-sm">
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
                                    <p className="font-medium capitalize">
                                        {selectedBatch.current_stage?.replace(/_/g, " ")}
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
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addGradeRow}
                                disabled={!selectedBatch}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Grade
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {gradeRows.map((row, index) => (
                                <div key={index} className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
                                    <div>
                                        <Label className="text-xs">Grade</Label>
                                        <Select
                                            value={row.grade_code}
                                            onValueChange={(v) => updateGradeRow(index, "grade_code", v)}
                                            disabled={!selectedBatch}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
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
                                        <Label className="text-xs">Weight (kg)</Label>
                                        <Input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={row.output_weight_kg}
                                            onChange={(e) => updateGradeRow(index, "output_weight_kg", e.target.value)}
                                            disabled={!selectedBatch}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeGradeRow(index)}
                                        disabled={gradeRows.length === 1}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label>Waste / Loss (kg)</Label>
                        <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={wasteWeight}
                            onChange={(e) => setWasteWeight(e.target.value)}
                            disabled={!selectedBatch}
                            className="max-w-xs"
                        />
                    </div>

                    {selectedBatch && (
                        <Alert className={isOverweight ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                                <div className="text-sm space-y-1">
                                    <p>
                                        Grade Outputs: <strong>{totalGradeWeight.toFixed(3)} kg</strong>
                                    </p>
                                    <p>
                                        Waste: <strong>{wasteKg.toFixed(3)} kg</strong>
                                    </p>
                                    <p>
                                        Total Used: <strong>{totalUsed.toFixed(3)} kg</strong> /{" "}
                                        {availableWeight.toFixed(3)} kg available
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
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
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
