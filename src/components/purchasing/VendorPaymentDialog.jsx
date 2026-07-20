import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Wallet, Printer } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useActiveAccounts } from "@/hooks/useActiveAccounts";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import {
    isCashBankAccount,
    validatePaymentAmount,
    buildVendorPaymentJournal,
} from "@/lib/vendorPayment";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Record a payment against an approved vendor invoice, from a chosen cash/bank
 * account. Partial payments allowed. Creates a numbered Payment, posts
 * Dr Trade Payables / Cr <chosen account>, reduces the AP balance and the invoice,
 * then prints a voucher. Everything is dated to the payment date's period.
 */
export default function VendorPaymentDialog({ invoice, onClose }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
    const { allAccounts = [], isLoading: accLoading } = useActiveAccounts();

    // The AP record is authoritative for what is owed the vendor — it already
    // excludes freight that was split to a separate carrier liability.
    const { data: apRecords = [], isLoading: apLoading } = useQuery({
        queryKey: ["ap", invoice?.vendor_invoice_number],
        queryFn: () => matrixSales.entities.AccountsPayable.filter({ vendor_invoice_number: invoice.vendor_invoice_number }),
        initialData: [],
    });
    const ap = apRecords[0];
    const outstanding = ap
        ? parseFloat(ap.outstanding_amount) || 0
        : (parseFloat(invoice?.total_amount) || 0);

    const cashBankOptions = useMemo(
        () => allAccounts.filter(isCashBankAccount).map((a) => ({
            value: a.account_code,
            label: `${a.account_code} — ${a.account_name}`,
        })),
        [allAccounts]
    );

    const [payFrom, setPayFrom] = useState("");
    const [amount, setAmount] = useState("");
    const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [done, setDone] = useState(null); // the saved payment, for voucher print

    // Default the amount to the outstanding balance once it loads.
    React.useEffect(() => {
        if (!apLoading && outstanding > 0 && amount === "") setAmount(String(outstanding));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apLoading, outstanding]);

    const payFromName = allAccounts.find((a) => a.account_code === payFrom)?.account_name || "Cash & Bank";
    const amountCheck = validatePaymentAmount(amount, outstanding);
    const canPay = !!payFrom && amountCheck.ok && !!payDate;

    const payMutation = useMutation({
        mutationFn: async () => {
            const amt = parseFloat(amount) || 0;

            // Period open before anything is written.
            if (currentOrg?.id) await assertPeriodAllowed(payDate, currentOrg.id, "ap");

            // 1. Numbered Payment record (created 'cleared' so the generic PaymentForm
            //    flow will not re-post its own GL over this one).
            const paymentNumber = await getNextDocumentNumber("payment");
            const payment = await matrixSales.entities.Payment.create({
                payment_number: paymentNumber,
                payment_date: payDate,
                payment_type: "outgoing",
                party_code: invoice.vendor_code || "",
                party_name: invoice.vendor_name || "",
                reference_number: invoice.vendor_invoice_number,
                amount: amt,
                currency: invoice.currency || "LKR",
                payment_method: "bank_transfer",
                pay_from_account_code: payFrom,
                pay_from_account_name: payFromName,
                status: "cleared",
                gl_posted: true,
                notes: notes || `Payment for ${invoice.vendor_invoice_number}`,
                organization_id: currentOrg?.id,
            });

            // 2. Dr Trade Payables / Cr the chosen cash/bank account.
            const { lines } = buildVendorPaymentJournal({
                amount: amt,
                payFromCode: payFrom,
                payFromName,
                gl,
                description: `${invoice.vendor_invoice_number} — ${invoice.vendor_name || ""}`.trim(),
            });
            await postJournalEntry({
                lines,
                referenceType: "vendor_payment",
                referenceId: paymentNumber,
                description: `Vendor payment ${paymentNumber} for ${invoice.vendor_invoice_number}`,
                entryDate: payDate,
                entryType: "payment",
                orgId: currentOrg?.id,
                area: "ap",
            });

            // 3. Reduce the AP balance.
            if (ap) {
                const newPaid = (parseFloat(ap.paid_amount) || 0) + amt;
                const newOutstanding = Math.max(0, (parseFloat(ap.outstanding_amount) || 0) - amt);
                await matrixSales.entities.AccountsPayable.update(ap.id, {
                    paid_amount: newPaid,
                    outstanding_amount: newOutstanding,
                    payment_status: newOutstanding <= 0.01 ? "paid" : "partial",
                });
            }

            // 4. Reflect on the invoice.
            const invPaid = (parseFloat(invoice.amount_paid) || 0) + amt;
            const fullyPaid = invPaid + 0.01 >= outstanding + (parseFloat(invoice.amount_paid) || 0);
            await matrixSales.entities.VendorInvoice.update(invoice.id, {
                ...invoice,
                amount_paid: invPaid,
                payment_status: fullyPaid ? "paid" : "partially_paid",
                ...(fullyPaid ? { status: "paid" } : {}),
            });

            await logAuditTrail({
                entityType: "payment",
                entityId: payment.id,
                documentNumber: paymentNumber,
                actionType: "create",
                afterData: { amount: amt, reference_number: invoice.vendor_invoice_number, pay_from_account_code: payFrom },
                user: null,
                severity: "info",
                relatedDocumentType: "vendor_invoice",
                relatedDocumentId: invoice.vendor_invoice_number,
                organizationId: currentOrg?.id,
            });

            return { ...payment, payFromName };
        },
        onSuccess: (payment) => {
            queryClient.invalidateQueries();
            setDone(payment);
            toast({ title: "Payment recorded", description: `${payment.payment_number}: LKR ${money(payment.amount)} paid.` });
        },
        onError: (err) => {
            toast({ title: "Payment failed", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
        },
    });

    const printVoucher = (payment) => {
        const org = currentOrg || {};
        const w = window.open("", "_blank");
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Payment Voucher ${payment.payment_number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
.p{max-width:720px;margin:0 auto;padding:40px;color:#1e293b}
h1{font-size:22px;color:#24466f;border-bottom:3px solid #24466f;padding-bottom:12px;margin-bottom:6px}
.sub{font-size:12px;color:#64748b;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin:18px 0}
td{padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:13px}
td.k{color:#64748b;width:38%}
.amt{font-size:20px;font-weight:700;color:#24466f}
.sig{display:flex;justify-content:space-between;margin-top:60px;font-size:12px;color:#475569}
.sig div{border-top:1px solid #94a3b8;padding-top:6px;width:40%;text-align:center}
@media print{@page{margin:14mm}}
</style></head><body><div class="p">
<h1>PAYMENT VOUCHER</h1>
<div class="sub">${org.organization_name || org.trade_name || "HORIZON"} &nbsp;|&nbsp; ${payment.payment_number}</div>
<table>
<tr><td class="k">Date</td><td>${payment.payment_date}</td></tr>
<tr><td class="k">Paid To (Vendor)</td><td>${payment.party_name || payment.party_code || "-"}</td></tr>
<tr><td class="k">Against Invoice</td><td>${payment.reference_number}</td></tr>
<tr><td class="k">Paid From</td><td>${payment.payFromName}</td></tr>
<tr><td class="k">Amount</td><td class="amt">LKR ${money(payment.amount)}</td></tr>
${payment.notes ? `<tr><td class="k">Notes</td><td>${payment.notes}</td></tr>` : ""}
</table>
<div class="sig"><div>Prepared By</div><div>Approved By</div><div>Received By</div></div>
</div><script>window.onload=()=>window.print()<\/script></body></html>`);
        w.document.close();
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-emerald-600" />
                        Pay Vendor Invoice {invoice?.vendor_invoice_number}
                    </DialogTitle>
                </DialogHeader>

                {accLoading || apLoading ? (
                    <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
                ) : done ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                            <p className="font-semibold">Payment {done.payment_number} recorded.</p>
                            <p className="mt-1">LKR {money(done.amount)} paid to {done.party_name} from {done.payFromName}.</p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => printVoucher(done)}>
                                <Printer className="w-4 h-4" /> Print Voucher
                            </Button>
                        </div>
                    </div>
                ) : outstanding <= 0.01 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        This invoice is fully paid — nothing outstanding.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Vendor</span><span className="font-medium">{invoice.vendor_name || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Outstanding</span><span className="font-bold text-emerald-700">LKR {money(outstanding)}</span></div>
                        </div>

                        <div>
                            <SearchableSelect
                                label="Pay From (Cash / Bank) *"
                                mode="client"
                                value={payFrom}
                                onChange={setPayFrom}
                                options={cashBankOptions}
                                placeholder="Select petty cash or a bank account…"
                                searchPlaceholder="Search cash/bank accounts…"
                                emptyText="No cash/bank accounts in the chart. Add one under Admin → Chart of Accounts."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Amount (LKR) *</Label>
                                <Input
                                    type="number" step="0.01" min="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                {amount !== "" && !amountCheck.ok && (
                                    <p className="mt-1 text-xs text-red-600">{amountCheck.error}</p>
                                )}
                                {parseFloat(amount) > 0 && parseFloat(amount) < outstanding && amountCheck.ok && (
                                    <p className="mt-1 text-xs text-amber-600">
                                        Partial — LKR {money(outstanding - parseFloat(amount))} will remain outstanding.
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Payment Date *</Label>
                                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <Label>Notes</Label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Cheque no. / reference (optional)" />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={onClose} disabled={payMutation.isPending}>Cancel</Button>
                            <Button
                                type="button"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => payMutation.mutate()}
                                disabled={!canPay || payMutation.isPending}
                            >
                                {payMutation.isPending ? "Posting…" : "Record Payment"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
