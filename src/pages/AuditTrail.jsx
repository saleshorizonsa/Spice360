import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Search, RefreshCw, Shield, Plus, Edit3, Trash2, Download } from "lucide-react";
import { usePermissions } from "@/components/utils/usePermissions";

const ACTION_CONFIG = {
    create: { label: "Created", color: "bg-emerald-100 text-emerald-800", icon: Plus },
    update: { label: "Updated", color: "bg-blue-100 text-blue-800", icon: Edit3 },
    delete: { label: "Deleted", color: "bg-red-100 text-red-800", icon: Trash2 },
};

const DATE_RANGES = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "all", label: "All time" },
];

function fmtTs(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtRelative(ts) {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function DiffRow({ label, before, after }) {
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    return (
        <tr className={changed ? "bg-amber-50" : "bg-white"}>
            <td className="px-3 py-1.5 text-xs font-medium text-slate-600 w-40">{label}</td>
            <td className="px-3 py-1.5 text-xs text-red-700 font-mono max-w-[200px] truncate">
                {before != null ? JSON.stringify(before) : <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-1.5 text-xs text-emerald-700 font-mono max-w-[200px] truncate">
                {after != null ? JSON.stringify(after) : <span className="text-slate-400">—</span>}
            </td>
        </tr>
    );
}

function AuditRowDetail({ entry }) {
    const changes = entry.changes;
    const fields = entry.fields_changed || [];

    if (!changes && fields.length === 0) {
        return (
            <div className="px-6 py-3 text-sm text-slate-500 bg-slate-50">
                No field-level diff available.
            </div>
        );
    }

    return (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
            {changes ? (
                <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                                <th className="px-3 py-2 w-40">Field</th>
                                <th className="px-3 py-2">Before</th>
                                <th className="px-3 py-2">After</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fields.map((f) => (
                                <DiffRow
                                    key={f}
                                    label={f.replace(/_/g, " ")}
                                    before={changes.before?.[f]}
                                    after={changes.after?.[f]}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-xs text-slate-500">Changed fields: {fields.join(", ")}</p>
            )}
        </div>
    );
}

function AuditRow({ entry }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = ACTION_CONFIG[entry.action_type] || ACTION_CONFIG.update;
    const ActionIcon = cfg.icon;
    const hasDetail = entry.action_type === "update" && (entry.fields_changed?.length || entry.changes);
    const entityLabel = String(entry.entity_type || "").replace(/_/g, " ");

    return (
        <>
            <tr
                className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${hasDetail ? "cursor-pointer" : ""}`}
                onClick={() => hasDetail && setExpanded((v) => !v)}
            >
                <td className="px-4 py-3 w-8">
                    {hasDetail ? (
                        expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )
                    ) : null}
                </td>
                <td className="px-2 py-3 text-xs text-slate-500 whitespace-nowrap" title={fmtTs(entry.action_timestamp)}>
                    {fmtTs(entry.action_timestamp)}
                    <div className="text-slate-400 mt-0.5">{fmtRelative(entry.action_timestamp)}</div>
                </td>
                <td className="px-2 py-3">
                    <div className="text-sm font-medium text-slate-800 truncate max-w-[160px]">{entry.user_name || entry.user_email}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[160px]">{entry.user_email}</div>
                </td>
                <td className="px-2 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                        <ActionIcon className="h-3 w-3" />
                        {cfg.label}
                    </span>
                </td>
                <td className="px-2 py-3 text-sm text-slate-700 capitalize">{entityLabel}</td>
                <td className="px-2 py-3 text-xs text-slate-600 font-mono">
                    {entry.entity_id?.slice(0, 8) || "—"}
                </td>
                <td className="px-2 py-3 text-sm text-slate-600 max-w-[260px] truncate">{entry.change_summary}</td>
            </tr>
            {expanded && hasDetail && (
                <tr>
                    <td colSpan={7} className="p-0">
                        <AuditRowDetail entry={entry} />
                    </td>
                </tr>
            )}
        </>
    );
}

function exportCsv(entries) {
    const headers = ["Timestamp", "User Email", "Action", "Entity", "Record ID", "Summary"];
    const rows = entries.map((e) => [
        e.action_timestamp || e.created_at || "",
        e.user_email || "",
        e.action_type || "",
        e.entity_type || "",
        e.entity_id || "",
        (e.change_summary || "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function AuditTrail() {
    const { isAdmin } = usePermissions();
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("all");
    const [entityFilter, setEntityFilter] = useState("all");
    const [dateRange, setDateRange] = useState("30d");

    const { data: raw = [], isFetching, refetch } = useQuery({
        queryKey: ["audit-trail"],
        queryFn: () => matrixSales.entities.AuditTrail.list("-created_at", 500),
        initialData: [],
        staleTime: 60000,
    });

    const cutoff = useMemo(() => {
        const now = new Date();
        if (dateRange === "today") return new Date(now.toDateString()).getTime();
        if (dateRange === "7d") return now.getTime() - 7 * 86400000;
        if (dateRange === "30d") return now.getTime() - 30 * 86400000;
        if (dateRange === "90d") return now.getTime() - 90 * 86400000;
        return 0;
    }, [dateRange]);

    const entries = useMemo(() => {
        const q = search.trim().toLowerCase();
        return raw.filter((e) => {
            if (cutoff && new Date(e.action_timestamp || e.created_at).getTime() < cutoff) return false;
            if (actionFilter !== "all" && e.action_type !== actionFilter) return false;
            if (entityFilter !== "all" && e.entity_type !== entityFilter) return false;
            if (q) {
                const blob = `${e.user_email} ${e.user_name} ${e.entity_type} ${e.entity_id} ${e.change_summary}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [raw, cutoff, actionFilter, entityFilter, search]);

    const entityTypes = useMemo(() => {
        const types = [...new Set(raw.map((e) => e.entity_type).filter(Boolean))].sort();
        return types;
    }, [raw]);

    const stats = useMemo(() => ({
        total: entries.length,
        creates: entries.filter((e) => e.action_type === "create").length,
        updates: entries.filter((e) => e.action_type === "update").length,
        deletes: entries.filter((e) => e.action_type === "delete").length,
    }), [entries]);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-center">
                <Shield className="h-12 w-12 text-slate-300 mb-4" />
                <h2 className="text-lg font-semibold text-slate-700">Admin Access Required</h2>
                <p className="text-slate-500 text-sm mt-1">The audit trail is only visible to administrators.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 p-4 md:p-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Complete log of who created, updated, or deleted records — with before/after diffs.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => exportCsv(entries)} className="gap-1.5">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
                        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total Events", value: stats.total, color: "text-slate-800" },
                    { label: "Creates", value: stats.creates, color: "text-emerald-700" },
                    { label: "Updates", value: stats.updates, color: "text-blue-700" },
                    { label: "Deletes", value: stats.deletes, color: "text-red-700" },
                ].map((s) => (
                    <Card key={s.label} className="border-slate-200">
                        <CardContent className="p-4">
                            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card className="border-slate-200">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by user, entity, summary…"
                                className="pl-9 h-9"
                            />
                        </div>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="h-9 w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DATE_RANGES.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="h-9 w-36">
                                <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All actions</SelectItem>
                                <SelectItem value="create">Created</SelectItem>
                                <SelectItem value="update">Updated</SelectItem>
                                <SelectItem value="delete">Deleted</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="h-9 w-44">
                                <SelectValue placeholder="Entity type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All entity types</SelectItem>
                                {entityTypes.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t.replace(/_/g, " ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                <th className="px-4 py-3 w-8" />
                                <th className="px-2 py-3 w-44">Timestamp</th>
                                <th className="px-2 py-3 w-44">User</th>
                                <th className="px-2 py-3 w-24">Action</th>
                                <th className="px-2 py-3 w-36">Entity</th>
                                <th className="px-2 py-3 w-24">Record ID</th>
                                <th className="px-2 py-3">Summary</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                                        {isFetching ? "Loading audit trail…" : "No events match the current filters."}
                                    </td>
                                </tr>
                            ) : (
                                entries.map((e) => <AuditRow key={e.id || e.audit_id} entry={e} />)
                            )}
                        </tbody>
                    </table>
                </div>
                {entries.length > 0 && (
                    <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                        Showing {entries.length} of {raw.length} events
                    </div>
                )}
            </Card>
        </div>
    );
}
