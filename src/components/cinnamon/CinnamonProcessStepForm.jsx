import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Activity, Plus, Trash2, Users } from "lucide-react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

const STAGES = [
    { value: "pre_processing",  label: "Pre-Processing" },
    { value: "rubbing_peeling", label: "Rubbing & Peeling" },
    { value: "quill_making",    label: "Quill Making" },
    { value: "grading",         label: "Grading" },
    { value: "cutting",         label: "Cutting" },
    { value: "packaging",       label: "Packaging & Storage" },
];

const EMPTY_WORKER = { worker_name: "", hours_worked: "", rate_per_hour: "", amount: 0 };

function parseLabourEntries(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
}

export default function CinnamonProcessStepForm({ item, onClose }) {
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

    const [formData, setFormData] = useState({
        batch_number:     item?.batch_number     || "",
        stage:            item?.stage            || "",
        input_weight_kg:  item?.input_weight_kg  || "",
        output_weight_kg: item?.output_weight_kg || "",
        waste_weight_kg:  item?.waste_weight_kg  || 0,
        operator:         item?.operator         || "",
        machine:          item?.machine          || "",
        started_at:       item?.started_at       || new Date().toISOString().slice(0, 16),
        completed_at:     item?.completed_at     || "",
        notes:            item?.notes            || "",
    });

    const [labourEntries, setLabourEntries] = useState(() => parseLabourEntries(item?.labour_entries));

    const inputKg  = parseFloat(formData.input_weight_kg)  || 0;
    const outputKg = parseFloat(formData.output_weight_kg) || 0;
    const wasteKg  = parseFloat(formData.waste_weight_kg)  || 0;
    const yieldPct = inputKg > 0 ? ((outputKg / inputKg) * 100).toFixed(1) : null;
    const isOverweight = outputKg + wasteKg > inputKg && inputKg > 0;

    const totalLabourCost = useMemo(
        () => labourEntries.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0),
        [labourEntries]
    );

    const safeBatches = Array.isArray(batches) ? batches : [];

    const addWorker = () => {
        setIsDirty(true);
        setLabourEntries(prev => [...prev, { ...EMPTY_WORKER }]);
    };

    const removeWorker = (idx) => {
        setIsDirty(true);
        setLabourEntries(prev => prev.filter((_, i) => i !== idx));
    };

    const updateWorker = (idx, field, value) => {
        setIsDirty(true);
        setLabourEntries(prev => prev.map((w, i) => {
            if (i !== idx) return w;
            const updated = { ...w, [field]: value };
            const hours = parseFloat(field === "hours_worked" ? value : updated.hours_worked) || 0;
            const rate  = parseFloat(field === "rate_per_hour" ? value : updated.rate_per_hour) || 0;
            updated.amount = hours * rate;
            return updated;
        }));
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const step = await (isEdit
                ? matrixSales.entities.CinnamonProcessStep.update(item.id, data)
                : matrixSales.entities.CinnamonProcessStep.create(data));

            if (!isEdit) {
                const batch = safeBatches.find((b) => b.batch_number === data.batch_number);
                if (batch) {
                    await matrixSales.entities.CinnamonBatch.update(batch.id, {
                        current_stage: data.stage,
                    });
                }
            }

            // Roll up total labour cost to the batch
            const allSteps = await matrixSales.entities.CinnamonProcessStep.filter({
                batch_number: data.batch_number
            });
            const batchLabourTotal = allSteps.reduce((sum, s) => {
                const cost = s.id === step.id
                    ? data.labour_cost_total
                    : (parseFloat(s.labour_cost_total) || 0);
                return sum + cost;
            }, 0);
            const batchOutputTotal = allSteps.reduce((sum, s) => {
                const kg = s.id === step.id
                    ? (parseFloat(data.output_weight_kg) || 0)
                    : (parseFloat(s.output_weight_kg) || 0);
                return sum + kg;
            }, 0);

            const batch = safeBatches.find((b) => b.batch_number === data.batch_number);
            if (batch) {
                await matrixSales.entities.CinnamonBatch.update(batch.id, {
                    total_labour_cost: batchLabourTotal,
                    total_output_kg: batchOutputTotal,
                });
            }

            return step;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cinnamonProcessSteps"] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonBatches"] });
            toast({ title: "Success", description: "Process step saved" });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isOverweight) return;
        saveMutation.mutate({
            ...formData,
            input_weight_kg:   parseFloat(formData.input_weight_kg)  || 0,
            output_weight_kg:  parseFloat(formData.output_weight_kg) || 0,
            waste_weight_kg:   parseFloat(formData.waste_weight_kg)  || 0,
            yield_pct:         yieldPct !== null ? parseFloat(yieldPct) : 0,
            labour_entries:    labourEntries,
            labour_cost_total: totalLabourCost,
        });
    };

    const handleChange = (field, value) => {
        setIsDirty(true);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-600" />
                        {isEdit ? "Edit Process Step" : "Record Process Step"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Batch *</Label>
                            <Select
                                value={formData.batch_number}
                                onValueChange={(v) => handleChange("batch_number", v)}
                                required
                            >
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
                        <div>
                            <Label>Stage *</Label>
                            <Select
                                value={formData.stage}
                                onValueChange={(v) => handleChange("stage", v)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select stage" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STAGES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Input Weight (kg) *</Label>
                            <Input
                                type="number" step="0.001" min="0"
                                value={formData.input_weight_kg}
                                onChange={(e) => handleChange("input_weight_kg", e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Output Weight (kg) *</Label>
                            <Input
                                type="number" step="0.001" min="0"
                                value={formData.output_weight_kg}
                                onChange={(e) => handleChange("output_weight_kg", e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Waste (kg)</Label>
                            <Input
                                type="number" step="0.001" min="0"
                                value={formData.waste_weight_kg}
                                onChange={(e) => handleChange("waste_weight_kg", e.target.value)}
                            />
                        </div>
                    </div>

                    {inputKg > 0 && (
                        <Alert className={isOverweight ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                            <AlertDescription>
                                <div className="text-sm space-y-1">
                                    <p>
                                        Output + Waste:{" "}
                                        <strong>{(outputKg + wasteKg).toFixed(3)} kg</strong> / {inputKg.toFixed(3)} kg input
                                    </p>
                                    <p>
                                        Yield: <strong>{yieldPct !== null ? `${yieldPct}%` : "—"}</strong>
                                    </p>
                                    {isOverweight && (
                                        <p className="text-red-700 font-semibold">
                                            Output + Waste exceeds input weight
                                        </p>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Operator</Label>
                            <Input
                                value={formData.operator}
                                onChange={(e) => handleChange("operator", e.target.value)}
                                placeholder="Operator name"
                            />
                        </div>
                        <div>
                            <Label>Machine</Label>
                            <Input
                                value={formData.machine}
                                onChange={(e) => handleChange("machine", e.target.value)}
                                placeholder="Machine ID"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Started At</Label>
                            <Input
                                type="datetime-local"
                                value={formData.started_at}
                                onChange={(e) => handleChange("started_at", e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Completed At</Label>
                            <Input
                                type="datetime-local"
                                value={formData.completed_at}
                                onChange={(e) => handleChange("completed_at", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Contract Labour Section */}
                    <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm flex items-center gap-2 text-blue-800">
                                <Users className="w-4 h-4" />
                                Contract Labour
                            </h3>
                            <Button type="button" size="sm" variant="outline" onClick={addWorker}>
                                <Plus className="w-3 h-3 mr-1" /> Add Worker
                            </Button>
                        </div>

                        {labourEntries.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-2">
                                No workers added — click "Add Worker"
                            </p>
                        ) : (
                            <>
                                <div className="grid grid-cols-[1fr_80px_100px_88px_32px] gap-2 text-xs font-medium text-gray-500 px-1">
                                    <span>Worker Name</span>
                                    <span>Hours</span>
                                    <span>Rate/hr (LKR)</span>
                                    <span className="text-right">Amount</span>
                                    <span />
                                </div>
                                {labourEntries.map((w, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_80px_100px_88px_32px] gap-2 items-center">
                                        <Input
                                            value={w.worker_name}
                                            onChange={(e) => updateWorker(idx, "worker_name", e.target.value)}
                                            placeholder="Name"
                                            className="h-8 text-sm"
                                        />
                                        <Input
                                            type="number" min="0" step="0.5"
                                            value={w.hours_worked}
                                            onChange={(e) => updateWorker(idx, "hours_worked", e.target.value)}
                                            placeholder="0"
                                            className="h-8 text-sm"
                                        />
                                        <Input
                                            type="number" min="0" step="0.01"
                                            value={w.rate_per_hour}
                                            onChange={(e) => updateWorker(idx, "rate_per_hour", e.target.value)}
                                            placeholder="0.00"
                                            className="h-8 text-sm"
                                        />
                                        <div className="text-sm font-semibold text-emerald-700 text-right pr-1">
                                            {(parseFloat(w.amount) || 0).toFixed(2)}
                                        </div>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-red-400 hover:text-red-600"
                                            onClick={() => removeWorker(idx)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex justify-end pt-2 border-t">
                                    <span className="text-sm font-semibold">
                                        Total Labour Cost:{" "}
                                        <span className="text-emerald-700">LKR {totalLabourCost.toFixed(2)}</span>
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange("notes", e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saveMutation.isPending || isOverweight}
                        >
                            {isEdit ? "Update Step" : "Save Step"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
