import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    FISCAL_AREAS,
    currentFiscalYear,
    fiscalPeriodLabel,
    fiscalYearOptions,
    periodSelectOptions,
} from "@/components/utils/fiscalPeriod";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Calendar, Edit2, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";

const NONE_VALUE = "__none__";

function PeriodSelect({ value, onChange, placeholder = "None", includeNone = false }) {
    const opts = periodSelectOptions(true);
    return (
        <Select
            value={value != null ? String(value) : NONE_VALUE}
            onValueChange={(v) => onChange(v === NONE_VALUE ? null : parseInt(v, 10))}
        >
            <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {includeNone && (
                    <SelectItem value={NONE_VALUE} className="text-xs text-gray-400">
                        — None —
                    </SelectItem>
                )}
                {opts.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function PeriodCell({ period }) {
    if (period == null) return <span className="text-gray-300 text-xs">—</span>;
    return <span className="text-xs">{fiscalPeriodLabel(period)}</span>;
}

export default function PeriodControlOB52() {
    const { currentOrg } = useOrganization();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const orgId = currentOrg?.id;

    const fyOptions = useMemo(() => fiscalYearOptions(null), []);
    const [fiscalYear, setFiscalYear] = useState(() => currentFiscalYear());
    const [editingArea, setEditingArea] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [deletingArea, setDeletingArea] = useState(null); // area key pending delete
    const [deleteReason, setDeleteReason] = useState("");
    const [initDialog, setInitDialog] = useState(false);
    const [initReason, setInitReason] = useState("");

    // ── fetch period_control rows ────────────────────────────────────────
    const { data: controls = [], isLoading } = useQuery({
        queryKey: ["periodControl", orgId, fiscalYear],
        enabled: !!orgId,
        queryFn: () =>
            matrixSales.entities.PeriodControl.filter({
                organization_id: orgId,
                fiscal_year: fiscalYear,
            }),
        initialData: [],
    });

    const controlMap = useMemo(
        () => Object.fromEntries(controls.map((c) => [c.area, c])),
        [controls]
    );

    // ── fetch audit log ──────────────────────────────────────────────────
    const { data: logEntries = [] } = useQuery({
        queryKey: ["periodControlLog", orgId, fiscalYear],
        enabled: !!orgId,
        queryFn: async () => {
            const rows = await matrixSales.entities.PeriodControlLog.filter({
                organization_id: orgId,
                fiscal_year: fiscalYear,
            });
            return rows.sort((a, b) =>
                (b.performed_at || "").localeCompare(a.performed_at || "")
            );
        },
        initialData: [],
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["periodControl", orgId, fiscalYear] });
        queryClient.invalidateQueries({ queryKey: ["periodControlLog", orgId, fiscalYear] });
    };

    // ── save (upsert) mutation with optimistic update ────────────────────
    const saveMutation = useMutation({
        mutationFn: async ({ area, current_from, current_to, prior_from, prior_to, reason, userEmail }) => {
            const existing = controlMap[area];
            let saved;
            if (existing) {
                saved = await matrixSales.entities.PeriodControl.update(existing.id, {
                    current_from,
                    current_to,
                    prior_from: prior_from ?? null,
                    prior_to: prior_to ?? null,
                    updated_by: userEmail,
                });
            } else {
                saved = await matrixSales.entities.PeriodControl.create({
                    organization_id: orgId,
                    fiscal_year: fiscalYear,
                    area,
                    current_from,
                    current_to,
                    prior_from: prior_from ?? null,
                    prior_to: prior_to ?? null,
                    updated_by: userEmail,
                });
            }
            await matrixSales.entities.PeriodControlLog.create({
                organization_id: orgId,
                fiscal_year: fiscalYear,
                area,
                interval_slot: "current",
                action: current_from != null ? "open" : "close",
                prev_from: existing?.current_from ?? null,
                prev_to: existing?.current_to ?? null,
                new_from: current_from ?? null,
                new_to: current_to ?? null,
                reason,
                performed_by: userEmail,
                performed_at: new Date().toISOString(),
            });
            if (prior_from !== existing?.prior_from || prior_to !== existing?.prior_to) {
                await matrixSales.entities.PeriodControlLog.create({
                    organization_id: orgId,
                    fiscal_year: fiscalYear,
                    area,
                    interval_slot: "prior",
                    action: prior_from != null ? "open" : "close",
                    prev_from: existing?.prior_from ?? null,
                    prev_to: existing?.prior_to ?? null,
                    new_from: prior_from ?? null,
                    new_to: prior_to ?? null,
                    reason,
                    performed_by: userEmail,
                    performed_at: new Date().toISOString(),
                });
            }
            return saved;
        },
        onMutate: async ({ area, current_from, current_to, prior_from, prior_to }) => {
            await queryClient.cancelQueries({ queryKey: ["periodControl", orgId, fiscalYear] });
            const previousData = queryClient.getQueryData(["periodControl", orgId, fiscalYear]);
            queryClient.setQueryData(["periodControl", orgId, fiscalYear], (old = []) => {
                const exists = old.find((c) => c.area === area);
                if (exists) {
                    return old.map((c) =>
                        c.area === area ? { ...c, current_from, current_to, prior_from: prior_from ?? null, prior_to: prior_to ?? null } : c
                    );
                }
                return [...old, { id: `optimistic-${area}`, area, fiscal_year: fiscalYear, organization_id: orgId, current_from, current_to, prior_from: prior_from ?? null, prior_to: prior_to ?? null }];
            });
            return { previousData };
        },
        onError: (e, _vars, context) => {
            queryClient.setQueryData(["periodControl", orgId, fiscalYear], context.previousData);
            toast({ title: "Error", description: e.message, variant: "destructive" });
        },
        onSuccess: () => {
            toast({ title: "Period control updated" });
            setEditingArea(null);
        },
        onSettled: () => invalidate(),
    });

    // ── delete mutation with optimistic update ───────────────────────────
    const deleteMutation = useMutation({
        mutationFn: async ({ area, reason, userEmail }) => {
            const existing = controlMap[area];
            if (!existing) throw new Error(`No period control found for area ${area}`);
            await matrixSales.entities.PeriodControlLog.create({
                organization_id: orgId,
                fiscal_year: fiscalYear,
                area,
                interval_slot: "current",
                action: "delete",
                prev_from: existing.current_from ?? null,
                prev_to: existing.current_to ?? null,
                new_from: null,
                new_to: null,
                reason,
                performed_by: userEmail,
                performed_at: new Date().toISOString(),
            });
            await matrixSales.entities.PeriodControl.delete(existing.id);
        },
        onMutate: async ({ area }) => {
            await queryClient.cancelQueries({ queryKey: ["periodControl", orgId, fiscalYear] });
            const previousData = queryClient.getQueryData(["periodControl", orgId, fiscalYear]);
            queryClient.setQueryData(["periodControl", orgId, fiscalYear], (old = []) =>
                old.filter((c) => c.area !== area)
            );
            return { previousData };
        },
        onError: (e, _vars, context) => {
            queryClient.setQueryData(["periodControl", orgId, fiscalYear], context.previousData);
            toast({ title: "Error", description: e.message, variant: "destructive" });
        },
        onSuccess: () => {
            toast({ title: "Period control deleted", description: "Row removed and audit log updated." });
            setDeletingArea(null);
            setDeleteReason("");
        },
        onSettled: () => invalidate(),
    });

    // ── initialize FY ────────────────────────────────────────────────────
    const initMutation = useMutation({
        mutationFn: async ({ reason, userEmail }) => {
            const missing = FISCAL_AREAS.filter(({ key }) => !controlMap[key]);
            await Promise.all(
                missing.map(({ key }) =>
                    matrixSales.entities.PeriodControl.create({
                        organization_id: orgId,
                        fiscal_year: fiscalYear,
                        area: key,
                        current_from: 1,
                        current_to: 12,
                        prior_from: null,
                        prior_to: null,
                        updated_by: userEmail,
                    })
                )
            );
            await Promise.all(
                missing.map(({ key }) =>
                    matrixSales.entities.PeriodControlLog.create({
                        organization_id: orgId,
                        fiscal_year: fiscalYear,
                        area: key,
                        interval_slot: "current",
                        action: "open",
                        prev_from: null,
                        prev_to: null,
                        new_from: 1,
                        new_to: 12,
                        reason,
                        performed_by: userEmail,
                        performed_at: new Date().toISOString(),
                    })
                )
            );
        },
        onSuccess: () => {
            invalidate();
            toast({ title: `FY ${fiscalYear} initialized`, description: "All 5 areas open Apr–Mar." });
            setInitDialog(false);
            setInitReason("");
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const openEdit = (areaKey) => {
        const ctrl = controlMap[areaKey] ?? {};
        setEditingArea(areaKey);
        setEditForm({
            current_from: ctrl.current_from ?? 1,
            current_to: ctrl.current_to ?? 12,
            prior_from: ctrl.prior_from ?? null,
            prior_to: ctrl.prior_to ?? null,
            reason: "",
        });
    };

    const handleSave = () => {
        if (!editForm.reason?.trim()) {
            toast({ title: "Reason required", description: "Please enter a reason for this change.", variant: "destructive" });
            return;
        }
        if (editForm.current_from != null && editForm.current_to != null && editForm.current_to < editForm.current_from) {
            toast({ title: "Invalid range", description: "Current 'to' must be ≥ 'from'.", variant: "destructive" });
            return;
        }
        if (editForm.prior_from != null && editForm.prior_to != null && editForm.prior_to < editForm.prior_from) {
            toast({ title: "Invalid range", description: "Prior 'to' must be ≥ 'from'.", variant: "destructive" });
            return;
        }
        saveMutation.mutate({
            area: editingArea,
            current_from: editForm.current_from,
            current_to: editForm.current_to,
            prior_from: editForm.prior_from,
            prior_to: editForm.prior_to,
            reason: editForm.reason.trim(),
            userEmail: currentOrg?.user_email ?? "system",
        });
    };

    const openDelete = (areaKey) => {
        setDeletingArea(areaKey);
        setDeleteReason("");
    };

    const handleDelete = () => {
        if (!deleteReason.trim()) {
            toast({ title: "Reason required", description: "Please enter a reason for deleting this row.", variant: "destructive" });
            return;
        }
        deleteMutation.mutate({
            area: deletingArea,
            reason: deleteReason.trim(),
            userEmail: currentOrg?.user_email ?? "system",
        });
    };

    const handleInit = () => {
        if (!initReason.trim()) {
            toast({ title: "Reason required", variant: "destructive" });
            return;
        }
        initMutation.mutate({
            reason: initReason.trim(),
            userEmail: currentOrg?.user_email ?? "system",
        });
    };

    const handlePrint = () => window.print();

    const allInitialized = FISCAL_AREAS.every(({ key }) => !!controlMap[key]);

    return (
        <div className="space-y-6 print:space-y-4">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-600" />
                        Period Control — OB52
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        April-March fiscal year · Periods 1 (Apr) – 12 (Mar) · Special 13–16
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={fiscalYear} onValueChange={setFiscalYear}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {fyOptions.map((fy) => (
                                <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!allInitialized && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setInitDialog(true)}
                            className="gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Initialize FY
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="gap-1.5"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["periodControl", orgId, fiscalYear] })}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Print header — only visible when printing */}
            <div className="hidden print:block">
                <h2 className="text-lg font-bold">Period Control — OB52 · FY {fiscalYear}</h2>
                <p className="text-xs text-gray-500">April-March fiscal year · Periods 1 (Apr) – 12 (Mar) · Special 13–16</p>
            </div>

            {/* ── OB52 grid ──────────────────────────────────────────────── */}
            <Card className="print:shadow-none print:border">
                <CardHeader className="print:py-2">
                    <CardTitle className="text-base">Open Periods — FY {fiscalYear}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
                                        <th className="px-4 py-2.5 text-left font-semibold">Area</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Cur. From</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Cur. To</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Prior From</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Prior To</th>
                                        <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                                        <th className="px-4 py-2.5 text-right font-semibold print:hidden">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {FISCAL_AREAS.map(({ key, label }) => {
                                        const ctrl = controlMap[key];
                                        const isOpen = ctrl?.current_from != null;
                                        return (
                                            <tr key={key} className="border-b last:border-0 hover:bg-slate-50/60">
                                                <td className="px-4 py-3 font-medium text-slate-800">{label}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <PeriodCell period={ctrl?.current_from} />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <PeriodCell period={ctrl?.current_to} />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <PeriodCell period={ctrl?.prior_from} />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <PeriodCell period={ctrl?.prior_to} />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!ctrl ? (
                                                        <Badge variant="outline" className="text-gray-400 text-xs">Not set</Badge>
                                                    ) : isOpen ? (
                                                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">Open</Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-800 text-xs">Closed</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right print:hidden">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEdit(key)}
                                                            className="h-7 px-2 gap-1 text-xs"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            Edit
                                                        </Button>
                                                        {ctrl && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openDelete(key)}
                                                                className="h-7 px-2 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                Delete
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Audit log ──────────────────────────────────────────────── */}
            <Card className="print:shadow-none print:border">
                <CardHeader className="print:py-2">
                    <CardTitle className="text-base">Audit Log — FY {fiscalYear}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {logEntries.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-gray-400">No period control actions recorded for this fiscal year.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                                        <th className="px-4 py-2 text-left">Date/Time</th>
                                        <th className="px-4 py-2 text-left">Area</th>
                                        <th className="px-4 py-2 text-left">Slot</th>
                                        <th className="px-4 py-2 text-left">Action</th>
                                        <th className="px-4 py-2 text-left">Before</th>
                                        <th className="px-4 py-2 text-left">After</th>
                                        <th className="px-4 py-2 text-left">By</th>
                                        <th className="px-4 py-2 text-left">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logEntries.map((entry) => (
                                        <tr key={entry.id} className="border-b last:border-0 hover:bg-slate-50/60">
                                            <td className="px-4 py-2 font-mono text-gray-500 whitespace-nowrap">
                                                {entry.performed_at ? entry.performed_at.slice(0, 16).replace("T", " ") : "—"}
                                            </td>
                                            <td className="px-4 py-2 font-semibold uppercase">{entry.area}</td>
                                            <td className="px-4 py-2">
                                                <Badge variant="outline" className="text-xs">{entry.interval_slot}</Badge>
                                            </td>
                                            <td className="px-4 py-2">
                                                <Badge
                                                    className={`text-xs ${
                                                        entry.action === "open"
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : entry.action === "delete"
                                                            ? "bg-red-100 text-red-800"
                                                            : "bg-orange-100 text-orange-800"
                                                    }`}
                                                >
                                                    {entry.action}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                {entry.prev_from != null
                                                    ? `${fiscalPeriodLabel(entry.prev_from)} – ${fiscalPeriodLabel(entry.prev_to)}`
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-2">
                                                {entry.new_from != null
                                                    ? `${fiscalPeriodLabel(entry.new_from)} – ${fiscalPeriodLabel(entry.new_to)}`
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-2 text-gray-600 max-w-[120px] truncate">
                                                {entry.performed_by}
                                            </td>
                                            <td className="px-4 py-2 text-gray-700 max-w-[200px]">
                                                {entry.reason}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Edit dialog ────────────────────────────────────────────── */}
            <Dialog open={!!editingArea} onOpenChange={(open) => { if (!open) setEditingArea(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Edit Period Control — {FISCAL_AREAS.find((a) => a.key === editingArea)?.label}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-gray-500">FY {fiscalYear} · Periods 1 (Apr) – 12 (Mar) – 16 (Special)</p>

                        <div>
                            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">
                                Current Interval (new transactions)
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs mb-1">From</Label>
                                    <PeriodSelect
                                        value={editForm.current_from}
                                        onChange={(v) => setEditForm((p) => ({ ...p, current_from: v }))}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1">To</Label>
                                    <PeriodSelect
                                        value={editForm.current_to}
                                        onChange={(v) => setEditForm((p) => ({ ...p, current_to: v }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">
                                Prior Interval (adjustment postings — optional)
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs mb-1">From</Label>
                                    <PeriodSelect
                                        value={editForm.prior_from}
                                        onChange={(v) =>
                                            setEditForm((p) => ({
                                                ...p,
                                                prior_from: v,
                                                prior_to: v == null ? null : (p.prior_to ?? v),
                                            }))
                                        }
                                        includeNone
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1">To</Label>
                                    <PeriodSelect
                                        value={editForm.prior_to}
                                        onChange={(v) => setEditForm((p) => ({ ...p, prior_to: v }))}
                                        includeNone
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs mb-1">
                                Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                rows={2}
                                placeholder="e.g. June 2025 AP period close"
                                value={editForm.reason || ""}
                                onChange={(e) => setEditForm((p) => ({ ...p, reason: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingArea(null)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete confirmation dialog ─────────────────────────────── */}
            <AlertDialog open={!!deletingArea} onOpenChange={(open) => { if (!open) { setDeletingArea(null); setDeleteReason(""); } }}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Period Control Row</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the period control entry for{" "}
                            <strong>{FISCAL_AREAS.find((a) => a.key === deletingArea)?.label}</strong>{" "}
                            in FY {fiscalYear}. The deletion will be recorded in the audit log. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-1 pb-2">
                        <Label className="text-xs mb-1">
                            Reason <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            rows={2}
                            placeholder="e.g. FY reset before re-initialization"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {deleteMutation.isPending ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Initialize FY dialog ───────────────────────────────────── */}
            <Dialog open={initDialog} onOpenChange={setInitDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Initialize FY {fiscalYear}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-gray-600">
                            Creates period_control rows for all 5 areas with{" "}
                            <strong>current interval Apr–Mar (1–12)</strong> and no prior interval.
                            Only missing areas are created; existing rows are not overwritten.
                        </p>
                        <div>
                            <Label className="text-xs mb-1">
                                Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                rows={2}
                                placeholder="e.g. FY 2025-26 opening"
                                value={initReason}
                                onChange={(e) => setInitReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInitDialog(false)}>Cancel</Button>
                        <Button onClick={handleInit} disabled={initMutation.isPending}>
                            {initMutation.isPending ? "Initializing…" : "Initialize"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
