import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, AlertTriangle, ReceiptText } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { postJournalEntry } from "../utils/journalService";
import {
    findUnreflectedInvoices,
    buildArRecordFromInvoice,
    buildSalesInvoiceGlLines,
    buildCogsGlLines,
} from "@/lib/arGlBackfill";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Brings finalised sales invoices fully into the books: the AR subledger record, the
 * Dr Receivables / Cr Revenue / Cr VAT journal (so AR shows in the Trial Balance and
 * Balance Sheet), and Dr COGS / Cr Inventory. Older invoices posted only some of
 * these — most commonly the AR record without the GL journal — so AR appeared on the
 * AR tab but not in the financial statements. Posts on Apply; entries already on the
 * ledger are skipped (judged from the actual posted journals), so it never double-posts.
 */
export default function ArBackfillTool() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
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
    const { data: journalEntries = [], isLoading: l3 } = useQuery({
        queryKey: ["journalEntries"],
        queryFn: () => matrixSales.entities.JournalEntry.list(),
        initialData: [],
    });

    const missing = useMemo(
        () => findUnreflectedInvoices(invoices, arRecords, journalEntries),
        [invoices, arRecords, journalEntries]
    );

    // Post whatever each invoice is missing: the AR subledger record, the
    // Dr Receivables / Cr Revenue / Cr VAT journal, and Dr COGS / Cr Inventory.
    // Idempotent — the `missing` set is computed from the actual posted journals,
    // so an invoice already carrying an entry is never touched again.
    const backfill = useMutation({
        mutationFn: async () => {
            let ar = 0, arGl = 0, cogs = 0;
            const failures = [];
            for (const row of missing) {
                const inv = row.invoice;
                try {
                    if (row.needsAr) {
                        await matrixSales.entities.AccountsReceivable.create(buildArRecordFromInvoice(inv, currentOrg?.id));
                        ar += 1;
                    }

                    if (row.needsArGl) {
                        const lines = buildSalesInvoiceGlLines(inv, gl);
                        if (lines.length) {
                            await postJournalEntry({
                                lines,
                                referenceType: "sales_invoice",
                                referenceId: inv.invoice_number,
                                description: `Sales invoice ${inv.invoice_number}`,
                                entryDate: inv.invoice_date,
                                entryType: "invoice",
                                orgId: currentOrg?.id,
                                area: "ar",
                            });
                            await matrixSales.entities.Invoice.update(inv.id, { ...inv, gl_posted: true });
                            arGl += 1;
                        }
                    }

                    if (row.needsCogs) {
                        const stock = await matrixSales.entities.StockLevel.filter({ material_code: inv.product_code });
                        const unitCost = parseFloat(stock?.[0]?.unit_cost || 0);
                        const lines = buildCogsGlLines(inv, unitCost, gl);
                        if (lines.length) {
                            await postJournalEntry({
                                lines,
                                referenceType: "sales_invoice_cogs",
                                referenceId: inv.invoice_number,
                                description: `COGS – ${inv.invoice_number} – ${inv.customer_name || ""}`,
                                entryDate: inv.invoice_date,
                                entryType: "goods_issue",
                                orgId: currentOrg?.id,
                                area: "inventory",
                            });
                            cogs += 1;
                        } else {
                            failures.push(`${inv.invoice_number}: COGS not posted — stock unit cost is zero.`);
                        }
                    }
                } catch (e) {
                    failures.push(`${inv.invoice_number}: ${e.message}`);
                }
            }
            return { ar, arGl, cogs, failures };
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries();
            setDone(res);
            toast({
                title: res.failures.length ? "Backfill partly applied" : "Invoices reflected",
                description: `${res.arGl} GL, ${res.ar} AR, ${res.cogs} COGS posted${res.failures.length ? `; ${res.failures.length} issue(s).` : "."}`,
                variant: res.failures.length ? "destructive" : "default",
            });
        },
        onError: (e) => toast({ title: "Backfill failed", description: e.message, variant: "destructive" }),
    });

    if (l1 || l2 || l3) return <div className="py-6 text-center text-sm text-gray-500">Checking invoices…</div>;

    const flag = (on, text, cls) =>
        on ? <Badge className={`border ${cls}`}>{text}</Badge> : <span className="text-gray-300">—</span>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-indigo-600" />
                    Invoice → AR &amp; GL reflection
                    {missing.length === 0
                        ? <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">Complete</Badge>
                        : <Badge className="border border-amber-300 bg-amber-100 text-amber-800">{missing.length} unposted</Badge>}
                </CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                    Finalised sales invoices missing their AR record, their <strong>Dr Receivables / Cr Revenue</strong>{" "}
                    journal (so they don't show in the Trial Balance or Balance Sheet), or their COGS. Applying posts them
                    immediately; entries already on the ledger are skipped.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {missing.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Every finalised invoice is reflected in AR and the general ledger.
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-amber-800">
                                <AlertTriangle className="mr-1 inline h-4 w-4" />
                                {missing.length} invoice(s) worth <strong>LKR {money(missing.reduce((s, m) => s + m.total_amount, 0))}</strong> are not fully in the books.
                            </p>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 shrink-0" disabled={backfill.isPending} onClick={() => backfill.mutate()}>
                                {backfill.isPending ? "Posting…" : `Post ${missing.length} invoice${missing.length === 1 ? "" : "s"}`}
                            </Button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Invoice</th>
                                        <th className="px-3 py-2 text-left font-medium">Customer</th>
                                        <th className="px-3 py-2 text-left font-medium">Date</th>
                                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                                        <th className="px-3 py-2 text-center font-medium">Missing</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {missing.map((m) => (
                                        <tr key={m.invoice_number}>
                                            <td className="px-3 py-2 font-mono text-xs">{m.invoice_number}</td>
                                            <td className="px-3 py-2 text-gray-600">{m.customer_name || "—"}</td>
                                            <td className="px-3 py-2 text-gray-600">{m.invoice_date || "—"}</td>
                                            <td className="px-3 py-2 text-right font-medium">{money(m.total_amount)}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex justify-center gap-1">
                                                    {flag(m.needsArGl, "GL", "border-indigo-300 bg-indigo-100 text-indigo-800")}
                                                    {flag(m.needsAr, "AR", "border-amber-300 bg-amber-100 text-amber-800")}
                                                    {flag(m.needsCogs, "COGS", "border-rose-300 bg-rose-100 text-rose-800")}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {done && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        Posted {done.arGl} GL journal(s), {done.ar} AR entr{done.ar === 1 ? "y" : "ies"}, {done.cogs} COGS entr{done.cogs === 1 ? "y" : "ies"}.
                        {done.failures.length > 0 && (
                            <ul className="ml-5 mt-1 list-disc text-red-700">{done.failures.map((f) => <li key={f}>{f}</li>)}</ul>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
