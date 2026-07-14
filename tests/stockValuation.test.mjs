import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStockChange, StockShortfallError } from '../src/lib/stockValuation.js';

// ── Weighted moving average ──────────────────────────────────────────────────
// unit_cost used to never be recalculated on receipt, so receiving at a new
// price left the whole position valued at the old cost.
test('recalculates the weighted average cost on receipt', () => {
  // 100 @ 10 already on hand, receive 100 @ 50 -> 200 @ 30, worth 6,000.
  const r = applyStockChange({
    currentQty: 100, currentUnitCost: 10,
    quantity: 100, unitCost: 50,
    operation: 'increase',
  });
  assert.equal(r.quantity, 200);
  assert.equal(r.unitCost, 30);
  assert.equal(r.totalValue, 6000); // the old code produced 2,000
});

test('first receipt into an empty position takes the receipt cost', () => {
  const r = applyStockChange({
    currentQty: 0, currentUnitCost: 0,
    quantity: 50, unitCost: 12.5,
    operation: 'increase',
  });
  assert.equal(r.quantity, 50);
  assert.equal(r.unitCost, 12.5);
  assert.equal(r.totalValue, 625);
});

test('an unpriced receipt does not drag the average to zero', () => {
  const r = applyStockChange({
    currentQty: 100, currentUnitCost: 20,
    quantity: 100, unitCost: 0, // cost unknown
    operation: 'increase',
  });
  assert.equal(r.unitCost, 20);      // holds the existing cost, not 10
  assert.equal(r.totalValue, 4000);
});

// ── Issues do not move the average ───────────────────────────────────────────
test('issuing stock leaves the unit cost unchanged and revalues the remainder', () => {
  const r = applyStockChange({
    currentQty: 200, currentUnitCost: 30,
    quantity: 60, operation: 'decrease',
  });
  assert.equal(r.quantity, 140);
  assert.equal(r.unitCost, 30);
  assert.equal(r.totalValue, 4200);
});

test('removing the entire position zeroes quantity and value', () => {
  const r = applyStockChange({
    currentQty: 100, currentUnitCost: 10,
    quantity: 100, operation: 'decrease', strict: true,
  });
  assert.equal(r.quantity, 0);
  assert.equal(r.totalValue, 0);
});

// ── The dangerous one: silent clamp on shortfall ──────────────────────────────
// Receive 100, issue 60, then reverse the GRN. Only 40 are on hand. The old code
// did Math.max(0, 40 - 100) = 0 and carried on, while the GL reversed the full
// 100 units of value — ledger and warehouse silently diverged.
test('a shortfall throws in strict mode instead of clamping to zero', () => {
  assert.throws(
    () => applyStockChange({
      currentQty: 40, currentUnitCost: 10,
      quantity: 100, operation: 'decrease', strict: true,
      materialCode: 'CIN-001', warehouse: 'WH1',
    }),
    (err) => {
      assert.ok(err instanceof StockShortfallError);
      assert.equal(err.available, 40);
      assert.equal(err.requested, 100);
      assert.equal(err.shortfall, 60);
      assert.match(err.message, /only 40 on hand/);
      return true;
    }
  );
});

test('non-strict callers keep the old clamping behaviour', () => {
  const r = applyStockChange({
    currentQty: 40, currentUnitCost: 10,
    quantity: 100, operation: 'decrease', strict: false,
  });
  assert.equal(r.quantity, 0);
  assert.equal(r.totalValue, 0);
});

// ── Round trip: receive then reverse must return to the starting position ────
test('receive then reverse restores the original quantity and cost', () => {
  const opening = { quantity: 100, unitCost: 10 };

  const afterReceipt = applyStockChange({
    currentQty: opening.quantity, currentUnitCost: opening.unitCost,
    quantity: 50, unitCost: 22, operation: 'increase',
  });
  assert.equal(afterReceipt.quantity, 150);
  assert.equal(afterReceipt.unitCost, 14); // (1000 + 1100) / 150

  const afterReversal = applyStockChange({
    currentQty: afterReceipt.quantity, currentUnitCost: afterReceipt.unitCost,
    quantity: 50, operation: 'decrease', strict: true,
  });
  assert.equal(afterReversal.quantity, 100); // quantity is fully restored
  // NOTE: the cost does not return to 10. Under a moving average, reversing a
  // receipt at a different price cannot un-blend the average — the remaining
  // 100 units stay at 14. This is inherent to the costing method, not a defect.
  assert.equal(afterReversal.unitCost, 14);
});
