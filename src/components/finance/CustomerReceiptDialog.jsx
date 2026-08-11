import React, { useState } from "react";
import { openPrintWindow } from "@/lib/printWindow";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Wallet, Printer } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useActiveAccounts } from "@/hooks/useActiveAccounts";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import { buildCustomerReceiptJournal, applyReceiptToAr } from "@/lib/customerReceipt";
import CashBankMethodPicker from "./CashBankMethodPicker";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Record a receipt against an AR invoice, into a chosen cash/bank account. Partial
 * receipts allowed. Creates a numbered incoming Payment, posts Dr <chosen account> /
 * Cr Accounts Receivable, reduces the AR balance, then prints a receipt voucher.
 * Everything is dated to the receipt date's period. Mirror of VendorPaymentDialog.
 */
export default function CustomerReceiptDialog({ ar, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const gl = useGLAccounts();
  const { allAccounts = [], isLoading: accLoading } = useActiveAccounts();

  const outstanding = parseFloat(ar?.outstanding_amount) || 0;

  const [method, setMethod] = useState("cash");
  const [receiveInto, setReceiveInto] = useState("");
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : "");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(null); // saved receipt, for voucher print

  const receiveIntoName = allAccounts.find((a) => a.account_code === receiveInto)?.account_name || "Cash & Bank";

  // The received amount is free — the user enters exactly what the customer paid,
  // including an overpayment (recorded as a credit on the invoice). The only rule is
  // that it must be a positive number; it is NOT capped at the outstanding balance.
  const amt = parseFloat(amount);
  const amountValid = Number.isFinite(amt) && amt > 0;
  const isPartial = amountValid && amt < outstanding - 0.01;
  const isOverpay = amountValid && amt > outstanding + 0.01;
  const canReceive = !!receiveInto && amountValid && !!receiptDate;

  const receiptMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount) || 0;

      // Period open before anything is written.
      if (currentOrg?.id) await assertPeriodAllowed(receiptDate, currentOrg.id, "ar");

      // 1. Numbered incoming Payment (created 'cleared' + gl_posted so the generic
      //    PaymentForm flow will not re-post its own GL over this one).
      const receiptNumber = await getNextDocumentNumber("payment");
      const payment = await matrixSales.entities.Payment.create({
        payment_number: receiptNumber,
        payment_date: receiptDate,
        payment_type: "incoming",
        party_code: ar.customer_code || "",
        party_name: ar.customer_name || "",
        reference_number: ar.invoice_number,
        amount: amt,
        currency: ar.currency || "LKR",
        payment_method: method,
        pay_into_account_code: receiveInto,
        pay_into_account_name: receiveIntoName,
        status: "cleared",
        cleared_date: receiptDate,
        gl_posted: true,
        notes: notes || `Receipt for ${ar.invoice_number}`,
        organization_id: currentOrg?.id,
      });

      // 2. Dr the chosen cash/bank account / Cr Accounts Receivable.
      const { lines } = buildCustomerReceiptJournal({
        amount: amt,
        receiveIntoCode: receiveInto,
        receiveIntoName,
        gl,
        description: `${ar.invoice_number} — ${ar.customer_name || ""}`.trim(),
      });
      await postJournalEntry({
        lines,
        referenceType: "customer_payment",
        referenceId: receiptNumber,
        description: `Customer receipt ${receiptNumber} for ${ar.invoice_number}`,
        entryDate: receiptDate,
        entryType: "payment",
        orgId: currentOrg?.id,
        area: "ar",
      });

      // 3. Reduce the AR balance.
      await matrixSales.entities.AccountsReceivable.update(ar.id, applyReceiptToAr(ar, amt));

      // 4. Record the allocation, so the receipt is traceable to the invoice.
      await matrixSales.entities.PaymentAllocation.create({
        allocation_id: `ALLOC-${receiptNumber}`,
        payment_number: receiptNumber,
        ar_number: ar.ar_number,
        invoice_number: ar.invoice_number,
        customer_code: ar.customer_code,
        customer_name: ar.customer_name,
        invoice_amount: parseFloat(ar.invoice_amount) || 0,
        allocated_amount: amt,
        allocation_date: receiptDate,
        allocation_type: amt + 0.01 >= outstanding ? "full_clearing" : "partial_clearing",
        clearing_reference: receiptNumber,
        notes: `Receipt ${receiptNumber} against ${ar.invoice_number}`,
      }).catch(() => {});

      await logAuditTrail({
        entityType: "payment",
        entityId: payment.id,
        documentNumber: receiptNumber,
        actionType: "create",
        afterData: { amount: amt, reference_number: ar.invoice_number, pay_into_account_code: receiveInto },
        severity: "info",
        relatedDocumentType: "invoice",
        relatedDocumentId: ar.invoice_number,
        organizationId: currentOrg?.id,
      }).catch(() => {});

      return { ...payment, receiveIntoName };
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries();
      setDone(payment);
      toast({ title: "Receipt recorded", description: `${payment.payment_number}: LKR ${money(payment.amount)} received.` });
    },
    onError: (err) => {
      toast({ title: "Receipt failed", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
    },
  });

  const printVoucher = (payment) => {
    const org = currentOrg || {};
    openPrintWindow(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt ${payment.payment_number}</title>
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
<h1>RECEIPT VOUCHER</h1>
<div class="sub">${org.organization_name || org.trade_name || "HORIZON"} &nbsp;|&nbsp; ${payment.payment_number}</div>
<table>
<tr><td class="k">Date</td><td>${payment.payment_date}</td></tr>
<tr><td class="k">Received From (Customer)</td><td>${payment.party_name || payment.party_code || "-"}</td></tr>
<tr><td class="k">Against Invoice</td><td>${payment.reference_number}</td></tr>
<tr><td class="k">Received Into</td><td>${payment.receiveIntoName}</td></tr>
<tr><td class="k">Amount</td><td class="amt">LKR ${money(payment.amount)}</td></tr>
${payment.notes ? `<tr><td class="k">Notes</td><td>${payment.notes}</td></tr>` : ""}
</table>
<div class="sig"><div>Prepared By</div><div>Approved By</div><div>Received By</div></div>
</div></body></html>`);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            Receive Payment — Invoice {ar?.invoice_number}
          </DialogTitle>
        </DialogHeader>

        {accLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : done ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Receipt {done.payment_number} recorded.</p>
              <p className="mt-1">LKR {money(done.amount)} received from {done.party_name} into {done.receiveIntoName}.</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => printVoucher(done)}>
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
            </div>
          </div>
        ) : outstanding <= 0.01 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            This invoice is fully settled — nothing outstanding.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Customer</span><span className="font-medium">{ar.customer_name || "-"}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Outstanding</span><span className="font-bold text-emerald-700">LKR {money(outstanding)}</span></div>
            </div>

            <CashBankMethodPicker
              allAccounts={allAccounts}
              method={method}
              onMethodChange={setMethod}
              account={receiveInto}
              onAccountChange={setReceiveInto}
              label="Receive Into"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (LKR) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={outstanding > 0 ? money(outstanding) : "0.00"}
                />
                {amount !== "" && !amountValid && (
                  <p className="mt-1 text-xs text-red-600">Enter an amount greater than zero.</p>
                )}
                {isPartial && (
                  <p className="mt-1 text-xs text-amber-600">
                    Partial — LKR {money(outstanding - amt)} will remain outstanding.
                  </p>
                )}
                {isOverpay && (
                  <p className="mt-1 text-xs text-amber-600">
                    LKR {money(amt - outstanding)} over the outstanding balance — the excess is recorded as a credit on this invoice.
                  </p>
                )}
              </div>
              <div>
                <Label>Receipt Date *</Label>
                <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Cheque no. / reference (optional)" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={receiptMutation.isPending}>Cancel</Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => receiptMutation.mutate()}
                disabled={!canReceive || receiptMutation.isPending}
              >
                {receiptMutation.isPending ? "Posting…" : "Record Receipt"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
