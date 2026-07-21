import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, ArrowRight } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useOrganization } from "../utils/OrganizationContext";
import { postJournalEntry, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import { buildSweepJournal, inferStrayAccountType } from "@/lib/unchartedSweep";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Move an uncharted account's balance into a real account. Creates the stray code
 * in the chart so the journal can post, posts the balancing move, then retires the
 * stray. Dry run — nothing is written until Sweep is pressed.
 */
export default function SweepUnchartedDialog({ stray, accounts = [], onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const [targetCode, setTargetCode] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);

  const targetOptions = useMemo(
    () => accounts
      .filter((a) => !a.is_header && String(a.account_code) !== String(stray.account_code))
      .map((a) => ({ value: a.account_code, label: `${a.account_code} — ${a.account_name}` })),
    [accounts, stray]
  );
  const targetName = accounts.find((a) => a.account_code === targetCode)?.account_name || "";

  const plan = useMemo(
    () => buildSweepJournal({
      strayCode: stray.account_code,
      strayName: `${stray.account_code} (retired)`,
      balance: stray.balance,
      targetCode,
      targetName,
      description: `Sweep stray account ${stray.account_code} → ${targetCode}`,
    }),
    [stray, targetCode, targetName]
  );

  const sweepMutation = useMutation({
    mutationFn: async () => {
      if (!plan.lines.length) throw new Error("Nothing to sweep.");
      if (currentOrg?.id) await assertPeriodAllowed(entryDate, currentOrg.id, "gl");

      // 1. Create the stray code in the chart so posting to it is allowed. If it is
      //    somehow already there, this is skipped.
      const existing = await matrixSales.entities.ChartOfAccounts.filter({
        account_code: stray.account_code,
        organization_id: currentOrg?.id,
      });
      let strayId = existing?.[0]?.id;
      if (!strayId) {
        const type = inferStrayAccountType(stray.balance);
        const created = await matrixSales.entities.ChartOfAccounts.create({
          account_code: stray.account_code,
          account_name: `${stray.account_code} — swept fallback (retired)`,
          ...type,
          is_header: false,
          status: "active",
          organization_id: currentOrg?.id,
        });
        strayId = created.id;
      }

      // 2. Post the balancing move.
      const je = await postJournalEntry({
        lines: plan.lines,
        referenceType: "uncharted_sweep",
        referenceId: stray.account_code,
        description: `Sweep ${stray.account_code} → ${targetCode}`,
        entryDate,
        entryType: "adjustment",
        orgId: currentOrg?.id,
        area: "gl",
      });

      // 3. Retire the stray so it never shows in pickers again; history stays valid.
      if (strayId) {
        await matrixSales.entities.ChartOfAccounts.update(strayId, { status: "inactive" });
      }

      await logAuditTrail({
        entityType: "journal_entry",
        entityId: je?.id,
        documentNumber: je?.journal_number,
        actionType: "uncharted_sweep",
        afterData: { from: stray.account_code, to: targetCode, amount: plan.amount },
        severity: "warning",
        organizationId: currentOrg?.id,
      }).catch(() => {});

      return je;
    },
    onSuccess: (je) => {
      queryClient.invalidateQueries();
      toast({ title: "Swept", description: `LKR ${money(plan.amount)} moved from ${stray.account_code} to ${targetCode} (${je?.journal_number}).` });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Sweep failed", description: `${err.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
    },
  });

  const dir = stray.balance < 0 ? "credit" : "debit";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-indigo-600" />
            Sweep account {stray.account_code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>
              <strong>{stray.account_code}</strong> holds a net {dir} balance of{" "}
              <strong>LKR {money(Math.abs(stray.balance))}</strong> but is not in your Chart of Accounts. This moves
              it into a real account, then retires {stray.account_code}.
            </p>
            {stray.sources?.length > 0 && (
              <p className="mt-1 text-xs">Posted by: {stray.sources.join(", ")}</p>
            )}
          </div>

          <div>
            <SearchableSelect
              label="Move balance into *"
              mode="client"
              value={targetCode}
              onChange={setTargetCode}
              options={targetOptions}
              placeholder="Select the correct account (e.g. 2111 — Fright & other cost)…"
              searchPlaceholder="Search accounts…"
            />
          </div>

          <div>
            <Label>Entry date *</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
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
                      <td className="px-3 py-2 font-mono text-xs">{l.account_code}</td>
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
            This posts a real journal entry and retires {stray.account_code}. It cannot be undone with one click —
            reverse the journal if you need to.
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={sweepMutation.isPending}>Cancel</Button>
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => sweepMutation.mutate()}
              disabled={!targetCode || !plan.isBalanced || sweepMutation.isPending}
            >
              {sweepMutation.isPending ? "Sweeping…" : `Sweep LKR ${money(plan.amount)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
