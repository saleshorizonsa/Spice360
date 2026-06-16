
import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";
import { useToast } from "@/components/ui/use-toast";
import { Hash, Eye } from "lucide-react";

const DOCUMENT_TYPES = [
    { value: "purchase_requisition",  label: "Purchase Requisition",  default_prefix: "PR-"   },
    { value: "rfq",                   label: "Request for Quotation",  default_prefix: "RFQ-"  },
    { value: "purchase_order",        label: "Purchase Order",         default_prefix: "PO-"   },
    { value: "grn",                   label: "Goods Receipt Note",     default_prefix: "GRN-"  },
    { value: "vendor_invoice",        label: "Vendor Invoice",         default_prefix: "VINV-" },
    { value: "sales_quotation",       label: "Sales Quotation",        default_prefix: "QT-"   },
    { value: "sales_order",           label: "Sales Order",            default_prefix: "SO-"   },
    { value: "delivery",              label: "Delivery Note",          default_prefix: "DN-"   },
    { value: "invoice",               label: "Customer Invoice",       default_prefix: "INV-"  },
    { value: "credit_note",           label: "Credit Note",            default_prefix: "CN-"   },
    { value: "sales_return",          label: "Sales Return",           default_prefix: "SR-"   },
    { value: "production_order",      label: "Production Order",       default_prefix: "MO-"   },
    { value: "work_order",            label: "Work Order",             default_prefix: "WO-"   },
    { value: "stock_transfer",        label: "Stock Transfer Order",   default_prefix: "STO-"  },
    { value: "cinnamon_batch",        label: "Cinnamon Batch",         default_prefix: "CB-"   },
    { value: "eos_settlement",        label: "EOS Settlement",         default_prefix: "EOS-"  },
    { value: "payroll",               label: "Payroll",                default_prefix: "PAY-"  },
    { value: "journal_entry",         label: "Journal Entry",          default_prefix: "JE-"   },
    { value: "budget",                label: "Budget",                 default_prefix: "BUD-"  },
    { value: "asset_disposal",        label: "Asset Disposal",         default_prefix: "AD-"   },
];

const EMPTY = {
    document_type: "",
    prefix: "",
    suffix: "",
    current_number: 1,
    number_length: 5,
    mode: "automatic",
    include_year: false,
    year_format: "YYYY",
    year_position: "after_prefix",
    separator: "-",
    reset_yearly: false,
    status: "active",
    notes: "",
};

function buildPreview(form) {
    const num = String(form.current_number || 1).padStart(Math.max(1, parseInt(form.number_length) || 5), "0");
    const year = form.year_format === "YY"
        ? String(new Date().getFullYear()).slice(-2)
        : String(new Date().getFullYear());
    const sep = form.separator || "";

    let middle = "";
    if (form.include_year && form.year_position === "after_prefix") {
        middle = `${year}${sep}${num}`;
    } else if (form.include_year && form.year_position === "before_suffix") {
        middle = `${num}${sep}${year}`;
    } else {
        middle = num;
    }

    const prefix = form.prefix || "";
    const suffix = form.suffix || "";
    return `${prefix}${middle}${suffix}`;
}

