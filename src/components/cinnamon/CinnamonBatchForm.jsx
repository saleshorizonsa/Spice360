import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Leaf } from "lucide-react";

export default function CinnamonBatchForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const isEdit = Boolean(item?.id);

    const [formData, setFormData] = useState({
        batch_number:     item?.batch_number     || `CIN-BATCH-${Date.now()}`,
        supplier:         item?.supplier         || "",
        origin:           item?.origin           || "",
        harvest_date:     item?.harvest_date     || new Date().toISOString().split("T")[0],
        raw_material_code:item?.raw_material_code|| "",
        input_weight_kg:  item?.input_weight_kg  || "",
        moisture_in_pct:  item?.moisture_in_pct  || "",
        grn_reference:    item?.grn_reference    || "",
        notes:            item?.notes            || "",
        current_stage:    item?.current_stage    || "intake",
        status:           item?.status           || "active",
    });

    const saveMutation = useMutation({
        mutationFn: (data) =>
            isEdit
                ? matrixSales.entities.CinnamonBatch.update(item.id, data)
                : matrixSales.entities.CinnamonBatch.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cinnamonBatches"] });
            toast({ title: "Success", description: isEdit ? "Batch updated" : "Batch created" });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate({
            ...formData,
            input_weight_kg: parseFloat(formData.input_weight_kg) || 0,
            moisture_in_pct: parseFloat(formData.moisture_in_pct) || 0,
        });
    };

    const handleChange = (field, value) =>
        setFormData((prev) => ({ ...prev, [field]: value }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Leaf className="w-5 h-5 text-emerald-600" />
                        {isEdit ? "Edit Batch" : "New Cinnamon Batch"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Batch Number</Label>
                            <Input value={formData.batch_number} disabled />
                        </div>
                        <div>
                            <Label>GRN Reference</Label>
                            <Input
                                value={formData.grn_reference}
                                onChange={(e) => handleChange("grn_reference", e.target.value)}
                                placeholder="GRN-ALL-26-000001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Supplier *</Label>
                            <Input
                                value={formData.supplier}
                                onChange={(e) => handleChange("supplier", e.target.value)}
                                required
                                placeholder="Supplier name"
                            />
                        </div>
                        <div>
                            <Label>Origin</Label>
                            <Input
                                value={formData.origin}
                                onChange={(e) => handleChange("origin", e.target.value)}
                                placeholder="e.g., Sri Lanka – Kandy"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Harvest Date</Label>
                            <Input
                                type="date"
                                value={formData.harvest_date}
                                onChange={(e) => handleChange("harvest_date", e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Raw Material Code</Label>
                            <Input
                                value={formData.raw_material_code}
                                onChange={(e) => handleChange("raw_material_code", e.target.value)}
                                placeholder="e.g., CIN-RAW-001"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Input Weight (kg) *</Label>
                            <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={formData.input_weight_kg}
                                onChange={(e) => handleChange("input_weight_kg", e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Intake Moisture % *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={formData.moisture_in_pct}
                                onChange={(e) => handleChange("moisture_in_pct", e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange("notes", e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saveMutation.isPending}
                        >
                            {isEdit ? "Update Batch" : "Create Batch"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
