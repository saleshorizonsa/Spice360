import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { postJournalEntry } from "../utils/journalService";

const TARGET_AR = "AR-INV-ALL-26-000002";
const TARGET_RECEIPT_ACCOUNT = "1011";

const amountOf = (value) => Number.parseFloat(value) || 0;

export default function ArReceiptGlRepairTool() {
    const { currentOrg } = useOrganization();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const gl = useGLAccounts();
    const [arNumber, setArNumber] = useState(TARGET_AR);
    const [result, setResult] = useState(null);

    const { data: arRecords = [], isLoading: arLoading } = useQuery({
        queryKey: ["ar-receipt-repair-ar"],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: [],
    });
    const { data: payments = [], isLoading: paymentsLoading } = useQuery({
        queryKey: ["ar-receipt-repair-payments"],
        queryFn: () => matrixSales.entities.Payment.list(),
        initialData: [],
    });
    const { data: allocations = [], isLoading: allocationsLoading } = useQuery({
        queryKey: ["ar-receipt-repair-allocations"],
        queryFn: () => matrixSales.entities.PaymentAllocation.list(),
        initialData: [],
    });
    const { data: journalEntries = [], isLoading: entriesLoading } = useQuery({
        queryKey: ["ar-receipt-repair-journal-entries"],
        queryFn: () => matrixSales.entities.JournalEntry.list(),
        initialData: [],
    });
    const { data: journalLines = [], isLoading: linesLoading } = useQuery({
        queryKey: ["ar-receipt-repair-journal-lines"],
        queryFn: () => matrixSales.entities.JournalLine.list(),
        initialData: [],
    });

    const target = useMemo(() => {
        const normalized = arNumber.trim().toLowerCase();
        const ar = arRecords.find((record) => String(record.ar_number || "").toLowerCase() === normalized);
        if (!ar) return { ar: null, receipts: [] };
        const allocationPaymentNumbers = new Set(
            allocations
                .filter((allocation) => allocation.ar_number === ar.ar_number || allocation.invoice_number === ar.invoice_number)
                .map((allocation) => allocation.payment_number)
                .filter(Boolean)
        );
        const receipts = payments
            .filter((payment) => payment.payment_type === "incoming")
            .filter((payment) => ["cleared", "posted", "completed"].includes(String(payment.status || "").toLowerCase()))
            .filter((payment) =>
                payment.reference_number === ar.invoice_number ||
                payment.reference_number === ar.ar_number ||
                allocationPaymentNumbers.has(payment.payment_number)
            )
            .map((payment) => {
                const entry = journalEntries.find((journal) =>
                    journal.reference_type === "customer_payment" && journal.reference_id === payment.payment_number
                );
                const lines = entry
                    ? journalLines.filter((line) => line.journal_number === entry.journal_number)
                    : [];
                return { payment, entry, lines };
            });
        return { ar, receipts };
    }, [arNumber, arRecords, payments, allocations, journalEntries, journalLines]);

    const repair = useMutation({
        mutationFn: async () => {
            if (!currentOrg?.id) throw new Error("Select an organization before repairing the receipt.");
            if (!target.ar) throw new Error(`AR record ${arNumber.trim()} was not found.`);
            if (target.receipts.length === 0) throw new Error(`No cleared incoming receipt was found for ${target.ar.invoice_number}.`);

            const changes = [];
            for (const { payment, entry, lines } of target.receipts) {
                const amount = amountOf(payment.amount);
                if (amount <= 0) continue;

                const arCredit = lines.find((line) => line.account_code === gl.ar_receivables && amountOf(line.credit) > 0);
                const cashDebit = lines.find((line) => amountOf(line.debit) > 0 && line.account_code !== gl.ar_receivables);

                if (entry && arCredit && cashDebit) {
                    if (cashDebit.account_code === TARGET_RECEIPT_ACCOUNT) {
                        changes.push(`${payment.payment_number}: already posted to ${TARGET_RECEIPT_ACCOUNT}`);
                        continue;
                    }
                    await postJournalEntry({
                        lines: [
                            { account_code: TARGET_RECEIPT_ACCOUNT, account_name: "Petty Cash - Priyantha", debit: amount, credit: 0 },
                            { account_code: cashDebit.account_code, account_name: cashDebit.account_name || "Cash / Bank", debit: 0, credit: amount },
                        ],
                        referenceType: "customer_payment_reclass",
                        referenceId: payment.payment_number,
                        description: `Reclassify receipt ${payment.payment_number} to petty cash ${TARGET_RECEIPT_ACCOUNT}`,
                        entryDate: payment.payment_date,
                        entryType: "reclassification",
                        orgId: currentOrg.id,
                        area: "ar",
                    });
                    changes.push(`${payment.payment_number}: reclassified ${cashDebit.account_code} to ${TARGET_RECEIPT_ACCOUNT}`);
                    continue;
                }

                if (entry) {
                    changes.push(`${payment.payment_number}: journal exists but needs manual review`);
                    continue;
                }

                await postJournalEntry({
                    lines: [
                        { account_code: TARGET_RECEIPT_ACCOUNT, account_name: "Petty Cash - Priyantha", debit: amount, credit: 0 },
                        { account_code: gl.ar_receivables, account_name: "Trade Receivables", debit: 0, credit: amount },
                    ],
                    referenceType: "customer_payment",
                    referenceId: payment.payment_number,
                    description: `Customer receipt ${payment.payment_number}`,
                    entryDate: payment.payment_date,
                    entryType: "payment",
                    orgId: currentOrg.id,
                    area: "ar",
                });
                await matrixSales.entities.Payment.update(payment.id, { ...payment, gl_posted: true });
                changes.push(`${payment.payment_number}: posted ${TARGET_RECEIPT_ACCOUNT} / ${gl.ar_receivables}`);
            }
            return changes;
        },
        onSuccess: (changes) => {
            queryClient.invalidateQueries();
            setResult(changes);
            toast({ title: "AR receipt GL checked", description: changes.join("; ") || "No changes required." });
        },
        onError: (error) => toast({ title: "AR receipt repair failed", description: error.message, variant: "destructive" }),
    });

    const loading = arLoading || paymentsLoading || allocationsLoading || entriesLoading || linesLoading;
    const targetStatus = target.ar ? `${target.receipts.length} cleared receipt(s) found` : "AR record not found";

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-amber-600" />
                    AR receipt GL repair
                    <Badge className="border border-amber-300 bg-amber-100 text-amber-800">One-time repair</Badge>
                </CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                    Checks the receipt for an AR invoice and ensures the ledger has a debit to petty cash {TARGET_RECEIPT_ACCOUNT} and a credit to Trade Receivables. Existing correct entries are skipped.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                    <div className="max-w-md flex-1">
                        <Label>AR Number</Label>
                        <Input value={arNumber} onChange={(event) => setArNumber(event.target.value)} />
                    </div>
                    <Button disabled={loading || repair.isPending} onClick={() => repair.mutate()} className="gap-2 bg-amber-600 hover:bg-amber-700">
                        <Wrench className="h-4 w-4" />
                        {repair.isPending ? "Repairing…" : "Check / Repair GL"}
                    </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    {target.ar && target.receipts.length > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {targetStatus}
                </div>
                {result && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{result.join("; ") || "No changes required."}</div>}
            </CardContent>
        </Card>
    );
}