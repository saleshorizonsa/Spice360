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
import { Calendar, Edit2, Plus, RefreshCw } from "lucide-react";

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

function IntervalCell({ from, to }) {
    if (from == null) return <span className="text-gray-400 text-xs">—</span>;
    return (
        <span className="text-xs font-mono">
            {fiscalPeriodLabel(from)}
            {from !== to ? ` – ${fiscalPeriodLabel(to)}` : ""}
        </span>
    );
}

export default function PeriodControlOB52() {
    const { currentOrg } = useOrganization();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const orgId = currentOrg?.id;

    const fyOptions = useMemo(() => fiscalYearOptions(null), []);
    const [fiscalYear, setFiscalYear] = useState(() => currentFiscalYear());
    const [editingArea, setEditingArea] = useState(null); // { area, ctrl (may be null) }
    const [editForm, setEditForm] = useState({});
    const [initDialog, setInitDialog] = useState(false);
    const [initReason, setInitReason] = useState("");

    // ── fetch period_control rows for this org + FY ──────────────────────
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

    // ── fetch audit log for this org + FY ───────────────────────────────
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

    // ── upsert + log mutation ─────────────────────────────────────────────
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["periodControl", orgId, fiscalYear] });
            queryClient.invalidateQueries({ queryKey: ["periodControlLog", orgId, fiscalYear] });
            toast({ title: "Period control updated" });
            setEditingArea(null);
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    // ── initialize FY (create default rows for all 5 areas) ──────────────
    const initMutation = useMutation({
        mutationFn: async ({ reason, userEmail }) => {
            const ops = FISCAL_AREAS.map(({ key }) => {
                if (controlMap[key]) return Promise.resolve(); // skip if exists
                return matrixSales.entities.PeriodControl.create({
                    organization_id: orgId,
                    fiscal_year: fiscalYear,
                    area: key,
                    current_from: 1,
                    current_to: 12,
                    prior_from: null,
                    prior_to: null,
                    updated_by: userEmail,
                });
            });
            await Promise.all(ops);
            const logOps = FISCAL_AREAS.filter(({ key }) => !controlMap[key]).map(({ key }) =>
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
            );
            await Promise.all(logOps);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["periodControl", orgId, fiscalYear] });
            queryClient.invalidateQueries({ queryKey: ["periodControlLog", orgId, fiscalYear] });
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

    const allInitialized = FISCAL_AREAS.every(({ key }) => !!controlMap[key]);

    return (
        <div className="space-y-6">
            {/* ── Header row ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-600" />
                        Period Control — OB52
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        April-March fiscal year · Periods 1 (Apr) – 12 (Mar) · Special 13–16
                    </p>
                </div>
                <div className="flex items-center gap-3">
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
                        variant="ghost"
                        size="icon"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["periodControl", orgId, fiscalYear] })}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* ── OB52 grid ──────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Open Periods — FY {fiscalYear}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
                                    <th className="px-4 py-2.5 text-left font-semibold">Area</th>
                                    <th className="px-4 py-2.5 text-center font-semibold" colSpan={2}>Current Interval</th>
                                    <th className="px-4 py-2.5 text-center font-semibold" colSpan={2}>Prior Interval</th>
                                    <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                                    <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                                </tr>
                                <tr className="border-b bg-slate-50/50 text-xs text-slate-400">
                                    <th />
                                    <th className="px-4 py-1 text-center">From</th>
                                    <th className="px-4 py-1 text-center">To</th>
                                    <th className="px-4 py-1 text-center">From</th>
                                    <th className="px-4 py-1 text-center">To</th>
                                    <th />
                                    <th />
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
                                                {ctrl ? (
                                                    <span className="text-xs">
                                                        {ctrl.current_from != null ? fiscalPeriodLabel(ctrl.current_from) : "—"}
                                                    </span>
                                                ) : <span className="text-gray-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {ctrl ? (
                                                    <span className="text-xs">
                                                        {ctrl.current_to != null ? fiscalPeriodLabel(ctrl.current_to) : "—"}
                                                    </span>
                                                ) : <span className="text-gray-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <IntervalCell from={ctrl?.prior_from} to={ctrl?.prior_to} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <IntervalCell from={ctrl?.prior_from} to={ctrl?.prior_to} />
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
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit(key)}
                                                    className="gap-1.5 text-xs"
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* ── Audit log ──────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
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
                                                    className={`text-xs ${entry.action === "open"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-orange-100 text-orange-800"
                                                    }`}
                                                >
                                                    {entry.action}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                <IntervalCell from={entry.prev_from} to={entry.prev_to} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <IntervalCell from={entry.new_from} to={entry.new_to} />
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
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            Only missing areas are created (existing rows are not overwritten).
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
                            Initialize
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
