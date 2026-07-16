import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStockChange, StockShortfallError } from '../src/lib/stockValuation.js';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

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
test('reversing a receipt by VALUE restores the original quantity AND cost', () => {
  const afterReceipt = applyStockChange({
    currentQty: 100, currentUnitCost: 10, // opening: 100 @ 10 = 1,000
    quantity: 50, unitCost: 22, operation: 'increase',
  });
  assert.equal(afterReceipt.quantity, 150);
  assert.equal(afterReceipt.unitCost, 14); // (1000 + 1100) / 150

  // Give back exactly what the receipt added (50 x 22 = 1,100).
  const afterReversal = applyStockChange({
    currentQty: afterReceipt.quantity,
    currentUnitCost: afterReceipt.unitCost,
    currentTotalValue: afterReceipt.totalValue,
    quantity: 50, valueToRemove: 1100, operation: 'decrease', strict: true,
  });
  assert.equal(afterReversal.quantity, 100);
  assert.equal(afterReversal.totalValue, 1000);
  assert.equal(afterReversal.unitCost, 10); // fully un-blended, back to the opening cost
});

// The bug this fixes: the GL reverses a receipt with a MIRROR of the original
// entry (the original value), while stock removed qty x the blended average. Once
// the average had blended, the subledger and the Inventory GL drifted apart on
// every reversal and never came back.
test('reversal removes the same value the GL mirror entry reverses', () => {
  // 100 @ 10 then 50 @ 22 -> 150 @ 14. Reverse the 50 @ 22 receipt.
  const blended = { currentQty: 150, currentUnitCost: 14, currentTotalValue: 2100 };
  const originalReceiptValue = 50 * 22; // 1,100 — what the GL credits back

  const byValue = applyStockChange({
    ...blended, quantity: 50, valueToRemove: originalReceiptValue,
    operation: 'decrease', strict: true,
  });
  const removedByStock = round2(2100 - byValue.totalValue);
  assert.equal(removedByStock, originalReceiptValue); // stock and GL agree

  // The old behaviour removed 50 x 14 = 700, leaving stock 400 above the GL.
  const byAverage = applyStockChange({ ...blended, quantity: 50, operation: 'decrease', strict: true });
  assert.equal(round2(2100 - byAverage.totalValue), 700);
  assert.notEqual(round2(2100 - byAverage.totalValue), originalReceiptValue);
});

test('reversing the whole position leaves nothing behind', () => {
  const r = applyStockChange({
    currentQty: 100, currentUnitCost: 10, currentTotalValue: 1000,
    quantity: 100, valueToRemove: 1000, operation: 'decrease', strict: true,
  });
  assert.equal(r.quantity, 0);
  assert.equal(r.totalValue, 0);
  assert.equal(r.unitCost, 0);
});

test('an ordinary issue still consumes at the moving average', () => {
  // No valueToRemove -> unchanged behaviour for sales/issues.
  const r = applyStockChange({
    currentQty: 150, currentUnitCost: 14, currentTotalValue: 2100,
    quantity: 50, operation: 'decrease',
  });
  assert.equal(r.unitCost, 14);
  assert.equal(r.totalValue, 1400);
});
