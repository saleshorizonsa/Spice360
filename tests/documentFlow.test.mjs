import assert from 'node:assert/strict';
import test from 'node:test';
import { traceDocumentFlow } from '../src/lib/documentFlow.js';

// A full procure-to-pay chain: PR -> RFQ -> PO -> GRN -> Vendor Invoice -> AP,
// with a journal entry against the GRN and a payment against the invoice.
const purchasingData = {
  PurchaseRequisition: [{ pr_number: 'PR-1', status: 'approved' }],
  RFQ: [{ rfq_number: 'RFQ-1', pr_reference: 'PR-1', status: 'awarded' }],
  PurchaseOrder: [{ po_number: 'PO-1', rfq_reference: 'RFQ-1', status: 'fully_received' }],
  GoodsReceiptNote: [{ grn_number: 'GRN-1', po_number: 'PO-1', status: 'completed' }],
  VendorInvoice: [{ vendor_invoice_number: 'VI-1', po_number: 'PO-1',
    grn_references: [{ grn_number: 'GRN-1' }], status: 'approved' }],
  AccountsPayable: [{ ap_number: 'AP-VI-1', vendor_invoice_number: 'VI-1' }],
  JournalEntry: [{ journal_number: 'JE-9', reference_type: 'grn', reference_id: 'GRN-1', status: 'posted' }],
  Payment: [{ payment_number: 'PAY-1', reference_number: 'VI-1' }],
};

test('traces the full purchasing chain from the middle (the PO)', () => {
  const { nodes } = traceDocumentFlow({ seedType: 'PurchaseOrder', seedNumber: 'PO-1', datasets: purchasingData });
  const types = nodes.map((n) => n.type);
  for (const t of ['PurchaseRequisition', 'RFQ', 'PurchaseOrder', 'GoodsReceiptNote', 'VendorInvoice', 'AccountsPayable']) {
    assert.ok(types.includes(t), `expected ${t} in the flow`);
  }
});

test('nodes come back ordered by stage', () => {
  const { nodes } = traceDocumentFlow({ seedType: 'GoodsReceiptNote', seedNumber: 'GRN-1', datasets: purchasingData });
  const stages = nodes.filter((n) => n.module === 'purchasing').map((n) => n.stage);
  const sorted = [...stages].sort((a, b) => a - b);
  assert.deepEqual(stages, sorted);
});

test('follows a JSON-array reference (grn_references) upstream from the invoice', () => {
  const { nodes } = traceDocumentFlow({ seedType: 'VendorInvoice', seedNumber: 'VI-1', datasets: purchasingData });
  assert.ok(nodes.find((n) => n.type === 'GoodsReceiptNote' && n.number === 'GRN-1'));
});

test('attaches journal entries and payments to the chain', () => {
  const { nodes } = traceDocumentFlow({ seedType: 'PurchaseOrder', seedNumber: 'PO-1', datasets: purchasingData });
  assert.ok(nodes.find((n) => n.type === 'JournalEntry' && n.number === 'JE-9'));
  assert.ok(nodes.find((n) => n.type === 'Payment' && n.number === 'PAY-1'));
});

test('a stored-as-string JSON array is parsed', () => {
  const data = {
    ...purchasingData,
    VendorInvoice: [{ vendor_invoice_number: 'VI-1', grn_references: '[{"grn_number":"GRN-1"}]' }],
  };
  const { nodes } = traceDocumentFlow({ seedType: 'VendorInvoice', seedNumber: 'VI-1', datasets: data });
  assert.ok(nodes.find((n) => n.type === 'GoodsReceiptNote' && n.number === 'GRN-1'));
});

// Order-to-cash: Quotation -> SO -> two Deliveries -> one Invoice covering both.
const salesData = {
  Quotation: [{ quotation_number: 'QT-1' }],
  SalesOrder: [{ order_number: 'SO-1', quotation_reference: 'QT-1' }],
  Delivery: [
    { delivery_number: 'DN-1', sales_order_number: 'SO-1', status: 'pgi_completed' },
    { delivery_number: 'DN-2', sales_order_number: 'SO-1', status: 'pgi_completed' },
  ],
  Invoice: [{ invoice_number: 'INV-1', sales_order_number: 'SO-1',
    delivery_references: [{ delivery_number: 'DN-1' }, { delivery_number: 'DN-2' }] }],
  AccountsReceivable: [{ invoice_number: 'INV-1' }],
};

test('fans out to multiple deliveries under one sales order', () => {
  const { nodes } = traceDocumentFlow({ seedType: 'SalesOrder', seedNumber: 'SO-1', datasets: salesData });
  const deliveries = nodes.filter((n) => n.type === 'Delivery');
  assert.equal(deliveries.length, 2);
  assert.ok(nodes.find((n) => n.type === 'Quotation'));
  assert.ok(nodes.find((n) => n.type === 'Invoice'));
  assert.ok(nodes.find((n) => n.type === 'AccountsReceivable'));
});

test('reaches the whole sales chain starting from the invoice', () => {
  const { nodes } = traceDocumentFlow({ seedType: 'Invoice', seedNumber: 'INV-1', datasets: salesData });
  const types = new Set(nodes.map((n) => n.type));
  for (const t of ['Quotation', 'SalesOrder', 'Delivery', 'Invoice']) assert.ok(types.has(t), t);
});

test('a document referenced but not present appears as a missing stub', () => {
  const data = { PurchaseOrder: [{ po_number: 'PO-9', rfq_reference: 'RFQ-GONE' }] };
  const { nodes } = traceDocumentFlow({ seedType: 'PurchaseOrder', seedNumber: 'PO-9', datasets: data });
  const stub = nodes.find((n) => n.type === 'RFQ' && n.number === 'RFQ-GONE');
  assert.ok(stub);
  assert.equal(stub.missing, true);
});

test('the seed always appears even with no links', () => {
  const { nodes, seedKey } = traceDocumentFlow({
    seedType: 'PurchaseOrder', seedNumber: 'PO-LONE', datasets: { PurchaseOrder: [{ po_number: 'PO-LONE' }] },
  });
  assert.equal(nodes.length, 1);
  assert.equal(seedKey, 'PurchaseOrder::PO-LONE');
});

test('unknown type or blank number yields an empty flow', () => {
  assert.deepEqual(traceDocumentFlow({ seedType: 'Nope', seedNumber: 'X', datasets: {} }).nodes, []);
  assert.deepEqual(traceDocumentFlow({ seedType: 'PurchaseOrder', seedNumber: '', datasets: {} }).nodes, []);
});

test('does not confuse different documents that share a number across types', () => {
  // A PO and an SO both numbered "1000" must not cross-link.
  const data = {
    PurchaseOrder: [{ po_number: '1000' }],
    SalesOrder: [{ order_number: '1000' }],
    Delivery: [{ delivery_number: 'DN-1', sales_order_number: '1000' }],
  };
  const { nodes } = traceDocumentFlow({ seedType: 'PurchaseOrder', seedNumber: '1000', datasets: data });
  assert.ok(!nodes.find((n) => n.type === 'Delivery')); // the delivery belongs to the SO, not the PO
});
