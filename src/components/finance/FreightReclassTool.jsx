import React, { useMemo, useState, useRef, useEffect } from "react";
import { pickPostingDate } from "@/lib/postingDate";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { postJournalEntry } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import {
  computeFreightReclassification,
  buildFreightReclassLines,
  FREIGHT_RECLASS_REF_TYPE,
  FREIGHT_RECLASS_REF_ID,
} from "@/lib/freightReclassification";
import { useOrganization } from "../utils/OrganizationContext";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Reclassify inbound freight on historical vendor invoices out of Trade Payables
 * and into Freight Accrual. Dry run by default; posts Dr Trade Payables / Cr Freight
 * Accrual only when confirmed. Idempotent — an invoice already split is skipped.
 */
export default function FreightReclassTool() {
  const gl = useGLAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const [isPosting, setIsPosting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: vendorInvoices = [], isLoading: l0 } = useQuery({
    queryKey: ["vendorInvoices"],
    queryFn: () => matrixSales.entities.VendorInvoice.list(),
    initialData: [],
  });
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
  const { data: accountingPeriods = [] } = useQuery({
    queryKey: ["accountingPeriods"],
    queryFn: () => matrixSales.entities.AccountingPeriod.list(),
    initialData: [],
  });

  const openPeriods = useMemo(
    () =>
      accountingPeriods
        .filter((p) => String(p.status || "").toLowerCase() === "open")
        .map((p) => p.period)
        .filter(Boolean)
        .sort(),
    [accountingPeriods]
  );
  const selectedPeriod = entryDate.slice(0, 7);
  const havePeriodData = openPeriods.length > 0;
  const periodOpen = !havePeriodData || openPeriods.includes(selectedPeriod);

  const dateDefaulted = useRef(false);
  useEffect(() => {
    if (dateDefaulted.current || !havePeriodData) return;
    dateDefaulted.current = true;
    setEntryDate((current) => pickPostingDate({ openPeriods, today: current }));
  }, [havePeriodData, openPeriods]);

  const plan = useMemo(
    () => computeFreightReclassification({ vendorInvoices, journalEntries, journalLines, gl }),
    [vendorInvoices, journalEntries, journalLines, gl]
  );

  const handlePost = async () => {
    const fresh = computeFreightReclassification({ vendorInvoices, journalEntries, journalLines, gl });
    if (!fresh.ready) {
      toast({ title: "Nothing to post", description: fresh.reason, variant: "destructive" });
      setConfirming(false);
      return;
    }

    setIsPosting(true);
    try {
      const description = `Reclassify inbound freight to Freight Accrual (${FREIGHT_RECLASS_REF_ID})`;
      const lines = buildFreightReclassLines({ amount: fresh.amount, gl, description });

      const je = await postJournalEntry({
        lines,
        referenceType: FREIGHT_RECLASS_REF_TYPE,
        // A single aggregate entry; tag it so a re-run sees the invoices as done via
        // their journal now carrying a Freight Accrual credit.
        referenceId: FREIGHT_RECLASS_REF_ID,
        description,
        entryDate,
        entryType: "adjustment",
        orgId: currentOrg?.id,
        area: "gl",
      });

      await logAuditTrail({
        entityType: "journal_entry",
        entityId: je?.id,
        documentNumber: je?.journal_number,
        actionType: "freight_reclass",
        afterData: { amount: fresh.amount, invoices: fresh.invoices, lines },
        severity: "warning",
      }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["journalEntries"] });
      queryClient.invalidateQueries({ queryKey: ["journalLines"] });
      toast({
        title: "Freight reclassified",
        description: `Dr Trade Payables / Cr Freight Accrual ${money(fresh.amount)} posted as ${je?.journal_number}.`,
      });
    } catch (err) {
      console.error("Freight reclassification failed:", err);
      toast({ title: "Reclassification failed", description: err?.message || "Could not post.", variant: "destructive" });
    } finally {
      setIsPosting(false);
      setConfirming(false);
    }
  };

  if (l0 || l1 || l2) {
    return <div className="py-6 text-center text-sm text-gray-500">Checking vendor invoices…</div>;
  }

  if (!gl.freight_accrual) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-600" /> Freight Reclassification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700">
            Map a <strong>Freight Accrual (Carrier)</strong> account in GL Account Mapping first, then this tool can
            move historical freight into it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-indigo-600" />
          Freight Reclassification
        </CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          Moves inbound freight on already-posted vendor invoices out of Trade Payables and into Freight Accrual
          (Dr Trade Payables / Cr Freight Accrual). Freight stays capitalised in inventory — only the liability moves.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!plan.ready && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {plan.reason || "Nothing to reclassify."}
          </div>
        )}

        {plan.ready && (
          <>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500">Freight to move to its own liability</p>
              <p className="text-lg font-bold">LKR {money(plan.amount)}</p>
              <p className="text-xs text-gray-400">across {plan.invoices.length} invoice(s)</p>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Invoice</th>
                    <th className="px-3 py-2 text-left font-medium">Vendor</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Freight</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plan.invoices.map((i) => (
                    <tr key={i.vendor_invoice_number}>
                      <td className="px-3 py-2 font-mono text-xs">{i.vendor_invoice_number}</td>
                      <td className="px-3 py-2 text-gray-600">{i.vendor_name || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{i.invoice_date || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">{money(i.freight)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-3 py-2" colSpan={3}>Total (Dr Trade Payables / Cr Freight Accrual)</td>
                    <td className="px-3 py-2 text-right">LKR {money(plan.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border bg-white p-3">
              <Label className="text-xs text-gray-700">Posting date</Label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-44" />
                {havePeriodData && (
                  <span className="text-xs text-gray-500">
                    Open period{openPeriods.length > 1 ? "s" : ""}:{" "}
                    {openPeriods.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEntryDate(`${p}-15`)}
                        className={`mx-0.5 rounded px-1.5 py-0.5 ${
                          p === selectedPeriod ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              {!periodOpen && (
                <p className="mt-2 flex items-center gap-1 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Period {selectedPeriod} is not open. Pick a date in an open period above.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This posts one real journal entry dated <strong>{entryDate}</strong> for all invoices above. It does
                not change inventory or profit — only which liability the freight sits in. It also does not edit the
                vendor AP records already created; those still include the freight, so review vendor balances after.
              </span>
            </div>

            {periodOpen && !confirming && (
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirming(true)}>
                Review &amp; post reclassification
              </Button>
            )}

            {periodOpen && confirming && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                <span className="text-sm font-medium text-emerald-900">
                  Post Dr Trade Payables / Cr Freight Accrual for LKR {money(plan.amount)} on {entryDate}?
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
