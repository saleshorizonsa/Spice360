import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRevaluationPlan, replayPosition, classifyMovement, positionKey } from '../src/lib/stockRevaluation.js';

const receipt = (qty, cost, date, extra = {}) => ({
  material_code: 'CIN-001', to_warehouse: 'WH1', batch_number: '',
  quantity: qty, cost_per_unit: cost, movement_date: date, movement_type: 'goods_receipt', ...extra,
});
const issue = (qty, date, extra = {}) => ({
  material_code: 'CIN-001', from_warehouse: 'WH1', batch_number: '',
  quantity: qty, movement_date: date, movement_type: 'goods_issue', ...extra,
});
const KEY = 'CIN-001|WH1||';

test('replays receipts into a weighted moving average', () => {
  // 100 @ 10 then 100 @ 50 => 200 @ 30, worth 6,000
  const r = replayPosition([receipt(100, 10, '2026-01-01'), receipt(100, 50, '2026-02-01')], KEY);
  assert.equal(r.quantity, 200);
  assert.equal(r.unitCost, 30);
  assert.equal(r.totalValue, 6000);
  assert.equal(r.movementsApplied, 2);
});

test('applies movements in date order regardless of input order', () => {
  const late = replayPosition([receipt(100, 50, '2026-02-01'), receipt(100, 10, '2026-01-01')], KEY);
  assert.equal(late.unitCost, 30); // order-independent for the average
});

test('issues reduce quantity without moving the average', () => {
  const r = replayPosition([receipt(100, 10, '2026-01-01'), receipt(100, 50, '2026-02-01'), issue(50, '2026-03-01')], KEY);
  assert.equal(r.quantity, 150);
  assert.equal(r.unitCost, 30);
  assert.equal(r.totalValue, 4500);
});

test('direction comes from to/from warehouse, so transfers resolve per position', () => {
  const transfer = { material_code: 'CIN-001', from_warehouse: 'WH1', to_warehouse: 'WH2', quantity: 10 };
  assert.equal(classifyMovement(transfer, 'CIN-001|WH1||'), 'decrease');
  assert.equal(classifyMovement(transfer, 'CIN-001|WH2||'), 'increase');
  assert.equal(classifyMovement(transfer, 'CIN-001|WH3||'), null);
});

// ── The point of the whole exercise ──────────────────────────────────────────
test('proposes the corrected value for a position mis-valued by the stale-cost bug', () => {
  // The buggy code left this at cost 10 => total_value 2,000. It is really 6,000.
  const stockLevels = [{
    id: 's1', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '',
    quantity: 200, unit_cost: 10, total_value: 2000,
  }];
  const movements = [receipt(100, 10, '2026-01-01'), receipt(100, 50, '2026-02-01')];

  const plan = buildRevaluationPlan({ stockLevels, movements });
  assert.equal(plan.changes.length, 1);
  const c = plan.changes[0];
  assert.equal(c.storedValue, 2000);
  assert.equal(c.newCost, 30);
  assert.equal(c.newValue, 6000);
  assert.equal(c.valueDelta, 4000);
  assert.equal(plan.totals.valueDelta, 4000);
  assert.equal(plan.unreliableCount, undefined); // totals uses unreliableCount
  assert.equal(plan.totals.unreliableCount, 0);
});

// ── The safety rule ──────────────────────────────────────────────────────────
test('refuses to touch a position whose replayed quantity does not reconcile', () => {
  // Stored says 500 on hand, but the movements only account for 200.
  // The history is incomplete, so the replayed COST cannot be trusted either.
  const stockLevels = [{
    id: 's1', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '',
    quantity: 500, unit_cost: 10, total_value: 5000,
  }];
  const movements = [receipt(100, 10, '2026-01-01'), receipt(100, 50, '2026-02-01')];

  const plan = buildRevaluationPlan({ stockLevels, movements });
  assert.equal(plan.changes.length, 0);          // nothing proposed
  assert.equal(plan.unreliable.length, 1);
  assert.match(plan.unreliable[0].reason, /incomplete/);
});

