import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES = {
  posted: "bg-green-100 text-green-800",
  reversed: "bg-amber-100 text-amber-800",
  draft: "bg-gray-100 text-gray-700",
};

/**
 * Read-only list of the GL journal entries a document produced — the actual Dr/Cr
 * postings behind a sales or purchase transaction. Matches by reference_id, so a
 * document that posts more than one entry (e.g. a sales invoice: revenue + COGS)
 * shows them all, including any reversal mirrors. Pass one document number, or
 * several if the document is referenced under more than one.
 */
export default function JournalEntriesPanel({ documentNumber, documentNumbers }) {
  const numbers = useMemo(() => {
    const list = documentNumbers?.length ? documentNumbers : [documentNumber];
    return new Set(list.filter(Boolean).map((n) => String(n)));
  }, [documentNumber, documentNumbers]);

  const { data: entries = [], isLoading: le } = useQuery({
    queryKey: ["journalEntries"],
    queryFn: () => matrixSales.entities.JournalEntry.list(),
    initialData: [],
  });
  const { data: lines = [], isLoading: ll } = useQuery({
    queryKey: ["journalLines"],
    queryFn: () => matrixSales.entities.JournalLine.list(),
    initialData: [],
  });

  const matched = useMemo(() => {
    if (numbers.size === 0) return [];
    const linesByJournal = new Map();
    for (const l of lines) {
      const k = String(l.journal_number);
      if (!linesByJournal.has(k)) linesByJournal.set(k, []);
      linesByJournal.get(k).push(l);
    }
    return entries
      .filter((e) => numbers.has(String(e.reference_id)))
      .sort((a, b) =>
        String(a.entry_date || "").localeCompare(String(b.entry_date || "")) ||
        String(a.journal_number || "").localeCompare(String(b.journal_number || ""))
      )
      .map((e) => {
        const el = linesByJournal.get(String(e.journal_number)) || [];
        const debit = el.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const credit = el.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
        return { entry: e, lines: el, debit, credit };
      });
  }, [entries, lines, numbers]);

  if (numbers.size === 0) return null;
  if (le || ll) return <p className="mt-3 text-sm text-gray-400">Loading journal entries…</p>;
  if (matched.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">No journal entries have been posted for this document yet.</p>;
  }

  return (
    <div className="mt-3 space-y-4">
      {matched.map(({ entry, lines: el, debit, credit }) => (
        <div key={entry.id || entry.journal_number} className="rounded-lg border">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono font-medium">{entry.journal_number}</span>
            {entry.entry_date && <span className="text-gray-500">{entry.entry_date}</span>}
            <Badge className={STATUS_STYLES[String(entry.status || "").toLowerCase()] || "bg-gray-100 text-gray-700"}>
              {entry.status || "—"}
            </Badge>
            {entry.description && <span className="truncate text-gray-500">{entry.description}</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Account</th>
                  <th className="px-3 py-1.5 text-right font-medium">Debit</th>
                  <th className="px-3 py-1.5 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {el.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">
                      <span className="font-mono text-xs">{l.account_code}</span>
                      {l.account_name ? ` — ${l.account_name}` : ""}
                      {l.description ? <span className="block text-xs text-gray-400">{l.description}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{parseFloat(l.debit) ? money(l.debit) : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{parseFloat(l.credit) ? money(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <td className="px-3 py-1.5 text-right text-gray-500">Total</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(debit)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {Math.abs(debit - credit) > 0.01 && (
            <div className="px-3 py-1.5 text-xs text-red-600">
              Not balanced — debit and credit differ by {money(Math.abs(debit - credit))}.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
