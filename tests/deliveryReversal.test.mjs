import assert from 'node:assert/strict';
import test from 'node:test';
import { findBlockingInvoices, reversalLinesFromDelivery } from '../src/lib/deliveryReversal.js';
import { deliveredByProduct } from '../src/lib/deliveryLines.js';

// ── Invoiced-delivery guard ─────────────────────────────────────────────────
test('finds an invoice that references the delivery via delivery_references array', () => {
  const invoices = [
    { invoice_number: 'INV-1', status: 'submitted', delivery_references: [{ delivery_number: 'DN-1' }] },
    { invoice_number: 'INV-2', status: 'submitted', delivery_references: [{ delivery_number: 'DN-9' }] },
  ];
  const blocking = findBlockingInvoices('DN-1', invoices);
  assert.equal(blocking.length, 1);
  assert.equal(blocking[0].invoice_number, 'INV-1');
});

test('finds an invoice via a comma-joined legacy delivery_number', () => {
  const invoices = [{ invoice_number: 'INV-1', status: 'submitted', delivery_number: 'DN-1, DN-2' }];
  assert.equal(findBlockingInvoices('DN-2', invoices).length, 1);
});

test('handles delivery_references stored as a JSON string', () => {
  const invoices = [{ invoice_number: 'INV-1', status: 'draft', delivery_references: '[{"delivery_number":"DN-5"}]' }];
  assert.equal(findBlockingInvoices('DN-5', invoices).length, 1);
});

test('a cancelled invoice does not block', () => {
  const invoices = [{ invoice_number: 'INV-1', status: 'cancelled', delivery_references: [{ delivery_number: 'DN-1' }] }];
  assert.equal(findBlockingInvoices('DN-1', invoices).length, 0);
});

test('no invoice referencing the delivery means no block', () => {
  assert.equal(findBlockingInvoices('DN-1', [{ invoice_number: 'INV-1', delivery_number: 'DN-2' }]).length, 0);
  assert.equal(findBlockingInvoices('DN-1', []).length, 0);
});

// ── Reversal lines ──────────────────────────────────────────────────────────
test('reverses multi-line deliveries at the cost they were issued at', () => {
  const delivery = {
    shipping_location: 'WH1',
    delivery_lines: [
      { product_code: 'A', product_name: 'Alpha', unit_of_measure: 'kg', quantity_delivered: 10, cogs_unit_cost: 30 },
      { product_code: 'B', product_name: 'Beta',  unit_of_measure: 'kg', quantity_delivered: 5,  cogs_unit_cost: 40 },
    ],
  };
  const lines = reversalLinesFromDelivery(delivery);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], { product_code: 'A', product_name: 'Alpha', unit_of_measure: 'kg', warehouse: 'WH1', batch_number: '', quantity: 10, cost: 30, costKnown: true });
  assert.equal(lines[1].cost, 40);
});

test('falls back to header fields for a legacy single-product delivery', () => {
  const delivery = { shipping_location: 'WH1', product_code: 'A', product_name: 'Alpha', quantity_delivered: 8, cogs_unit_cost: 12 };
  const lines = reversalLinesFromDelivery(delivery);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 8);
  assert.equal(lines[0].cost, 12);
});

test('flags costKnown=false when the issue cost was never stored', () => {
  const delivery = { shipping_location: 'WH1', delivery_lines: [{ product_code: 'A', quantity_delivered: 10 }] };
  const lines = reversalLinesFromDelivery(delivery);
  assert.equal(lines[0].costKnown, false);
  assert.equal(lines[0].cost, 0);
});

test('skips zero-quantity lines', () => {
  const delivery = { shipping_location: 'WH1', delivery_lines: [{ product_code: 'A', quantity_delivered: 0, cogs_unit_cost: 5 }] };
  assert.equal(reversalLinesFromDelivery(delivery).length, 0);
});

// ── A reversed delivery frees the SO quantity ───────────────────────────────
test('a reversed delivery no longer counts as delivered', () => {
  const priorDeliveries = [
    { pgi_done: true, status: 'pgi_completed', delivery_lines: [{ product_code: 'A', quantity_delivered: 10 }] },
    { pgi_done: true, status: 'reversed',      delivery_lines: [{ product_code: 'A', quantity_delivered: 4 }] },
  ];
  const delivered = deliveredByProduct(priorDeliveries);
  assert.equal(delivered.get('A'), 10); // the reversed 4 is not counted
});
