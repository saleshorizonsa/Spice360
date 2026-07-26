import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, Wand2 } from "lucide-react";
import { useActiveAccounts } from "@/hooks/useActiveAccounts";
import { findMojibakeFixes } from "@/lib/mojibake";
import { logAuditTrail } from "../utils/auditTrail";

/**
 * Repairs Chart-of-Accounts names/descriptions corrupted by a UTF-8 -> CP1252
 * round-trip (a dash showing as "â€"", etc.). Display text only -- codes,
 * balances and postings are untouched. Read-only until Apply: the change list is
 * shown first so nothing is edited unseen.
 */
export default function AccountNameRepairTool() {
  const { allAccounts = [], isLoading } = useActiveAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fixes = useMemo(() => findMojibakeFixes(allAccounts), [allAccounts]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      let n = 0;
      for (const fix of fixes) {
        const payload = {};
        for (const [field, { after }] of Object.entries(fix.changed)) payload[field] = after;
        // update() merges over the existing record, so other fields are preserved.
        await matrixSales.entities.ChartOfAccounts.update(fix.id, payload);
        n += 1;
      }
      await logAuditTrail({
        entityType: "chart_of_accounts",
        actionType: "mojibake_repair",
        afterData: { accounts_fixed: fixes.map((f) => f.account_code) },
        severity: "info",
      }).catch(() => {});
      return n;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries();
      toast({ title: "Account names repaired", description: `${n} account${n === 1 ? "" : "s"} corrected.` });
    },
    onError: (err) => {
      toast({
        title: "Repair failed",
        description: `${err.message || "Unknown error"}. Some names may be unchanged.`,
        variant: "destructive",
        duration: 15000,
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-indigo-600" /> Repair Garbled Account Names
        </CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          Fixes account names corrupted by spreadsheet / Drive round-trips, where a dash or quote shows as garbled
          characters. Display text only — read-only until you press Apply.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading accounts…</p>
        ) : fixes.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> No garbled account names found. Nothing to repair.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Code</th>
                    <th className="px-3 py-2 text-left font-medium">Field</th>
                    <th className="px-3 py-2 text-left font-medium">Now (garbled)</th>
                    <th className="px-3 py-2 text-left font-medium">After repair</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fixes.flatMap((f) =>
                    Object.entries(f.changed).map(([field, { before, after }]) => (
                      <tr key={`${f.id}-${field}`}>
                        <td className="px-3 py-2 font-mono text-xs">{f.account_code}</td>
                        <td className="px-3 py-2 text-gray-500">{field === "account_name" ? "Name" : "Description"}</td>
                        <td className="px-3 py-2 text-red-600">{before}</td>
                        <td className="px-3 py-2 text-emerald-700">{after}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                {fixes.length} account{fixes.length === 1 ? "" : "s"} will be updated. Codes, balances and postings are
                untouched.
              </span>
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? "Repairing…" : `Repair ${fixes.length} name${fixes.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
