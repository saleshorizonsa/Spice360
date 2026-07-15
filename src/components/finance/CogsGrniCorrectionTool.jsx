import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { postJournalEntry } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import {
  computeCogsGrniCorrection,
  buildCorrectionJournalLines,
  CORRECTION_REF_TYPE,
  CORRECTION_REF_ID,
} from "@/lib/cogsGrniCorrection";
import { useOrganization } from "../utils/OrganizationContext";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One-click reclassification for the COGS/GRNI damage. Dry run by default — it
 * recomputes from live data, and only posts Dr GRNI / Cr COGS when confirmed.
 * Idempotent: each posted correction is tagged CORRECTION_REF_TYPE and netted out,
 * so once done there is nothing left to post.
 */
export default function CogsGrniCorrectionTool() {
  const gl = useGLAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const [isPosting, setIsPosting] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  const plan = useMemo(
    () => computeCogsGrniCorrection({ journalEntries, journalLines, gl }),
    [journalEntries, journalLines, gl]
  );

  const handlePost = async () => {
    // Recompute from the freshest data at the moment of posting, so a stale render
    // cannot cause a double or wrong-sized entry.
    const fresh = computeCogsGrniCorrection({ journalEntries, journalLines, gl });
    if (!fresh.ready) {
      toast({ title: "Nothing to post", description: fresh.reason, variant: "destructive" });
      setConfirming(false);
      return;
    }

    setIsPosting(true);
    try {
      const description = `Reclassify purchase-side COGS to clear GRNI (${CORRECTION_REF_ID})`;
      const lines = buildCorrectionJournalLines({ amount: fresh.amount, gl, description });

      const je = await postJournalEntry({
        lines,
        referenceType: CORRECTION_REF_TYPE,
        referenceId: CORRECTION_REF_ID,
        description,
        entryType: "adjustment",
        orgId: currentOrg?.id,
        area: "gl",
      });

      await logAuditTrail({
        entityType: "journal_entry",
        entityId: je?.id,
        documentNumber: je?.journal_number,
        actionType: "cogs_grni_correction",
        afterData: { amount: fresh.amount, lines },
        severity: "warning",
      }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["journalEntries"] });
      queryClient.invalidateQueries({ queryKey: ["journalLines"] });
      toast({
        title: "Correction posted",
        description: `Dr GRNI / Cr COGS ${money(fresh.amount)} posted as ${je?.journal_number}.`,
      });
    } catch (err) {
      console.error("COGS/GRNI correction failed:", err);
      toast({ title: "Correction failed", description: err?.message || "Could not post.", variant: "destructive" });
    } finally {
      setIsPosting(false);
      setConfirming(false);
    }
  };

  if (l1 || l2) {
    return <div className="py-6 text-center text-sm text-gray-500">Checking the ledger…</div>;
  }

  const nothingToDo = !plan.ready && plan.remainingCogs <= 0.01;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-indigo-600" />
          COGS / GRNI Correction
        </CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          Posts a single reclassification (Dr GRNI / Cr COGS) to undo the purchase-side COGS and clear the phantom
          GRNI left by the old vendor-invoice posting.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {nothingToDo && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {plan.reason || "Nothing to correct."}
          </div>
        )}

        {!nothingToDo && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-gray-500">Purchase COGS to remove</p>
                <p className="text-lg font-bold">LKR {money(plan.remainingCogs)}</p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-gray-500">Uncleared GRNI</p>
                <p className="text-lg font-bold">LKR {money(plan.grniUncleared)}</p>
              </div>
              <div className={`rounded-lg border p-3 ${plan.reconciles ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <p className="text-xs text-gray-500">Reconcile</p>
                <p className={`text-lg font-bold ${plan.reconciles ? "text-emerald-700" : "text-red-700"}`}>
                  {plan.reconciles ? "Match ✓" : `Off by ${money(Math.abs(plan.remainingCogs - plan.grniUncleared))}`}
                </p>
              </div>
            </div>

            {/* The proposed entry, in plain double-entry form. */}
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Account</th>
                    <th className="px-3 py-2 text-right font-medium">Debit</th>
                    <th className="px-3 py-2 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-2">Goods Received Not Invoiced <span className="text-gray-400">({gl.grni})</span></td>
                    <td className="px-3 py-2 text-right font-semibold">{money(plan.amount)}</td>
                    <td className="px-3 py-2 text-right">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Cost of Goods Sold <span className="text-gray-400">({gl.cogs_general})</span></td>
                    <td className="px-3 py-2 text-right">—</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(plan.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {!plan.ready && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{plan.reason}</span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This posts a real journal entry to your ledger, dated today. It reduces Cost of Goods Sold (raising
                reported profit) and clears the GRNI liability. If you run monthly management accounts, post it in an
                open period and tell your accountant.
              </span>
            </div>

            {plan.ready && !confirming && (
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirming(true)}>
                Review &amp; post correction
              </Button>
            )}

            {plan.ready && confirming && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                <span className="text-sm font-medium text-emerald-900">
                  Post Dr GRNI / Cr COGS for LKR {money(plan.amount)}?
                </span>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={handlePost} disabled={isPosting}>
                  {isPosting ? "Posting…" : "Confirm & post"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={isPosting}>
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