test('flags a position with no movement history at all as unreliable, not as zero', () => {
  const stockLevels = [{
    id: 's1', material_code: 'OPENING-1', warehouse_code: 'WH1', bin_code: '', batch_number: '',
    quantity: 80, unit_cost: 5, total_value: 400,
  }];
  const plan = buildRevaluationPlan({ stockLevels, movements: [] });
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.unreliable.length, 1);
  assert.match(plan.unreliable[0].reason, /opening balance/i);
});

test('an already-correct position is reported as unchanged', () => {
  const stockLevels = [{
    id: 's1', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '',
    quantity: 200, unit_cost: 30, total_value: 6000,
  }];
  const movements = [receipt(100, 10, '2026-01-01'), receipt(100, 50, '2026-02-01')];
  const plan = buildRevaluationPlan({ stockLevels, movements });
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.totals.valueDelta, 0);
});

// A receipt reversal must give back what its receipt added — the same value the
// GL's mirror entry reverses. Replaying it as an ordinary issue (qty x average)
// reproduced the exact drift the revaluation exists to find, so the tool reported
// "already valued correctly" and never offered an Apply button.
test('a receipt reversal is replayed by value, not at the moving average', () => {
  const h = [
    receipt(100, 10, '2026-01-01'),                       // 100 @ 10 = 1,000
    receipt(50, 22, '2026-02-01'),                        // -> 150 @ 14 = 2,100
    { material_code: 'CIN-001', from_warehouse: 'WH1', batch_number: '',
      movement_type: 'goods_receipt_reversal',
      quantity: 50, cost_per_unit: 22, total_value: 1100, movement_date: '2026-03-01' },
  ];
  const r = replayPosition(h, KEY);
  assert.equal(r.quantity, 100);
  assert.equal(r.totalValue, 1000); // gave back exactly 1,100 — not 50 x 14 = 700
  assert.equal(r.unitCost, 10);     // average un-blended back to the opening cost
});

test('the plan now DETECTS stock left above the GL by a mis-valued reversal', () => {
  // Stored stock kept the old (wrong) result: reversal removed 50 x 14 = 700,
  // leaving 100 units valued 1,400. The truth is 1,000.
  const stockLevels = [{
    id: 's1', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '',
    quantity: 100, unit_cost: 14, total_value: 1400,
  }];
  const movements = [
    receipt(100, 10, '2026-01-01'),
    receipt(50, 22, '2026-02-01'),
    { material_code: 'CIN-001', from_warehouse: 'WH1', batch_number: '',
      movement_type: 'goods_receipt_reversal',
      quantity: 50, cost_per_unit: 22, total_value: 1100, movement_date: '2026-03-01' },
  ];

  const plan = buildRevaluationPlan({ stockLevels, movements });
  assert.equal(plan.changes.length, 1);        // an Apply button will now render
  assert.equal(plan.unreliable.length, 0);     // quantity reconciles, so it is safe to apply
  assert.equal(plan.changes[0].newValue, 1000);
  assert.equal(plan.changes[0].valueDelta, -400); // writes the overstatement off
});

test('an ordinary issue is still replayed at the moving average', () => {
  const h = [receipt(100, 10, '2026-01-01'), receipt(50, 22, '2026-02-01'), issue(50, '2026-03-01')];
  const r = replayPosition(h, KEY);
  assert.equal(r.quantity, 100);
  assert.equal(r.unitCost, 14);   // a sale does not un-blend anything
  assert.equal(r.totalValue, 1400);
});

test('positionKey is stable across bin and batch', () => {
  assert.equal(
    positionKey({ material_code: 'M', warehouse_code: 'W', bin_code: 'B', batch_number: 'L1' }),
    'M|W|B|L1'
  );
});