export default function DocumentNumberRangeForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const isEdit = !!item;

    const [form, setForm] = useState({ ...EMPTY });

    useEffect(() => {
        if (item) {
            setForm({
                document_type:  item.document_type  || "",
                prefix:         item.prefix         || "",
                suffix:         item.suffix         || "",
                current_number: item.current_number ?? 1,
                number_length:  item.number_length  ?? 5,
                mode:           item.mode           || "automatic",
                include_year:   !!item.include_year,
                year_format:    item.year_format    || "YYYY",
                year_position:  item.year_position  || "after_prefix",
                separator:      item.separator      ?? "-",
                reset_yearly:   !!item.reset_yearly,
                status:         item.status         || "active",
                notes:          item.notes          || "",
            });
        } else {
            setForm({ ...EMPTY });
        }
    }, [item]);

    const preview = useMemo(() => buildPreview(form), [form]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleDocTypeChange = (val) => {
        const dt = DOCUMENT_TYPES.find(d => d.value === val);
        setForm(f => ({
            ...f,
            document_type: val,
            prefix: f.prefix || (dt?.default_prefix || ""),
        }));
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (isEdit) {
                return matrixSales.entities.DocumentNumberRange.update(item.id, data);
            }
            return matrixSales.entities.DocumentNumberRange.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documentNumberRanges"] });
            toast({ title: "Saved", description: "Number range saved successfully." });
            onClose();
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to save number range.", variant: "destructive" });
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.document_type) {
            toast({ title: "Validation", description: "Please select a document type.", variant: "destructive" });
            return;
        }
        if (!form.prefix && !form.document_type) {
            toast({ title: "Validation", description: "Prefix is required.", variant: "destructive" });
            return;
        }
        const num = parseInt(form.current_number);
        const len = parseInt(form.number_length);
        if (isNaN(num) || num < 1) {
            toast({ title: "Validation", description: "Starting number must be ≥ 1.", variant: "destructive" });
            return;
        }
        if (isNaN(len) || len < 1 || len > 10) {
            toast({ title: "Validation", description: "Number length must be 1–10.", variant: "destructive" });
            return;
        }
        const dt = DOCUMENT_TYPES.find(d => d.value === form.document_type);
        saveMutation.mutate({
            ...form,
            document_label: dt?.label || form.document_type,
            current_number: num,
            number_length: len,
            last_used_number: isEdit ? item.last_used_number : null,
        });
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Hash className="w-5 h-5 text-indigo-600" />
                        {isEdit ? "Edit Number Range" : "New Number Range"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Document type */}
                    <div className="space-y-1.5">
                        <Label>Document Type <span className="text-red-500">*</span></Label>
                        <Select value={form.document_type} onValueChange={handleDocTypeChange} disabled={isEdit}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select document type…" />
                            </SelectTrigger>
                            <SelectContent>
                                {DOCUMENT_TYPES.map(dt => (
                                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isEdit && <p className="text-xs text-gray-400">Document type cannot be changed after creation.</p>}
                    </div>

                    {/* Mode */}
                    <div className="space-y-1.5">
                        <Label>Numbering Mode</Label>
                        <div className="flex gap-2">
                            {["automatic", "manual"].map(m => (
                                <button key={m} type="button"
                                    onClick={() => set("mode", m)}
                                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                                        form.mode === m
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                                    }`}>
                                    {m === "automatic" ? "Automatic" : "Manual"}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400">
                            {form.mode === "automatic"
                                ? "System auto-assigns the next number in sequence."
                                : "User enters the document number manually (system validates format only)."}
                        </p>
                    </div>

                    {/* Prefix / Suffix */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Prefix <span className="text-xs text-gray-400">(e.g. PO-, INV-)</span></Label>
                            <Input
                                value={form.prefix}
                                onChange={e => set("prefix", e.target.value.toUpperCase())}
                                placeholder="PO-"
                                maxLength={10}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Suffix <span className="text-xs text-gray-400">(optional)</span></Label>
                            <Input
                                value={form.suffix}
                                onChange={e => set("suffix", e.target.value.toUpperCase())}
                                placeholder="-LKR"
                                maxLength={10}
                            />
                        </div>
                    </div>

                    {/* Year embedding */}
                    <div className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Include Year</Label>
                                <p className="text-xs text-gray-400 mt-0.5">Embed the fiscal year in the number</p>
                            </div>
                            <Switch
                                checked={form.include_year}
                                onCheckedChange={v => set("include_year", v)}
                            />
                        </div>

                        {form.include_year && (
                            <div className="grid grid-cols-3 gap-3 pt-1 border-t">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Year Format</Label>
                                    <Select value={form.year_format} onValueChange={v => set("year_format", v)}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="YYYY">YYYY (2025)</SelectItem>
                                            <SelectItem value="YY">YY (25)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Year Position</Label>
                                    <Select value={form.year_position} onValueChange={v => set("year_position", v)}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="after_prefix">After prefix</SelectItem>
                                            <SelectItem value="before_suffix">Before suffix</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Separator</Label>
                                    <Select value={form.separator} onValueChange={v => set("separator", v)}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="-">Dash  ( - )</SelectItem>
                                            <SelectItem value="/">Slash ( / )</SelectItem>
                                            <SelectItem value=".">Dot   ( . )</SelectItem>
                                            <SelectItem value="">None</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Number settings */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Starting / Next Number</Label>
                            <Input
                                type="number"
                                min={1}
                                value={form.current_number}
                                onChange={e => set("current_number", e.target.value)}
                            />
                            {isEdit && item?.last_used_number && (
                                <p className="text-xs text-amber-600">Last used: {item.last_used_number}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Digit Length <span className="text-xs text-gray-400">(zero-padded)</span></Label>
                            <Select value={String(form.number_length)} onValueChange={v => set("number_length", parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6, 7, 8].map(n => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} digits — {"0".repeat(n - 1)}1
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Reset yearly */}
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                        <div>
                            <Label>Reset Counter Yearly</Label>
                            <p className="text-xs text-gray-400 mt-0.5">Restart sequence from 1 each calendar year</p>
                        </div>
                        <Switch
                            checked={form.reset_yearly}
                            onCheckedChange={v => set("reset_yearly", v)}
                        />
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <div className="flex gap-2">
                            {["active", "inactive"].map(s => (
                                <button key={s} type="button"
                                    onClick={() => set("status", s)}
                                    className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors capitalize ${
                                        form.status === s
                                            ? s === "active" ? "bg-emerald-600 text-white border-emerald-600" : "bg-gray-500 text-white border-gray-500"
                                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                                    }`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label>Notes <span className="text-xs text-gray-400">(optional)</span></Label>
                        <Input
                            value={form.notes}
                            onChange={e => set("notes", e.target.value)}
                            placeholder="e.g. Used for all export purchase orders"
                            maxLength={200}
                        />
                    </div>

                    {/* Live preview */}
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-700">Number Preview</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-lg font-bold tracking-widest text-indigo-800 bg-white border border-indigo-200 rounded px-3 py-1">
                                {preview || "—"}
                            </code>
                            <span className="text-xs text-gray-500">
                                {form.mode === "automatic" ? "Auto-assigned" : "Manual entry"} ·{" "}
                                {form.reset_yearly ? "Resets yearly" : "Continuous"}
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saveMutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700">
                            {saveMutation.isPending ? "Saving…" : isEdit ? "Update Range" : "Create Range"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
