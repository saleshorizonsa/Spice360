import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, AlertTriangle, ReceiptText } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { findInvoicesMissingAr, buildArRecordFromInvoice } from "@/lib/arFromInvoice";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Finds finalised sales invoices that have no AR entry and creates the missing ones.
 * Needed because AR used to be created only for status === 'submitted', so invoices
 * saved as 'invoiced'/'paid'/etc. never appeared in AR. Dry run until Apply.
 */
export default function ArBackfillTool() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentOrg } = useOrganization();
    const [done, setDone] = useState(null);

    const { data: invoices = [], isLoading: l1 } = useQuery({
        queryKey: ["invoices"],
        queryFn: () => matrixSales.entities.Invoice.list(),
        initialData: [],
    });
    const { data: arRecords = [], isLoading: l2 } = useQuery({
        queryKey: ["ar"],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: [],
    });

    const missing = useMemo(() => findInvoicesMissingAr(invoices, arRecords), [invoices, arRecords]);

    const backfill = useMutation({
        mutationFn: async () => {
            let ok = 0;
            const failures = [];
            for (const row of missing) {
                try {
                    const inv = invoices.find((i) => i.invoice_number === row.invoice_number);
                    await matrixSales.entities.AccountsReceivable.create(buildArRecordFromInvoice(inv, currentOrg?.id));
                    ok += 1;
                } catch (e) {
                    failures.push(`${row.invoice_number}: ${e.message}`);
                }
            }
            return { ok, failures };
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["ar"] });
            setDone(res);
            toast({
                title: res.failures.length ? "Backfill partly applied" : "AR entries created",
                description: res.failures.length ? `${res.ok} created, ${res.failures.length} failed.` : `${res.ok} AR entr${res.ok === 1 ? "y" : "ies"} created.`,
                variant: res.failures.length ? "destructive" : "default",
            });
        },
        onError: (e) => toast({ title: "Backfill failed", description: e.message, variant: "destructive" }),
    });

    if (l1 || l2) return <div className="py-6 text-center text-sm text-gray-500">Checking invoices…</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-indigo-600" />
                    AR Entries for Invoices
                    {missing.length === 0
                        ? <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">Complete</Badge>
                        : <Badge className="border border-amber-300 bg-amber-100 text-amber-800">{missing.length} missing</Badge>}
                </CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                    Finalised sales invoices that have no Accounts Receivable entry. Read-only until you apply.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {missing.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Every finalised invoice has an AR entry.
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-amber-800">
                                <AlertTriangle className="mr-1 inline h-4 w-4" />
                                {missing.length} invoice(s) worth <strong>LKR {money(missing.reduce((s, m) => s + m.total_amount, 0))}</strong> have no AR entry, so they don't show in AR or invoice clearing.
                            </p>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 shrink-0" disabled={backfill.isPending} onClick={() => backfill.mutate()}>
                                {backfill.isPending ? "Creating…" : `Create ${missing.length} AR entr${missing.length === 1 ? "y" : "ies"}`}
                            </Button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Invoice</th>
                                        <th className="px-3 py-2 text-left font-medium">Customer</th>
                                        <th className="px-3 py-2 text-left font-medium">Date</th>
                                        <th className="px-3 py-2 text-left font-medium">Status</th>
                                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {missing.map((m) => (
                                        <tr key={m.id}>
                                            <td className="px-3 py-2 font-mono text-xs">{m.invoice_number}</td>
                                            <td className="px-3 py-2 text-gray-600">{m.customer_name || "—"}</td>
                                            <td className="px-3 py-2 text-gray-600">{m.invoice_date || "—"}</td>
                                            <td className="px-3 py-2 text-gray-600">{m.status}</td>
                                            <td className="px-3 py-2 text-right font-medium">{money(m.total_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {done && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        Created {done.ok} AR entr{done.ok === 1 ? "y" : "ies"}.
                        {done.failures.length > 0 && (
                            <ul className="ml-5 mt-1 list-disc text-red-700">{done.failures.map((f) => <li key={f}>{f}</li>)}</ul>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
