import test from 'node:test';
import assert from 'node:assert/strict';
import { salesOrderAfterReturn, buildReturnDelivery, isReturnDelivery } from '../src/lib/salesReturnDocs.js';
import { traceDocumentFlow } from '../src/lib/documentFlow.js';

// ── Reopening the sales order ────────────────────────────────────────────────
// A credit note used to reverse the money and leave the sales order reading
// "delivered", so the goods could never be re-shipped against it.

test('a full return puts the order back to confirmed, so it can be shipped again', () => {
  const so = { quantity: 10, quantity_delivered: 10, status: 'delivered' };
  assert.deepEqual(salesOrderAfterReturn(so, 10), { quantity_delivered: 0, status: 'confirmed' });
});

test('a partial return leaves the order partially delivered', () => {
  const so = { quantity: 10, quantity_delivered: 10, status: 'delivered' };
  assert.deepEqual(salesOrderAfterReturn(so, 4), { quantity_delivered: 6, status: 'partially_delivered' });
});

test('returning everything on a partially delivered order still reaches confirmed', () => {
  const so = { quantity: 10, quantity_delivered: 3, status: 'partially_delivered' };
  assert.deepEqual(salesOrderAfterReturn(so, 3), { quantity_delivered: 0, status: 'confirmed' });
});

test('delivered quantity never goes negative, however much is returned', () => {
  const so = { quantity: 10, quantity_delivered: 2, status: 'partially_delivered' };
  assert.deepEqual(salesOrderAfterReturn(so, 99), { quantity_delivered: 0, status: 'confirmed' });
});

test('a negative or junk returned quantity cannot inflate what was delivered', () => {
  const so = { quantity: 10, quantity_delivered: 6 };
  assert.equal(salesOrderAfterReturn(so, -5).quantity_delivered, 6);
  assert.equal(salesOrderAfterReturn(so, 'abc').quantity_delivered, 6);
});

test('an order with no ordered quantity does not claim to be delivered', () => {
  assert.deepEqual(salesOrderAfterReturn({ quantity: 0, quantity_delivered: 0 }, 0), {
    quantity_delivered: 0,
    status: 'confirmed',
  });
});

// ── The return delivery ──────────────────────────────────────────────────────

const salesReturn = {
  return_number: 'SR-0007',
  invoice_number: 'INV-0042',
  sales_order_number: 'SO-0011',
  customer_code: 'C-1',
  customer_name: 'ACME Ltd',
  return_date: '2026-09-10',
  product_code: 'CIN-01',
  product_name: 'Cinnamon Quills',
  quantity_returned: 4,
  unit_of_measure: 'kg',
};

test('the return delivery carries the goods, the order and both back-references', () => {
  const d = buildReturnDelivery({ salesReturn, deliveryNumber: 'DN-0099', orgId: 'org-1' });
  assert.equal(d.delivery_number, 'DN-0099');
  assert.equal(d.delivery_type, 'return');
  assert.equal(d.sales_order_number, 'SO-0011');
  assert.equal(d.sales_return_number, 'SR-0007');
  assert.equal(d.return_of_invoice, 'INV-0042');
  assert.equal(d.quantity_delivered, 4);
  assert.equal(d.delivery_lines.length, 1);
  assert.equal(d.delivery_lines[0].quantity_delivered, 4);
  assert.equal(d.organization_id, 'org-1');
});

test('the return delivery is never marked PGI-done', () => {
  // The credit note already made the stock movement. A posted return delivery
  // would let the reversal flow put the same goods back a second time.
  const d = buildReturnDelivery({ salesReturn, deliveryNumber: 'DN-0099' });
  assert.equal(d.pgi_done, false);
  assert.equal(d.status, 'returned');
  assert.equal(isReturnDelivery(d), true, 'the reversal dialog refuses on this');
});

test('an ordinary delivery is not mistaken for a return', () => {
  assert.equal(isReturnDelivery({ delivery_number: 'DN-1', pgi_done: true }), false);
  assert.equal(isReturnDelivery({ delivery_type: 'outbound' }), false);
  assert.equal(isReturnDelivery({ delivery_type: 'RETURN' }), true, 'case is not significant');
});

test('a return of nothing produces no quantity', () => {
  const d = buildReturnDelivery({ salesReturn: { ...salesReturn, quantity_returned: -3 }, deliveryNumber: 'DN-1' });
  assert.equal(d.quantity_delivered, 0);
});

// ── The chain closes ─────────────────────────────────────────────────────────

test('the credit note and its return delivery appear in the invoice document flow', () => {
  const datasets = {
    SalesOrder: [{ order_number: 'SO-0011' }],
    Delivery: [
      { delivery_number: 'DN-0001', sales_order_number: 'SO-0011' },
      { delivery_number: 'DN-0099', sales_return_number: 'SR-0007' },
    ],
    Invoice: [{ invoice_number: 'INV-0042', sales_order_number: 'SO-0011' }],
    SalesReturn: [{ return_number: 'SR-0007', invoice_number: 'INV-0042' }],
  };
  const { nodes } = traceDocumentFlow({ seedType: 'Invoice', seedNumber: 'INV-0042', datasets });
  const keys = nodes.map((n) => `${n.short}:${n.number}`);

  assert.ok(keys.includes('CN:SR-0007'), 'the credit note is on the chain');
  assert.ok(keys.includes('DN:DN-0099'), 'so is the return delivery it raised');
  assert.ok(keys.includes('SO:SO-0011'), 'and the original order upstream');
});

test('tracing from the credit note reaches the invoice it credits', () => {
  const datasets = {
    Invoice: [{ invoice_number: 'INV-0042' }],
    SalesReturn: [{ return_number: 'SR-0007', invoice_number: 'INV-0042' }],
  };
  const { nodes } = traceDocumentFlow({ seedType: 'SalesReturn', seedNumber: 'SR-0007', datasets });
  assert.ok(nodes.some((n) => n.type === 'Invoice' && n.number === 'INV-0042'));
});
