import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { auditBatchTransport } from "@/lib/cinnamonCostAudit";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STAGE_LABELS = {
  pre_processing: "Pre-Processing",
  rubbing_peeling: "Rubbing & Peeling",
  cutting: "Cutting",
};

/**
 * Surfaces batches that carry BOTH inbound freight and step transport, so the same
 * haulage may be counted twice.
 *
 * Transport used to be enterable on the Cutting stage only, so haulage into
 * pre-processing had to be booked somewhere else — usually batch Inbound Freight.
 * Now that transport can be recorded on every stage, the same lorry load can end
 * up in both places.
 *
 * Only a human can tell whether a given batch is double-booked, so this reports
 * and never changes anything.
 */
export default function TransportDoubleCountAudit({ batches = [], steps = [] }) {
  const [expanded, setExpanded] = useState(false);
  const { flagged, totals } = useMemo(
    () => auditBatchTransport({ batches, steps }),
    [batches, steps]
  );

  if (flagged.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>No transport double-counting risk.</strong> No batch carries both inbound freight and step
          transport, so the same haulage is not booked twice.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 p-3 text-left"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        )}
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1 text-sm text-amber-900">
          <strong>
            {flagged.length} batch{flagged.length > 1 ? "es" : ""} may be double-counting transport.
          </strong>{" "}
          They carry <em>both</em> inbound freight and processing-step transport. Up to{" "}
          <strong>LKR {money(totals.atRisk)}</strong> could be counted twice — review each one.
        </span>
        <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-800">
          {expanded ? "Hide" : "Review"}
        </Badge>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-amber-200 p-3">
          <p className="text-xs text-amber-800">
            <strong>Inbound Freight</strong> (on the batch) covers supplier → factory and already feeds the landed
            cost. <strong>Step Transport</strong> covers haulage during processing. If the same lorry load was
            entered in both, remove it from one. This tool only reports — it changes nothing.
          </p>

          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-amber-100 text-amber-900">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Batch</th>
                  <th className="px-3 py-2 text-left font-medium">Supplier</th>
                  <th className="px-3 py-2 text-right font-medium">Inbound Freight</th>
                  <th className="px-3 py-2 text-right font-medium">Step Transport</th>
                  <th className="px-3 py-2 text-left font-medium">Booked on</th>
                  <th className="px-3 py-2 text-right font-medium">At risk</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {flagged.map((row) => (
                  <tr key={row.id} className="hover:bg-amber-50">
                    <td className="px-3 py-2 font-mono text-xs font-medium">{row.batch_number}</td>
                    <td className="px-3 py-2 text-gray-600">{row.supplier || "—"}</td>
                    <td className="px-3 py-2 text-right">{money(row.inboundFreight)}</td>
                    <td className="px-3 py-2 text-right">{money(row.stepTransport)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {row.transportSteps
                        .map((s) => `${STAGE_LABELS[s.stage] || s.stage} (${money(s.transport_cost)})`)
                        .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-amber-800">
                      {money(Math.min(row.inboundFreight, row.stepTransport))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-amber-700">
            &ldquo;At risk&rdquo; is the smaller of the two figures — the most that could be a duplicate. It is not a
            claim that it <em>is</em> one.
          </p>
        </div>
      )}
    </div>
  );
}
