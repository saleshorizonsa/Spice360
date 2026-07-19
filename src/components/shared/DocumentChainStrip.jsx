import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { traceDocumentFlow, DOC_META } from "@/lib/documentFlow";

// Same query keys as DocumentFlow, so react-query fetches each entity ONCE and
// every strip on the page shares the cache — no per-row network cost.
const ENTITY_QUERY = {
  PurchaseRequisition: () => matrixSales.entities.PurchaseRequisition.list(),
  RFQ:                 () => matrixSales.entities.RFQ.list(),
  PurchaseOrder:       () => matrixSales.entities.PurchaseOrder.list(),
  GoodsReceiptNote:    () => matrixSales.entities.GoodsReceiptNote.list(),
  VendorInvoice:       () => matrixSales.entities.VendorInvoice.list(),
  AccountsPayable:     () => matrixSales.entities.AccountsPayable.list(),
  Quotation:           () => matrixSales.entities.Quotation.list(),
  SalesOrder:          () => matrixSales.entities.SalesOrder.list(),
  Delivery:            () => matrixSales.entities.Delivery.list(),
  Invoice:             () => matrixSales.entities.Invoice.list(),
  AccountsReceivable:  () => matrixSales.entities.AccountsReceivable.list(),
  Payment:             () => matrixSales.entities.Payment.list(),
  JournalEntry:        () => matrixSales.entities.JournalEntry.list(),
  ProductionOrder:     () => matrixSales.entities.ProductionOrder.list(),
};

// The ordered stages of each chain, so the strip shows the full pipeline with the
// stages that exist filled in and the rest as faint "not yet" pills.
const CHAINS = {
  purchasing: ['PurchaseRequisition', 'RFQ', 'PurchaseOrder', 'GoodsReceiptNote', 'VendorInvoice', 'AccountsPayable'],
  sales:      ['Quotation', 'SalesOrder', 'Delivery', 'Invoice', 'AccountsReceivable'],
};

const MODULE_OF = {
  PurchaseRequisition: 'purchasing', RFQ: 'purchasing', PurchaseOrder: 'purchasing',
  GoodsReceiptNote: 'purchasing', VendorInvoice: 'purchasing', AccountsPayable: 'purchasing',
  Quotation: 'sales', SalesOrder: 'sales', Delivery: 'sales', Invoice: 'sales', AccountsReceivable: 'sales',
};

const FILLED = "bg-slate-700 text-white border-slate-700";
const PENDING = "bg-transparent text-gray-300 border-gray-200";
const CURRENT = "ring-2 ring-offset-1 ring-emerald-500";

/**
 * Compact one-line chain preview for a list row: the document's pipeline with the
 * stages that exist filled in. Non-chain seed types (Payment, JournalEntry,
 * ProductionOrder) render nothing — they have no linear pipeline to preview.
 */
export default function DocumentChainStrip({ seedType, seedNumber }) {
  const chain = CHAINS[MODULE_OF[seedType]];

  const results = Object.entries(ENTITY_QUERY).map(([type, queryFn]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const q = useQuery({ queryKey: ["docflow", type], queryFn, initialData: [], staleTime: 60_000, enabled: !!chain });
    return [type, q];
  });

  const datasets = useMemo(() => {
    const d = {};
    for (const [type, q] of results) d[type] = q.data || [];
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map(([, q]) => q.dataUpdatedAt).join(",")]);

  const presentTypes = useMemo(() => {
    if (!chain || !seedNumber) return new Set();
    const { nodes } = traceDocumentFlow({ seedType, seedNumber, datasets });
    return new Set(nodes.map((n) => n.type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedType, seedNumber, datasets, chain]);

  if (!chain || !seedNumber) return null;

  return (
    <div className="flex items-center gap-0.5" title="Document flow — filled stages exist">
      {chain.map((type, i) => {
        const present = presentTypes.has(type);
        const isCurrent = type === seedType;
        return (
          <React.Fragment key={type}>
            {i > 0 && <span className={`h-px w-2 ${present ? "bg-slate-400" : "bg-gray-200"}`} />}
            <span
              className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none border ${
                present ? FILLED : PENDING
              } ${isCurrent ? CURRENT : ""}`}
            >
              {DOC_META[type]?.short || type}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
