import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Truck, AlertTriangle } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useActiveAccounts } from "@/hooks/useActiveAccounts";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import { isCashBankAccount } from "@/lib/vendorPayment";
import {
  outstandingFreightAccrual,
  validateFreightInvoiceAmount,
  buildFreightInvoiceJournal,
} from "@/lib/freightInvoice";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Enter the carrier's freight bill — the step that CLEARS the freight accrual.
 * Pay now from petty cash/bank (no carrier account needed), or record it as a
 * payable when the transporter is on credit terms.
 */
export default function FreightInvoiceDialog({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const gl = useGLAccounts();
  const { allAccounts = [], isLoading: accLoading } = useActiveAccounts();

  const { data: journalEntries = [], isLoading: l1 } = useQuery({
    queryKey: ["journalEntries"],
    queryFn: () => matrixSales.entities.JournalEntry.list(),
    initialData: [],
  });
  const { data: journalLines = [], isLoading: l2 } = useQuery({
    queryKey: ["journalLines"],
    queryFn: () => matrixSales.entities.JournalLine.list(),
    initialData: [],
  });

  const outstanding = useMemo(
    () => outstandingFreightAccrual({ journalEntries, journalLines, freightAccrualCode: gl.freight_accrual }),
    [journalEntries, journalLines, gl.freight_accrual]
  );

  const cashOptions = useMemo(
    () => allAccounts.filter(isCashBankAccount).map((a) => ({
      value: a.account_code,
      label: `${a.account_code} — ${a.account_name}`,
    })),
    [allAccounts]
  );

  const [mode, setMode] = useState("pay_now");
  const [carrier, setCarrier] = useState("");
  const [reference, setReference] = useState("");
  const [cashCode, setCashCode] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);

  React.useEffect(() => {
    if (!l1 && !l2 && outstanding > 0 && amount === "") setAmount(String(outstanding));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l1, l2, outstanding]);

  const cashName = allAccounts.find((a) => a.account_code === cashCode)?.account_name || "Cash / Bank";
  const check = validateFreightInvoiceAmount(amount, outstanding);

  const plan = useMemo(
    () => buildFreightInvoiceJournal({
      amount, mode,
      freightAccrualCode: gl.freight_accrual,
      payablesCode: gl.trade_payables,
      cashCode, cashName,
      carrierName: carrier,
      description: `Freight invoice${carrier ? ` — ${carrier}` : ""}${reference ? ` (${reference})` : ""}`,
    }),
    [amount, mode, gl.freight_accrual, gl.trade_payables, cashCode, cashName, carrier, reference]
  );

  const canPost = check.ok && plan.isBalanced && (mode === "payable" || !!cashCode) && !!carrier.trim();

  const postMutation = useMutation({
    mutationFn: async () => {
      if (currentOrg?.id) await assertPeriodAllowed(entryDate, currentOrg.id, "ap");

      const je = await postJournalEntry({
        lines: plan.lines,
        referenceType: "freight_invoice",
        referenceId: reference || carrier,
        description: `Freight invoice${carrier ? ` — ${carrier}` : ""}${reference ? ` (${reference})` : ""}`,
        entryDate,
        entryType: "invoice",
        orgId: currentOrg?.id,
        area: "ap",
      });

      // On credit terms, also raise the payable so it appears in Finance → AP and
      // can be settled by the existing payment flow.
      if (mode === "payable") {
        await matrixSales.entities.AccountsPayable.create({
          ap_number: `AP-FRT-${reference || je?.journal_number}`,
          vendor_invoice_number: reference || je?.journal_number,
          vendor_code: "",
          vendor_name: carrier,
          invoice_date: entryDate,
          due_date: "",
          invoice_amount: plan.amount,
          paid_amount: 0,
          outstanding_amount: plan.amount,
          currency: "LKR",
          payment_terms: "net_30",
          aging_days: 0,
          aging_bucket: "current",
          payment_status: "pending",
          notes: `Inbound freight — ${carrier}`,
          organization_id: currentOrg?.id,
        }).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["ap"] });
      }

      await logAuditTrail({
        entityType: "journal_entry",
        entityId: je?.id,
        documentNumber: je?.journal_number,
        actionType: "freight_invoice",
        afterData: { carrier, amount: plan.amount, mode, reference },
        severity: "info",
        organizationId: currentOrg?.id,
      }).catch(() => {});

      return je;
    },
    onSuccess: (je) => {
      queryClient.invalidateQueries();
      toast({
        title: "Freight invoice posted",
        description: mode === "pay_now"
          ? `LKR ${money(plan.amount)} paid from ${cashName} (${je?.journal_number}).`
          : `LKR ${money(plan.amount)} owed to ${carrier} — settle it in Finance → AP (${je?.journal_number}).`,
      });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Could not post", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
    },
  });

  const loading = accLoading || l1 || l2;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Freight Invoice (carrier bill)
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : outstanding <= 0.01 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            No freight is currently accrued — there is nothing to clear. Freight accrues when you enter a vendor
            invoice with a freight amount.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Freight accrued and unbilled ({gl.freight_accrual})</span>
                <span className="font-bold text-indigo-700">LKR {money(outstanding)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Carrier / Transporter *</Label>
                <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. Local lorry hire" />
              </div>
              <div>
                <Label>Their invoice / reference</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div>
              <Label>How is it settled? *</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "pay_now" ? "default" : "outline"}
                  className={mode === "pay_now" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  onClick={() => setMode("pay_now")}
                >
                  Paid now (cash)
                </Button>
                <Button
                  type="button"
                  variant={mode === "payable" ? "default" : "outline"}
                  className={mode === "payable" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  onClick={() => setMode("payable")}
                >
                  On credit (payable)
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {mode === "pay_now"
                  ? "Clears the accrual straight to the cash account below — no vendor needed."
                  : "Raises a payable to the transporter; settle it later from Finance → AP."}
              </p>
            </div>

            {mode === "pay_now" && (
              <SearchableSelect
                label="Paid from *"
                mode="client"
                value={cashCode}
                onChange={setCashCode}
                options={cashOptions}
                placeholder="Select petty cash or a bank account…"
                searchPlaceholder="Search cash/bank accounts…"
                emptyText="No cash/bank accounts in the chart."
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (LKR) *</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {amount !== "" && !check.ok && <p className="mt-1 text-xs text-red-600">{check.error}</p>}
                {check.ok && parseFloat(amount) < outstanding && (
                  <p className="mt-1 text-xs text-amber-600">
                    Partial — LKR {money(outstanding - parseFloat(amount))} stays accrued.
                  </p>
                )}
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
            </div>

            {plan.lines.length > 0 && (
              <div className="overflow-hidden rounded-lg border text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Account</th>
                      <th className="px-3 py-2 text-right font-medium">Debit</th>
                      <th className="px-3 py-2 text-right font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs">{l.account_code} — {l.account_name}</td>
                        <td className="px-3 py-2 text-right">{l.debit ? money(l.debit) : ""}</td>
                        <td className="px-3 py-2 text-right">{l.credit ? money(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This posts a real journal entry. The freight cost is already in your product cost — this only settles
              what you owe for it.
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={postMutation.isPending}>Cancel</Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => postMutation.mutate()}
                disabled={!canPost || postMutation.isPending}
              >
                {postMutation.isPending ? "Posting…" : `Post LKR ${money(plan.amount)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
