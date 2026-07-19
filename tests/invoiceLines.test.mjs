import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInvoiceLines, clampInvoiceQty, invoiceTotals, validateInvoiceLines } from '../src/lib/invoiceLines.js';

const soLines = [
  { product_code: 'CIN-5', unit_price: 500 },
  { product_code: 'CIN-4', unit_price: 400 },
];
const deliveries = [
  { delivery_number: 'DN-1', delivery_lines: [
    { product_code: 'CIN-5', product_name: 'Cinnamon C5', quantity_delivered: 60, unit_of_measure: 'kg' },
    { product_code: 'CIN-4', product_name: 'Cinnamon C4', quantity_delivered: 40, unit_of_measure: 'kg' },
  ]},
  { delivery_number: 'DN-2', delivery_lines: [
    { product_code: 'CIN-5', product_name: 'Cinnamon C5', quantity_delivered: 20, unit_of_measure: 'kg' },
  ]},
  { delivery_number: 'DN-UNLINKED', delivery_lines: [
    { product_code: 'CIN-5', quantity_delivered: 999 },
  ]},
];

test('builds one line per product, defaulting to all delivered', () => {
  const lines = buildInvoiceLines({
    linkedDeliveries: [{ delivery_number: 'DN-1' }, { delivery_number: 'DN-2' }],
    deliveries, soLines,
  });
  assert.equal(lines.length, 2);
  const c5 = lines.find((l) => l.product_code === 'CIN-5');
  assert.equal(c5.delivered_quantity, 80);  // 60 + 20 across both deliveries
  assert.equal(c5.quantity, 80);            // pick everything
  assert.equal(c5.unit_price, 500);         // priced from the SO line
  assert.equal(c5.line_total, 40000);
});

test('ignores deliveries that are not linked', () => {
  const lines = buildInvoiceLines({
    linkedDeliveries: [{ delivery_number: 'DN-1' }],
    deliveries, soLines,
  });
  const c5 = lines.find((l) => l.product_code === 'CIN-5');
  assert.equal(c5.delivered_quantity, 60); // the DN-UNLINKED 999 is excluded
});

test('prices from the SO line, falling back to the delivery price', () => {
  const dels = [{ delivery_number: 'DN-X', delivery_lines: [
    { product_code: 'NEW-1', product_name: 'New', quantity_delivered: 10, unit_price: 33 },
  ]}];
  const lines = buildInvoiceLines({ linkedDeliveries: [{ delivery_number: 'DN-X' }], deliveries: dels, soLines: [] });
  assert.equal(lines[0].unit_price, 33); // no SO line -> delivery price
});

test('counts a legacy single-product delivery', () => {
  const dels = [{ delivery_number: 'DN-L', product_code: 'CIN-5', product_name: 'C5', quantity_delivered: 15 }];
  const lines = buildInvoiceLines({ linkedDeliveries: [{ delivery_number: 'DN-L' }], deliveries: dels, soLines });
  assert.equal(lines[0].delivered_quantity, 15);
  assert.equal(lines[0].unit_price, 500);
});

test('totals sum every line and apply one VAT rate', () => {
  const lines = buildInvoiceLines({
    linkedDeliveries: [{ delivery_number: 'DN-1' }, { delivery_number: 'DN-2' }],
    deliveries, soLines,
  });
  // CIN-5: 80 x 500 = 40,000 ; CIN-4: 40 x 400 = 16,000 -> 56,000
  const t = invoiceTotals(lines, 18);
  assert.equal(t.subtotal, 56000);
  assert.equal(t.taxAmount, 10080);
  assert.equal(t.total, 66080);
  assert.equal(t.totalQuantity, 120);
});

test('zero VAT (exempt / not activated) leaves subtotal as the total', () => {
  const lines = buildInvoiceLines({ linkedDeliveries: [{ delivery_number: 'DN-1' }], deliveries, soLines });
  const t = invoiceTotals(lines, 0);
  assert.equal(t.taxAmount, 0);
  assert.equal(t.total, t.subtotal);
});

// ── Over-invoicing is blocked ────────────────────────────────────────────────
test('clampInvoiceQty caps at delivered and floors at zero', () => {
  assert.equal(clampInvoiceQty(120, 80), 80);
  assert.equal(clampInvoiceQty(-3, 80), 0);
  assert.equal(clampInvoiceQty(50, 80), 50); // valid partial
});

test('validation rejects billing more than delivered', () => {
  const { ok, errors } = validateInvoiceLines([{ product_code: 'CIN-5', delivered_quantity: 80, quantity: 100 }]);
  assert.equal(ok, false);
  assert.match(errors[0], /exceeds the 80 delivered/);
});

test('validation requires at least one billed line', () => {
  const { ok } = validateInvoiceLines([{ product_code: 'CIN-5', delivered_quantity: 80, quantity: 0 }]);
  assert.equal(ok, false);
});

test('a valid partial passes and lists only billed lines', () => {
  const lines = [
    { product_code: 'CIN-5', delivered_quantity: 80, quantity: 50 },
    { product_code: 'CIN-4', delivered_quantity: 40, quantity: 0 },
  ];
  const { ok, billable } = validateInvoiceLines(lines);
  assert.equal(ok, true);
  assert.equal(billable.length, 1);
});
