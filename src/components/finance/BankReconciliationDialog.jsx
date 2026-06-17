import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, AlertTriangle, RefreshCw, Scale } from "lucide-react";

const fmt = (v) =>
    `LKR ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BankReconciliationDialog({ bank, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const today = new Date().toISOString().slice(0, 10);
    const [statementDate,    setStatementDate]    = useState(today);
    const [statementBalance, setStatementBalance] = useState("");
    const [clearing,         setClearing]         = useState({}); // paymentId → true

    // All payments for this bank account
    const { data: payments = [] } = useQuery({
        queryKey: ["payments", bank.account_number],
        queryFn:  () => matrixSales.entities.Payment.filter({ bank_account: bank.account_number }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    // Only payments on or before the statement date
    const inScope = useMemo(
        () => payments.filter((p) => p.payment_date <= statementDate && p.status !== "cancelled"),
        [payments, statementDate]
    );

    const cleared   = useMemo(() => inScope.filter((p) => p.cleared_date), [inScope]);
    const uncleared = useMemo(() => inScope.filter((p) => !p.cleared_date), [inScope]);

    // Book running balance (cleared items only = items the bank has also processed)
    const clearedNet = useMemo(() =>
        cleared.reduce((sum, p) => {
            const amt = parseFloat(p.amount) || 0;
            return sum + (p.payment_type === "incoming" ? amt : -amt);
        }, 0),
        [cleared]
    );

    // Items the user has ticked to clear in this session (not yet saved)
    const pendingClearNet = useMemo(() =>
        uncleared
            .filter((p) => clearing[p.id])
            .reduce((sum, p) => {
                const amt = parseFloat(p.amount) || 0;
                return sum + (p.payment_type === "incoming" ? amt : -amt);
            }, 0),
        [uncleared, clearing]
    );

    const adjustedBookBalance = clearedNet + pendingClearNet;
    const bankStatementBal    = parseFloat(statementBalance) || 0;
    const variance            = adjustedBookBalance - bankStatementBal;
    const isReconciled        = Math.abs(variance) < 0.005;

    const toggleClear = (id) =>
        setClearing((prev) => ({ ...prev, [id]: !prev[id] }));

    const selectAll = () => {
        const next = {};
        uncleared.forEach((p) => { next[p.id] = true; });
        setClearing(next);
    };

    const clearMutation = useMutation({
        mutationFn: async () => {
            const ids = Object.entries(clearing)
                .filter(([, v]) => v)
                .map(([id]) => id);
            if (ids.length === 0) throw new Error("No items selected to clear");
            await Promise.all(
                ids.map((id) =>
                    matrixSales.entities.Payment.update(id, { cleared_date: statementDate, status: "cleared" })
                )
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payments", bank.account_number] });
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            setClearing({});
            toast({ title: "Cleared", description: "Selected payments marked as cleared." });
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const pendingCount = Object.values(clearing).filter(Boolean).length;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scale className="w-5 h-5 text-blue-600" />
                        Bank Reconciliation — {bank.bank_name} {bank.account_number}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    {/* ── Statement inputs ─────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                        <div>
                            <Label>Statement Date</Label>
                            <Input
                                type="date"
                                value={statementDate}
                                onChange={(e) => { setStatementDate(e.target.value); setClearing({}); }}
                            />
                        </div>
                        <div>
                            <Label>Bank Statement Closing Balance (LKR)</Label>
                            <Input
                                type="number" step="0.01"
                                value={statementBalance}
                                onChange={(e) => setStatementBalance(e.target.value)}
                                placeholder="Enter balance from bank statement"
                            />
                        </div>
                    </div>

                    {/* ── Reconciliation summary ───────────────────────────── */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                            <p className="text-xs text-blue-600 font-medium">Cleared (Book)</p>
                            <p className="text-lg font-bold text-blue-800">{fmt(clearedNet)}</p>
                            <p className="text-xs text-blue-500">{cleared.length} items</p>
                        </div>
                        <div className={`border rounded-lg p-3 text-center ${isReconciled ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                            <p className={`text-xs font-medium ${isReconciled ? "text-emerald-600" : "text-amber-600"}`}>
                                Adjusted Book Balance
                            </p>
                            <p className={`text-lg font-bold ${isReconciled ? "text-emerald-800" : "text-amber-800"}`}>
                                {fmt(adjustedBookBalance)}
                            </p>
                            {pendingCount > 0 && (
                                <p className="text-xs text-amber-500">incl. {pendingCount} pending</p>
                            )}
                        </div>
                        <div className={`border rounded-lg p-3 text-center ${isReconciled ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                            <p className={`text-xs font-medium ${isReconciled ? "text-emerald-600" : "text-red-600"}`}>Variance</p>
                            <p className={`text-lg font-bold ${isReconciled ? "text-emerald-800" : "text-red-800"}`}>
                                {fmt(variance)}
                            </p>
                            {isReconciled && <p className="text-xs text-emerald-500">Reconciled</p>}
                        </div>
                    </div>

                    {isReconciled && (
                        <Alert className="border-emerald-200 bg-emerald-50">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <AlertDescription className="text-emerald-700 font-medium">
                                Book balance matches bank statement — fully reconciled.
                            </AlertDescription>
                        </Alert>
                    )}

                    {!isReconciled && statementBalance !== "" && (
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <AlertDescription className="text-amber-700 text-sm">
                                Variance of {fmt(Math.abs(variance))} — tick uncleared items that appear on the bank statement, then save.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* ── Uncleared items ──────────────────────────────────── */}
                    {uncleared.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-700">
                                    Uncleared Items ({uncleared.length})
                                </h3>
                                <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                                    Select All
                                </Button>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="w-8 p-2"></th>
                                            <th className="p-2 text-left">Payment #</th>
                                            <th className="p-2 text-left">Date</th>
                                            <th className="p-2 text-left">Party</th>
                                            <th className="p-2 text-left">Type</th>
                                            <th className="p-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {uncleared.map((p) => (
                                            <tr
                                                key={p.id}
                                                className={`border-b last:border-0 cursor-pointer hover:bg-slate-50 ${clearing[p.id] ? "bg-blue-50" : ""}`}
                                                onClick={() => toggleClear(p.id)}
                                            >
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!clearing[p.id]}
                                                        onChange={() => toggleClear(p.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="rounded"
                                                    />
                                                </td>
                                                <td className="p-2 font-mono text-xs">{p.payment_number}</td>
                                                <td className="p-2">{p.payment_date}</td>
                                                <td className="p-2">{p.party_name || "—"}</td>
                                                <td className="p-2">
                                                    <Badge className={p.payment_type === "incoming"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : "bg-orange-100 text-orange-800"}>
                                                        {p.payment_type}
                                                    </Badge>
                                                </td>
                                                <td className={`p-2 text-right font-medium ${p.payment_type === "incoming" ? "text-emerald-700" : "text-red-700"}`}>
                                                    {p.payment_type === "incoming" ? "+" : "−"}{fmt(p.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Cleared items (read-only) ─────────────────────────── */}
                    {cleared.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                Already Cleared ({cleared.length})
                            </h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-2 text-left">Payment #</th>
                                            <th className="p-2 text-left">Date</th>
                                            <th className="p-2 text-left">Cleared</th>
                                            <th className="p-2 text-left">Party</th>
                                            <th className="p-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cleared.map((p) => (
                                            <tr key={p.id} className="border-b last:border-0 text-slate-500">
                                                <td className="p-2 font-mono text-xs">{p.payment_number}</td>
                                                <td className="p-2">{p.payment_date}</td>
                                                <td className="p-2 text-emerald-600">{p.cleared_date}</td>
                                                <td className="p-2">{p.party_name || "—"}</td>
                                                <td className={`p-2 text-right font-medium ${p.payment_type === "incoming" ? "text-emerald-700" : "text-red-700"}`}>
                                                    {p.payment_type === "incoming" ? "+" : "−"}{fmt(p.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {inScope.length === 0 && (
                        <p className="text-center text-slate-400 py-6 text-sm">
                            No payments found for this account on or before {statementDate}.
                        </p>
                    )}

                    {/* ── Actions ─────────────────────────────────────────── */}
                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={pendingCount === 0 || clearMutation.isPending}
                            onClick={() => clearMutation.mutate()}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Mark {pendingCount || ""} Item{pendingCount !== 1 ? "s" : ""} Cleared
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
