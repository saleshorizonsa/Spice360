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

test('positionKey is stable across bin and batch', () => {
  assert.equal(
    positionKey({ material_code: 'M', warehouse_code: 'W', bin_code: 'B', batch_number: 'L1' }),
    'M|W|B|L1'
  );
});
