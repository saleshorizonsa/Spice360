import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Leaf } from "lucide-react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import SearchableSelect from "../shared/SearchableSelect";
import { useOrganization } from "../utils/OrganizationContext";

const BATCH_STAGES = [
    { value: "intake",          label: "Intake" },
    { value: "freight",         label: "Freight & Landed Cost" },
    { value: "pre_processing",  label: "Pre-Processing" },
    { value: "rubbing_peeling", label: "Rubbing & Peeling" },
    { value: "grading",         label: "Grading" },
    { value: "cutting",         label: "Cutting" },
    { value: "packaging",       label: "Packaging" },
    { value: "completed",       label: "Completed" },
];

export default function CinnamonBatchForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const isEdit = Boolean(item?.id);

    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);

    const [formData, setFormData] = useState({
        batch_number:          item?.batch_number          || `CIN-BATCH-${Date.now()}`,
        grn_reference:         item?.grn_reference         || "",
        supplier:              item?.supplier              || "",
        vendor_code:           item?.vendor_code           || "",
        origin:                item?.origin                || "",
        harvest_date:          item?.harvest_date          || new Date().toISOString().split("T")[0],
        raw_material_code:     item?.raw_material_code     || "",
        raw_material_name:     item?.raw_material_name     || "",
        input_weight_kg:       item?.input_weight_kg       || "",
        moisture_in_pct:       item?.moisture_in_pct       || "",
        shrinkage_pct:         item?.shrinkage_pct         ?? 3,
        purchase_price_per_kg: item?.purchase_price_per_kg || "",
        freight_amount:        item?.freight_amount        || 0,
        notes:                 item?.notes                 || "",
        current_stage:         item?.current_stage         || "intake",
        status:                item?.status                || "active",
    });

    // ── Data sources ─────────────────────────────────────────────────────────
    const { data: vendors = [] } = useQuery({
        queryKey: ["vendors", currentOrg?.id],
        queryFn: () => matrixSales.entities.Vendor.list(),
        initialData: [],
    });

    const { data: grns = [] } = useQuery({
        queryKey: ["grns", currentOrg?.id],
        queryFn: () => matrixSales.entities.GoodsReceiptNote.list("-grn_date"),
        initialData: [],
    });

    const { data: materials = [] } = useQuery({
        queryKey: ["materials", currentOrg?.id],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: [],
    });

    // ── Landed cost computation ───────────────────────────────────────────────
    const inputKg       = parseFloat(formData.input_weight_kg) || 0;
    const shrinkagePct  = parseFloat(formData.shrinkage_pct) || 3;
    const purchasePrice = parseFloat(formData.purchase_price_per_kg) || 0;
    const freight       = parseFloat(formData.freight_amount) || 0;

    const { usableKg, baseCost, landedCostPerKg } = useMemo(() => {
        const usable  = inputKg * (1 - shrinkagePct / 100);
        const base    = inputKg * purchasePrice;  // pay for ALL raw input, shrinkage loss is a real cost
        const landed  = usable > 0 ? (base + freight) / usable : 0;
        return { usableKg: usable, baseCost: base, landedCostPerKg: landed };
    }, [inputKg, shrinkagePct, purchasePrice, freight]);

    // ── Option lists ─────────────────────────────────────────────────────────
    const vendorOptions = vendors.map((v) => ({
        value: v.vendor_code || v.id,
        label: `${v.vendor_code ? v.vendor_code + " – " : ""}${v.vendor_name}`,
    }));

    const grnOptions = grns
        .filter((g) => g.status !== "reversed")
        .map((g) => ({
            value: g.grn_number,
            label: `${g.grn_number}${g.vendor_name ? " | " + g.vendor_name : ""}${g.material_name ? " | " + g.material_name : ""}${g.quantity_received ? " | " + g.quantity_received + " " + (g.unit_of_measure || "") : ""}`,
            _raw: g,
        }));

    const materialOptions = materials.map((m) => ({
        value: m.material_code,
        label: `${m.material_code} – ${m.material_name}`,
        _raw: m,
    }));

    // ── Auto-fills ────────────────────────────────────────────────────────────
    const handleGRNSelect = (grnNumber) => {
        const grn = grns.find((g) => g.grn_number === grnNumber);
        handleChange("grn_reference", grnNumber);
        if (grn) {
            if (grn.vendor_name)     handleChange("supplier", grn.vendor_name);
            if (grn.vendor_code)     handleChange("vendor_code", grn.vendor_code);
            if (grn.material_code)   handleChange("raw_material_code", grn.material_code);
            if (grn.material_name)   handleChange("raw_material_name", grn.material_name);
            if (grn.quantity_received) handleChange("input_weight_kg", grn.quantity_received);
            if (grn.unit_price)      handleChange("purchase_price_per_kg", grn.unit_price);
            if (grn.receipt_date || grn.grn_date) handleChange("harvest_date", grn.receipt_date || grn.grn_date);
        }
    };

    const handleVendorSelect = (vendorCode) => {
        const vendor = vendors.find((v) => (v.vendor_code || v.id) === vendorCode);
        handleChange("vendor_code", vendorCode);
        if (vendor) handleChange("supplier", vendor.vendor_name);
    };

    const handleMaterialSelect = (materialCode) => {
        const mat = materials.find((m) => m.material_code === materialCode);
        handleChange("raw_material_code", materialCode);
        if (mat) handleChange("raw_material_name", mat.material_name || "");
    };

    const saveMutation = useMutation({
        mutationFn: (data) =>
            isEdit
                ? matrixSales.entities.CinnamonBatch.update(item.id, data)
                : matrixSales.entities.CinnamonBatch.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cinnamonBatches"] });
            toast({ title: "Success", description: isEdit ? "Batch updated" : "Batch created" });
            setIsDirty(false);
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
            input_weight_kg:       parseFloat(formData.input_weight_kg) || 0,
            moisture_in_pct:       parseFloat(formData.moisture_in_pct) || 0,
            shrinkage_pct:         parseFloat(formData.shrinkage_pct) ?? 3,
            purchase_price_per_kg: parseFloat(formData.purchase_price_per_kg) || 0,
            freight_amount:        parseFloat(formData.freight_amount) || 0,
            usable_weight_kg:      usableKg,
            landed_cost_per_kg:    landedCostPerKg,
        });
    };

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Leaf className="w-5 h-5 text-emerald-600" />
                        {isEdit ? "Edit Batch" : "New Cinnamon Batch"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Row 1: Batch Number + GRN Reference */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Batch Number</Label>
                            <Input value={formData.batch_number} disabled className="bg-gray-50" />
                        </div>
                        <SearchableSelect
                            label="GRN Reference"
                            value={formData.grn_reference}
                            onValueChange={handleGRNSelect}
                            options={grnOptions}
                            placeholder="Select GRN…"
                            searchPlaceholder="Search by GRN number, vendor, material…"
                        />
                    </div>

                    {/* Row 2: Supplier + Origin */}
                    <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect
                            label="Supplier *"
                            value={formData.vendor_code || formData.supplier}
                            onValueChange={handleVendorSelect}
                            options={vendorOptions}
                            placeholder="Select vendor…"
                            searchPlaceholder="Search vendors…"
                            required
                        />
                        <div>
                            <Label>Origin</Label>
                            <Input
                                value={formData.origin}
                                onChange={(e) => handleChange("origin", e.target.value)}
                                placeholder="e.g., Sri Lanka – Kandy"
                            />
                        </div>
                    </div>

                    {/* Row 3: Raw Material + Harvest Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect
                            label="Raw Material Code"
                            value={formData.raw_material_code}
                            onValueChange={handleMaterialSelect}
                            options={materialOptions}
                            placeholder="Select material…"
                            searchPlaceholder="Search by code or name…"
                        />
                        <div>
                            <Label>Harvest / Receipt Date</Label>
                            <Input
                                type="date"
                                value={formData.harvest_date}
                                onChange={(e) => handleChange("harvest_date", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Row 4: Input Weight + Moisture */}
                    <div className="grid grid-cols-2 gap-4">
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
                            <Label>Intake Moisture % *</Label>
                            <Input
                                type="number" step="0.01" min="0" max="100"
                                value={formData.moisture_in_pct}
                                onChange={(e) => handleChange("moisture_in_pct", e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Purchase & Landed Cost section */}
                    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 space-y-3">
                        <h3 className="text-sm font-semibold text-amber-900">Purchase & Landed Cost</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Shrinkage / Cleaning Loss %</Label>
                                <Input
                                    type="number" step="0.1" min="0" max="100"
                                    value={formData.shrinkage_pct}
                                    onChange={(e) => handleChange("shrinkage_pct", e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Purchase Price (LKR/kg)</Label>
                                <Input
                                    type="number" step="0.01" min="0"
                                    value={formData.purchase_price_per_kg}
                                    onChange={(e) => handleChange("purchase_price_per_kg", e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <Label>Inbound Freight (LKR)</Label>
                                <Input
                                    type="number" step="0.01" min="0"
                                    value={formData.freight_amount}
                                    onChange={(e) => handleChange("freight_amount", e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {inputKg > 0 && (
                            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-amber-200">
                                <div>
                                    <p className="text-xs text-amber-700">Usable Weight</p>
                                    <p className="font-bold text-amber-900">{usableKg.toFixed(3)} kg</p>
                                    <p className="text-xs text-amber-600">after {shrinkagePct}% shrinkage</p>
                                </div>
                                <div>
                                    <p className="text-xs text-amber-700">Base Material Cost</p>
                                    <p className="font-bold text-amber-900">LKR {baseCost.toFixed(2)}</p>
                                    <p className="text-xs text-amber-600">usable × price/kg</p>
                                </div>
                                <div className="bg-amber-100 rounded p-2">
                                    <p className="text-xs text-amber-700 font-semibold">Landed Cost / kg</p>
                                    <p className="text-xl font-bold text-amber-900">LKR {landedCostPerKg.toFixed(4)}</p>
                                    <p className="text-xs text-amber-600">carries to all steps</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row 5: Current Stage + Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Current Stage</Label>
                            <Select
                                value={formData.current_stage}
                                onValueChange={(v) => handleChange("current_stage", v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {BATCH_STAGES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => handleChange("status", v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange("notes", e.target.value)}
                            rows={3}
                            placeholder="Any additional details about this batch…"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
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
