import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Truck } from "lucide-react";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useActiveAccounts } from "@/hooks/useActiveAccounts";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import { useOrganization } from "../utils/OrganizationContext";
import { buildFreightToCogsJournal } from "@/lib/freightToCogs";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Move freight that was reclassified as a liability move (Dr Trade Payables /
 * Cr Freight Accrual) into COGS, so it lands in product cost for goods already
 * sold. Dr COGS / Cr Trade Payables. Dry run — nothing posts until confirmed.
 */
export default function FreightToCogsTool() {
  const gl = useGLAccounts();
  const { allAccounts = [] } = useActiveAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();

  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);

  const cogsName = allAccounts.find((a) => a.account_code === gl.cogs_general)?.account_name || "Cost of Goods Sold";
  const payablesName = allAccounts.find((a) => a.account_code === gl.trade_payables)?.account_name || "Trade Payables";

  const chartCodes = useMemo(() => new Set(allAccounts.map((a) => String(a.account_code))), [allAccounts]);
  const cogsExists = chartCodes.has(String(gl.cogs_general));
  const payablesExists = chartCodes.has(String(gl.trade_payables));

  const plan = useMemo(
    () => buildFreightToCogsJournal({
      amount,
      cogsCode: gl.cogs_general,
      cogsName,
      payablesCode: gl.trade_payables,
      payablesName,
      description: "Capitalise inbound freight into cost of goods sold",
    }),
    [amount, gl.cogs_general, gl.trade_payables, cogsName, payablesName]
  );

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!plan.lines.length) throw new Error("Enter an amount to capitalise.");
      if (currentOrg?.id) await assertPeriodAllowed(entryDate, currentOrg.id, "gl");

      const je = await postJournalEntry({
        lines: plan.lines,
        referenceType: "freight_to_cogs",
        referenceId: `FRT-COGS-${entryDate}`,
        description: "Capitalise inbound freight into cost of goods sold",
        entryDate,
        entryType: "adjustment",
        orgId: currentOrg?.id,
        area: "gl",
      });

      await logAuditTrail({
        entityType: "journal_entry",
        entityId: je?.id,
        documentNumber: je?.journal_number,
        actionType: "freight_to_cogs",
        afterData: { amount: plan.amount, cogs: gl.cogs_general, payables: gl.trade_payables },
        severity: "warning",
        organizationId: currentOrg?.id,
      }).catch(() => {});

      return je;
    },
    onSuccess: (je) => {
      queryClient.invalidateQueries();
      toast({ title: "Freight moved to COGS", description: `LKR ${money(plan.amount)} posted as ${je?.journal_number}.` });
      setAmount("");
    },
    onError: (err) => {
      toast({ title: "Post failed", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-indigo-600" /> Freight → Cost of Goods Sold
        </CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          Move freight that a reclassification left on Trade Payables into COGS, so it lands in product cost. Read-only
          until you press Post.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {(!cogsExists || !payablesExists) ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {!cogsExists ? `COGS (→ ${gl.cogs_general})` : `Trade Payables (→ ${gl.trade_payables})`} is not in your
              Chart of Accounts. Map it in GL Account Mapping first.
            </span>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              For goods that are already <strong>sold</strong>, freight belongs in <strong>Cost of Goods Sold</strong>.
              This posts <strong>Dr {gl.cogs_general} {cogsName}</strong> / <strong>Cr {gl.trade_payables} {payablesName}</strong>.
              It does not touch your freight liability account. Enter the freight amount shown on your trial balance
              (e.g. the debit left on Trade Payables).
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Freight amount (LKR) *</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 7100" />
              </div>
              <div>
                <Label>Entry date *</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
            </div>

            {plan.lines.length > 0 && (
              <div className="overflow-hidden rounded-lg border text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr><th className="px-3 py-2 text-left font-medium">Account</th><th className="px-3 py-2 text-right font-medium">Debit</th><th className="px-3 py-2 text-right font-medium">Credit</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2"><span className="font-mono text-xs">{l.account_code}</span> {l.account_name}</td>
                        <td className="px-3 py-2 text-right">{l.debit ? money(l.debit) : ""}</td>
                        <td className="px-3 py-2 text-right">{l.credit ? money(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Post this only if the freight is NOT already in COGS/Inventory from the original invoice — otherwise it
              double-counts. Check the invoice's journal if unsure.
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => postMutation.mutate()}
                disabled={!plan.isBalanced || postMutation.isPending}
              >
                {postMutation.isPending ? "Posting…" : `Post — move LKR ${money(plan.amount)} to COGS`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
