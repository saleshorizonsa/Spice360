import React, { useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { traceDocumentFlow, DOC_META } from "@/lib/documentFlow";
import {
  FileText, ShoppingCart, PackageCheck, Receipt, Truck, ClipboardList,
  Factory, Banknote, BookOpen, CircleDollarSign, ArrowDown, HelpCircle,
} from "lucide-react";

// Only the entities the tracer knows about need loading.
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

const ICONS = {
  PurchaseRequisition: ClipboardList,
  RFQ: FileText,
  PurchaseOrder: ShoppingCart,
  GoodsReceiptNote: PackageCheck,
  VendorInvoice: Receipt,
  AccountsPayable: Banknote,
  Quotation: FileText,
  SalesOrder: ShoppingCart,
  Delivery: Truck,
  Invoice: Receipt,
  AccountsReceivable: CircleDollarSign,
  Payment: Banknote,
  JournalEntry: BookOpen,
  ProductionOrder: Factory,
};

const MODULE_COLORS = {
  purchasing: "border-amber-300 bg-amber-50 text-amber-900",
  sales: "border-indigo-300 bg-indigo-50 text-indigo-900",
  finance: "border-emerald-300 bg-emerald-50 text-emerald-900",
  production: "border-purple-300 bg-purple-50 text-purple-900",
  other: "border-gray-300 bg-gray-50 text-gray-900",
};

const dateOf = (r) =>
  r?.grn_date || r?.po_date || r?.rfq_date || r?.pr_date || r?.invoice_date ||
  r?.delivery_date || r?.order_date || r?.quotation_date || r?.entry_date ||
  r?.payment_date || r?.due_date || r?.created_at || "";

const statusOf = (r) =>
  r?.status || r?.payment_status || r?.three_way_match_status || r?.posting_status || "";

const amountOf = (r) =>
  r?.total_amount ?? r?.total_value ?? r?.invoice_amount ?? r?.amount ??
  r?.grand_total ?? r?.outstanding_amount ?? null;

const money = (v) =>
  v == null ? null : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Document Flow — the transaction chain a document belongs to, upstream and
 * downstream, across purchasing, sales, finance and production.
 *
 * Props: seedType (entity name in DOC_META), seedNumber (its document number),
 * and optional highlightNumber to mark the document currently being viewed.
 */
export default function DocumentFlow({ seedType, seedNumber, highlightNumber }) {
  const results = Object.entries(ENTITY_QUERY).map(([type, queryFn]) => {
    // One hook per entity — order is stable, so this is a valid fixed-length list.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const q = useQuery({ queryKey: ["docflow", type], queryFn, initialData: [], staleTime: 60_000 });
    return [type, q];
  });

  const datasets = useMemo(() => {
    const d = {};
    for (const [type, q] of results) d[type] = q.data || [];
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map(([, q]) => q.dataUpdatedAt).join(",")]);

  const isLoading = results.some(([, q]) => q.isLoading);

  const { nodes } = useMemo(
    () => traceDocumentFlow({ seedType, seedNumber, datasets }),
    [seedType, seedNumber, datasets]
  );

  if (!seedNumber) {
    return <p className="py-6 text-center text-sm text-gray-500">Save the document to see its flow.</p>;
  }
  if (isLoading) {
    return <p className="py-6 text-center text-sm text-gray-500">Tracing document flow…</p>;
  }
  if (nodes.length <= 1) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No linked documents yet. Related documents appear here as the chain progresses.
      </p>
    );
  }

  const highlight = String(highlightNumber || seedNumber);

  return (
    <div className="space-y-1 py-2">
      <p className="mb-3 text-xs text-gray-500">
        The full transaction chain this document belongs to — what it came from, and what followed.
      </p>
      {nodes.map((n, i) => {
        const Icon = ICONS[n.type] || HelpCircle;
        const isCurrent = n.number === highlight && n.type === seedType;
        const date = dateOf(n.record);
        const status = statusOf(n.record);
        const amount = money(amountOf(n.record));
        return (
          <div key={n.key}>
            <div
              className={`flex items-center gap-3 rounded-lg border p-3 ${MODULE_COLORS[n.module]} ${
                isCurrent ? "ring-2 ring-offset-1 ring-slate-500" : ""
              } ${n.missing ? "opacity-60" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{n.short}</span>
                  <span className="font-mono text-sm font-semibold">{n.number}</span>
                  {isCurrent && <Badge className="bg-slate-700 text-white">You are here</Badge>}
                  {n.missing && <Badge variant="outline" className="text-xs">not found</Badge>}
                </div>
                <div className="text-xs opacity-80">{n.label}</div>
              </div>
              <div className="shrink-0 text-right text-xs">
                {date && <div className="opacity-80">{String(date).slice(0, 10)}</div>}
                {status && (
                  <div className="font-medium capitalize">{String(status).replace(/_/g, " ")}</div>
                )}
                {amount && <div className="opacity-80">LKR {amount}</div>}
              </div>
            </div>
            {i < nodes.length - 1 && (
              <div className="flex justify-center py-0.5 text-gray-300">
                <ArrowDown className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
