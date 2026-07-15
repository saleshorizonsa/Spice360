import assert from 'node:assert/strict';
import test from 'node:test';
import { apportionLandedCost } from '../src/lib/landedCostApportionment.js';

test('adds freight to one position and re-averages the unit cost', () => {
  // 100 kg on hand at cost 500 (value 50,000). Freight 5,000.
  const { updates, applied, strandedAmount } = apportionLandedCost({
    positions: [{ id: 's1', key: 'M|W||', receivedValue: 50000, currentQty: 100, currentUnitCost: 500, currentTotalValue: 50000 }],
    landedCost: 5000,
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].newTotalValue, 55000);
  assert.equal(updates[0].newUnitCost, 550); // 55,000 / 100 — freight now in the unit cost
  assert.equal(applied, 5000);
  assert.equal(strandedAmount, 0);
});

test('the stock revaluation equals the freight to the cent (matches the GL)', () => {
  const { updates, applied } = apportionLandedCost({
    positions: [
      { id: 'a', key: 'A', receivedValue: 30000, currentQty: 60, currentUnitCost: 500, currentTotalValue: 30000 },
      { id: 'b', key: 'B', receivedValue: 20000, currentQty: 40, currentUnitCost: 500, currentTotalValue: 20000 },
    ],
    landedCost: 5000,
  });
  const totalAdded = updates.reduce((s, u) => s + u.freightShare, 0);
  assert.equal(Math.round(totalAdded * 100) / 100, 5000); // exact — no cents lost
  assert.equal(applied, 5000);
});

test('apportions by received value, not quantity', () => {
  // Same qty on each, but B holds 3x the value -> B takes 3x the freight.
  const { updates } = apportionLandedCost({
    positions: [
      { id: 'a', key: 'A', receivedValue: 10000, currentQty: 100, currentUnitCost: 100, currentTotalValue: 10000 },
      { id: 'b', key: 'B', receivedValue: 30000, currentQty: 100, currentUnitCost: 300, currentTotalValue: 30000 },
    ],
    landedCost: 4000,
  });
  const a = updates.find((u) => u.id === 'a');
  const b = updates.find((u) => u.id === 'b');
  assert.equal(a.freightShare, 1000);
  assert.equal(b.freightShare, 3000);
});

test('largest-remainder apportionment loses no cents on awkward splits', () => {
  // 100 split across 3 equal positions -> 33.34 / 33.33 / 33.33
  const { updates, applied } = apportionLandedCost({
    positions: [
      { id: 'a', key: 'A', receivedValue: 100, currentQty: 10, currentUnitCost: 10, currentTotalValue: 100 },
      { id: 'b', key: 'B', receivedValue: 100, currentQty: 10, currentUnitCost: 10, currentTotalValue: 100 },
      { id: 'c', key: 'C', receivedValue: 100, currentQty: 10, currentUnitCost: 10, currentTotalValue: 100 },
    ],
    landedCost: 100,
  });
  const total = updates.reduce((s, u) => s + u.freightShare, 0);
  assert.equal(Math.round(total * 100) / 100, 100);
  assert.equal(applied, 100);
});

test('freight for goods already fully issued is reported as stranded, not divided by zero', () => {
  const { updates, stranded, strandedAmount } = apportionLandedCost({
    positions: [{ id: 'gone', key: 'X', receivedValue: 50000, currentQty: 0, currentUnitCost: 500, currentTotalValue: 0 }],
    landedCost: 5000,
  });
  assert.equal(updates.length, 0);
  assert.equal(stranded.length, 1);
  assert.equal(strandedAmount, 5000);
  assert.ok(Number.isFinite(strandedAmount)); // never NaN/Infinity
});

test('partial issue spreads freight over what remains on hand', () => {
  // Received 100 @ 500, 60 already sold, 40 left (value 20,000). Freight 5,000.
  const { updates } = apportionLandedCost({
    positions: [{ id: 's', key: 'X', receivedValue: 50000, currentQty: 40, currentUnitCost: 500, currentTotalValue: 20000 }],
    landedCost: 5000,
  });
  assert.equal(updates[0].newTotalValue, 25000);
  assert.equal(updates[0].newUnitCost, 625); // 25,000 / 40
});

test('no landed cost or no positions does nothing', () => {
  assert.deepEqual(apportionLandedCost({ positions: [], landedCost: 5000 }).updates, []);
  assert.deepEqual(
    apportionLandedCost({ positions: [{ id: 'a', receivedValue: 100, currentQty: 10 }], landedCost: 0 }).updates,
    []
  );
});
