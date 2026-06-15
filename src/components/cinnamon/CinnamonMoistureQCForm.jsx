import React, { useState } from "react";
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
import { Droplets, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

const MOISTURE_THRESHOLD = 12; // export threshold — packaging blocked above this
const MOISTURE_HARD_MAX  = 14; // absolute maximum — record rejected entirely

export default function CinnamonMoistureQCForm({ onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: batches = [] } = useQuery({
        queryKey: ["cinnamonBatches"],
        queryFn: () => matrixSales.entities.CinnamonBatch.filter({ status: "active" }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const [batchNumber, setBatchNumber] = useState("");
    const [moisturePct, setMoisturePct] = useState("");
    const [instrument, setInstrument] = useState("");
    const [notes, setNotes] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);

    const moisture         = parseFloat(moisturePct) || 0;
    const isAboveThreshold = moisture > MOISTURE_THRESHOLD;
    const isAbsoluteMax    = moisture > MOISTURE_HARD_MAX;

    const safeBatches = Array.isArray(batches) ? batches : [];

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!batchNumber) throw new Error("Select a batch");
            if (isAbsoluteMax) {
                throw new Error(
                    `Moisture ${moisture}% exceeds the absolute maximum of ${MOISTURE_HARD_MAX}%. Batch cannot proceed.`
                );
            }

            const batch = safeBatches.find((b) => b.batch_number === batchNumber);
            if (!batch) throw new Error("Batch not found");

            const reading = `Moisture QC: ${moisture}% | Instrument: ${instrument || "—"} | ${notes}`.trim();

            await matrixSales.entities.CinnamonProcessStep.create({
                batch_number:     batchNumber,
                stage:            "moisture_qc",
                input_weight_kg:  parseFloat(batch.input_weight_kg) || 0,
                output_weight_kg: parseFloat(batch.input_weight_kg) || 0,
                waste_weight_kg:  0,
                yield_pct:        100,
                started_at:       new Date().toISOString(),
                completed_at:     new Date().toISOString(),
                notes:            reading,
            });

            await matrixSales.entities.CinnamonBatch.update(batch.id, {
                moisture_in_pct:    moisture,
                moisture_qc_status: isAboveThreshold ? "above_threshold" : "passed",
                moisture_qc_date:   new Date().toISOString(),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cinnamonBatches"] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonProcessSteps"] });
            toast({ title: "Success", description: "Moisture QC reading saved" });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-emerald-600" />
                        Moisture QC
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>Batch *</Label>
                        <Select onValueChange={(v) => { setIsDirty(true); setBatchNumber(v); }} required>
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Moisture Content % *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={moisturePct}
                                onChange={(e) => { setIsDirty(true); setMoisturePct(e.target.value); }}
                                required
                            />
                        </div>
                        <div>
                            <Label>Measuring Instrument</Label>
                            <Input
                                value={instrument}
                                onChange={(e) => { setIsDirty(true); setInstrument(e.target.value); }}
                                placeholder="e.g., Moisture Meter A"
                            />
                        </div>
                    </div>

                    {moisturePct !== "" && (
                        <Alert
                            className={
                                isAbsoluteMax
                                    ? "border-red-300 bg-red-50"
                                    : isAboveThreshold
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-green-300 bg-green-50"
                            }
                        >
                            {isAbsoluteMax ? (
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                            ) : isAboveThreshold ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            )}
                            <AlertDescription>
                                {isAbsoluteMax && (
                                    <span className="text-red-700 font-semibold">
                                        {moisture}% exceeds the absolute maximum ({MOISTURE_HARD_MAX}%). This record
                                        will be rejected.
                                    </span>
                                )}
                                {!isAbsoluteMax && isAboveThreshold && (
                                    <span className="text-amber-700 font-semibold">
                                        {moisture}% is above the export threshold ({MOISTURE_THRESHOLD}%). Packaging
                                        will be blocked until moisture drops.
                                    </span>
                                )}
                                {!isAboveThreshold && (
                                    <span className="text-green-700 font-semibold">
                                        {moisture}% — passes moisture threshold ({MOISTURE_THRESHOLD}%). Safe to
                                        proceed to packaging.
                                    </span>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => { setIsDirty(true); setNotes(e.target.value); }}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={
                                !batchNumber ||
                                moisturePct === "" ||
                                isAbsoluteMax ||
                                saveMutation.isPending
                            }
                            onClick={() => saveMutation.mutate()}
                        >
                            Save QC Reading
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
