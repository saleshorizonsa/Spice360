import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Globe, Pencil, Trash2, X, Check } from "lucide-react";

const COMMON_CURRENCIES = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "INR", name: "Indian Rupee" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "AED", name: "UAE Dirham" },
    { code: "SGD", name: "Singapore Dollar" },
    { code: "AUD", name: "Australian Dollar" },
];

const today = () => new Date().toISOString().slice(0, 10);

const BLANK = {
    currency_code: "",
    currency_name: "",
    buy_rate: "",
    sell_rate: "",
    effective_date: today(),
    source: "Manual",
};

function fmt(v) {
    return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function useFXRate(currencyCode, asOfDate) {
    const { data: rates = [] } = useQuery({
        queryKey: ["fxRates"],
        queryFn: () => matrixSales.entities.ExchangeRate.list("-effective_date"),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    return useMemo(() => {
        if (!currencyCode || currencyCode === "LKR") return 1;
        const date = asOfDate || today();
        const match = rates
            .filter((r) => r.currency_code === currencyCode && r.effective_date <= date)
            .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
        if (!match) return null;
        const mid = (parseFloat(match.buy_rate) + parseFloat(match.sell_rate)) / 2;
        return mid || null;
    }, [rates, currencyCode, asOfDate]);
}

export default function FXRateManager() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(BLANK);

    const { data: rates = [] } = useQuery({
        queryKey: ["fxRates"],
        queryFn: () => matrixSales.entities.ExchangeRate.list("-effective_date"),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const grouped = useMemo(() => {
        const map = new Map();
        rates.forEach((r) => {
            if (!map.has(r.currency_code)) map.set(r.currency_code, []);
            map.get(r.currency_code).push(r);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [rates]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const payload = {
                ...data,
                buy_rate:  parseFloat(data.buy_rate)  || 0,
                sell_rate: parseFloat(data.sell_rate) || 0,
            };
            if (editingId) {
                return matrixSales.entities.ExchangeRate.update(editingId, payload);
            }
            return matrixSales.entities.ExchangeRate.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fxRates"] });
            setShowForm(false);
            setEditingId(null);
            setForm(BLANK);
            toast({ title: editingId ? "Rate updated" : "Rate added" });
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.ExchangeRate.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fxRates"] });
            toast({ title: "Rate deleted" });
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const startEdit = (r) => {
        setEditingId(r.id);
        setForm({
            currency_code:  r.currency_code,
            currency_name:  r.currency_name || "",
            buy_rate:       r.buy_rate,
            sell_rate:      r.sell_rate,
            effective_date: r.effective_date,
            source:         r.source || "Manual",
        });
        setShowForm(true);
    };

    const handleCurrencyCodeChange = (code) => {
        const known = COMMON_CURRENCIES.find((c) => c.code === code.toUpperCase());
        setForm((f) => ({
            ...f,
            currency_code: code.toUpperCase(),
            currency_name: known ? known.name : f.currency_name,
        }));
    };

    const mid = (buy, sell) => {
        const b = parseFloat(buy) || 0;
        const s = parseFloat(sell) || 0;
        return b > 0 && s > 0 ? ((b + s) / 2).toFixed(4) : "—";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Maintain daily exchange rates. The mid-rate (average of buy/sell) is used for LKR conversion on
                    foreign-currency invoices and payments.
                </p>
                <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => { setEditingId(null); setForm(BLANK); setShowForm(true); }}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rate
                </Button>
            </div>

            {/* ── Inline form ────────────────────────────────────────── */}
            {showForm && (
                <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                    <p className="font-semibold text-sm text-gray-700">
                        {editingId ? "Edit Exchange Rate" : "New Exchange Rate"}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <Label>Currency Code</Label>
                            <div className="flex gap-2 mt-1">
                                <Input
                                    value={form.currency_code}
                                    maxLength={3}
                                    className="w-20 font-mono uppercase"
                                    placeholder="USD"
                                    onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                />
                                <select
                                    className="flex-1 border rounded-md text-sm px-2 bg-white"
                                    value={form.currency_code}
                                    onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                >
                                    <option value="">— select —</option>
                                    {COMMON_CURRENCIES.map((c) => (
                                        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <Label>Currency Name</Label>
                            <Input
                                className="mt-1"
                                value={form.currency_name}
                                placeholder="US Dollar"
                                onChange={(e) => setForm((f) => ({ ...f, currency_name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Effective Date</Label>
                            <Input
                                type="date"
                                className="mt-1"
                                value={form.effective_date}
                                onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Bank Buy Rate (LKR per 1 FCY)</Label>
                            <Input
                                type="number" step="0.0001" min="0"
                                className="mt-1"
                                value={form.buy_rate}
                                placeholder="325.0000"
                                onChange={(e) => setForm((f) => ({ ...f, buy_rate: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Bank Sell Rate (LKR per 1 FCY)</Label>
                            <Input
                                type="number" step="0.0001" min="0"
                                className="mt-1"
                                value={form.sell_rate}
                                placeholder="328.0000"
                                onChange={(e) => setForm((f) => ({ ...f, sell_rate: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Mid Rate (calculated)</Label>
                            <div className="mt-1 h-9 flex items-center px-3 rounded-md border bg-white text-sm font-mono text-emerald-700 font-semibold">
                                LKR {mid(form.buy_rate, form.sell_rate)}
                            </div>
                        </div>
                        <div>
                            <Label>Source</Label>
                            <select
                                className="mt-1 w-full border rounded-md text-sm px-3 py-2 bg-white"
                                value={form.source}
                                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                            >
                                <option value="Manual">Manual</option>
                                <option value="Central Bank">Central Bank</option>
                                <option value="Commercial Bank">Commercial Bank</option>
                                <option value="Reuters">Reuters</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                        <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>
                            <X className="w-4 h-4 mr-1" />Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={!form.currency_code || !form.buy_rate || !form.sell_rate || saveMutation.isPending}
                            onClick={() => saveMutation.mutate(form)}
                        >
                            <Check className="w-4 h-4 mr-1" />Save Rate
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Rate table ─────────────────────────────────────────── */}
            {rates.length === 0 && !showForm ? (
                <div className="text-center py-10 text-gray-400 text-sm border rounded-lg">
                    <Globe className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    No exchange rates yet. Click "Add Rate" to enter your first rate.
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Currency</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Effective Date</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Buy (LKR)</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Sell (LKR)</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Mid (LKR)</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Source</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {grouped.map(([code, cRates]) => {
                                const latest = cRates[0];
                                return cRates.map((r, idx) => (
                                    <tr key={r.id} className={`hover:bg-slate-50 ${idx === 0 ? "" : "text-slate-400"}`}>
                                        {idx === 0 && (
                                            <td className="px-4 py-2 font-semibold" rowSpan={cRates.length}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-emerald-700">{code}</span>
                                                    <span className="text-gray-500 text-xs">{latest.currency_name}</span>
                                                    {idx === 0 && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Latest</Badge>}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-4 py-2">{r.effective_date}</td>
                                        <td className="px-4 py-2 text-right font-mono">{fmt(r.buy_rate)}</td>
                                        <td className="px-4 py-2 text-right font-mono">{fmt(r.sell_rate)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-emerald-700 font-semibold">
                                            {fmt((parseFloat(r.buy_rate) + parseFloat(r.sell_rate)) / 2)}
                                        </td>
                                        <td className="px-4 py-2 text-gray-500">{r.source || "—"}</td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                size="sm" variant="ghost"
                                                className="text-red-500 hover:text-red-700"
                                                onClick={() => {
                                                    if (confirm(`Delete ${code} rate for ${r.effective_date}?`)) {
                                                        deleteMutation.mutate(r.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                ));
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
