import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeliveryLines,
  deliveredByProduct,
  clampDeliverQty,
  totalDelivering,
  validateDeliveryLines,
} from '../src/lib/deliveryLines.js';

const soLines = [
  { line_number: 1, product_code: 'CIN-5', product_name: 'Cinnamon C5', quantity: 100, unit_of_measure: 'kg', unit_price: 500 },
  { line_number: 2, product_code: 'CIN-4', product_name: 'Cinnamon C4', quantity: 60,  unit_of_measure: 'kg', unit_price: 400 },
];

test('pre-fills every SO line with its full remaining quantity', () => {
  const lines = buildDeliveryLines({ soLines, priorDeliveries: [] });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].quantity_delivering, 100); // pick everything by default
  assert.equal(lines[1].quantity_delivering, 60);
  assert.equal(lines[0].fullyDelivered, false);
});

test('reduces remaining by what prior PGI-posted deliveries already shipped', () => {
  const priorDeliveries = [
    { pgi_done: true, delivery_lines: [{ product_code: 'CIN-5', quantity_delivered: 40 }] },
  ];
  const lines = buildDeliveryLines({ soLines, priorDeliveries });
  assert.equal(lines[0].quantity_already_delivered, 40);
  assert.equal(lines[0].quantity_remaining, 60);
  assert.equal(lines[0].quantity_delivering, 60);
  assert.equal(lines[1].quantity_remaining, 60); // untouched product
});

test('a fully delivered line has zero remaining and is flagged', () => {
  const priorDeliveries = [{ pgi_done: true, delivery_lines: [{ product_code: 'CIN-4', quantity_delivered: 60 }] }];
  const lines = buildDeliveryLines({ soLines, priorDeliveries });
  const c4 = lines.find((l) => l.product_code === 'CIN-4');
  assert.equal(c4.quantity_remaining, 0);
  assert.equal(c4.quantity_delivering, 0);
  assert.equal(c4.fullyDelivered, true);
});

test('a delivery not yet PGI-posted does not count as delivered', () => {
  const priorDeliveries = [{ pgi_done: false, delivery_lines: [{ product_code: 'CIN-5', quantity_delivered: 100 }] }];
  const lines = buildDeliveryLines({ soLines, priorDeliveries });
  assert.equal(lines[0].quantity_remaining, 100); // still fully outstanding
});

test('legacy single-product deliveries are counted', () => {
  // Old-shape delivery: product on the header, no delivery_lines array.
  const priorDeliveries = [{ pgi_done: true, product_code: 'CIN-5', quantity_delivered: 25 }];
  assert.equal(deliveredByProduct(priorDeliveries).get('CIN-5'), 25);
});

test('delivered quantities accumulate across several prior deliveries', () => {
  const priorDeliveries = [
    { pgi_done: true, delivery_lines: [{ product_code: 'CIN-5', quantity_delivered: 30 }] },
    { pgi_done: true, delivery_lines: [{ product_code: 'CIN-5', quantity_delivered: 20 }] },
  ];
  const lines = buildDeliveryLines({ soLines, priorDeliveries });
  assert.equal(lines[0].quantity_already_delivered, 50);
  assert.equal(lines[0].quantity_remaining, 50);
});

// ── Over-delivery is blocked ─────────────────────────────────────────────────
test('clampDeliverQty blocks shipping more than remaining and floors at zero', () => {
  assert.equal(clampDeliverQty(150, 100), 100); // capped at remaining
  assert.equal(clampDeliverQty(-5, 100), 0);    // no negatives
  assert.equal(clampDeliverQty(40, 100), 40);   // a valid partial passes through
});

test('validation rejects over-delivery', () => {
  const lines = [{ product_code: 'CIN-5', quantity_remaining: 60, quantity_delivering: 80 }];
  const { ok, errors } = validateDeliveryLines(lines);
  assert.equal(ok, false);
  assert.match(errors[0], /exceeds the 60/);
});

test('validation requires at least one line with a quantity', () => {
  const lines = [{ product_code: 'CIN-5', quantity_remaining: 60, quantity_delivering: 0 }];
  const { ok, errors } = validateDeliveryLines(lines);
  assert.equal(ok, false);
  assert.match(errors[0], /at least one line/);
});

test('a valid partial delivery passes and lists only the shipped lines', () => {
  const lines = [
    { product_code: 'CIN-5', quantity_remaining: 100, quantity_delivering: 40 },
    { product_code: 'CIN-4', quantity_remaining: 60, quantity_delivering: 0 },
  ];
  const { ok, deliverable } = validateDeliveryLines(lines);
  assert.equal(ok, true);
  assert.equal(deliverable.length, 1);
  assert.equal(deliverable[0].product_code, 'CIN-5');
  assert.equal(totalDelivering(lines), 40);
});
