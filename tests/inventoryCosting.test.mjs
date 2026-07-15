import assert from 'node:assert/strict';
import test from 'node:test';
import { valuePosition, buildInventoryValuation, COSTING_METHODS } from '../src/lib/inventoryCosting.js';

const KEY = 'CIN-001|WH1||';
const receipt = (qty, cost, date) => ({
  material_code: 'CIN-001', to_warehouse: 'WH1', batch_number: '',
  quantity: qty, cost_per_unit: cost, movement_date: date, movement_type: 'goods_receipt',
});
const issue = (qty, date) => ({
  material_code: 'CIN-001', from_warehouse: 'WH1', batch_number: '',
  quantity: qty, movement_date: date, movement_type: 'goods_issue',
});

// ── The bug that started this: FIFO and LIFO were swapped ────────────────────
// Buy 100 @10 (Jan), 100 @50 (Feb), sell 100. 100 units remain.
const history = [receipt(100, 10, '2026-01-01'), receipt(100, 50, '2026-02-01'), issue(100, '2026-03-01')];

test('FIFO values the remaining stock at the NEWEST costs', () => {
  // Oldest 100 (@10) were sold, so what is left is the Feb @50 lot.
  const r = valuePosition(history, KEY, 'fifo');
  assert.equal(r.quantity, 100);
  assert.equal(r.unitCost, 50);
  assert.equal(r.totalValue, 5000); // the old report reported 1,000 here
});

test('LIFO values the remaining stock at the OLDEST costs', () => {
  // Newest 100 (@50) were sold, so what is left is the Jan @10 lot.
  const r = valuePosition(history, KEY, 'lifo');
  assert.equal(r.quantity, 100);
  assert.equal(r.unitCost, 10);
  assert.equal(r.totalValue, 1000); // the old report reported 5,000 here
});

test('FIFO and LIFO are no longer the same number as each other reversed', () => {
  const fifo = valuePosition(history, KEY, 'fifo');
  const lifo = valuePosition(history, KEY, 'lifo');
  assert.ok(fifo.totalValue > lifo.totalValue, 'in a rising market FIFO must value stock higher than LIFO');
});

test('weighted average tracks the moving average of what is actually held', () => {
  const r = valuePosition(history, KEY, 'weighted_average');
  assert.equal(r.quantity, 100);
  assert.equal(r.unitCost, 30); // (1000 + 5000) / 200
  assert.equal(r.totalValue, 3000);
});

// ── Weighted average must respect consumption order ──────────────────────────
test('a receipt after everything was sold is not averaged against the sold lot', () => {
  // Buy 100@10, sell all 100, buy 100@50. The only stock held is the @50 lot.
  const h = [receipt(100, 10, '2026-01-01'), issue(100, '2026-02-01'), receipt(100, 50, '2026-03-01')];
  const r = valuePosition(h, KEY, 'weighted_average');
  assert.equal(r.quantity, 100);
  assert.equal(r.unitCost, 50);
  assert.equal(r.totalValue, 5000); // the old report reported 3,000
});

// ── Stock that never had a goods_receipt ────────────────────────────────────
test('production output is valued, not zeroed', () => {
  const produced = {
    material_code: 'CIN-001', to_warehouse: 'WH1', batch_number: '',
    quantity: 40, cost_per_unit: 25, movement_date: '2026-01-05', movement_type: 'production',
  };
  const r = valuePosition([produced], KEY, 'fifo');
  assert.equal(r.quantity, 40);
  assert.equal(r.totalValue, 1000); // the old report returned 0 for this
});

test('an inbound transfer is valued, not zeroed', () => {
  const transferIn = {
    material_code: 'CIN-001', from_warehouse: 'WH2', to_warehouse: 'WH1', batch_number: '',
    quantity: 10, cost_per_unit: 7, movement_date: '2026-01-05', movement_type: 'transfer',
  };
  assert.equal(valuePosition([transferIn], KEY, 'fifo').totalValue, 70);
  // and it leaves the source position
  assert.equal(valuePosition([transferIn], 'CIN-001|WH2||', 'fifo').quantity, 0);
});

test('a receipt reversal removes the goods again', () => {
  const h = [
    receipt(100, 10, '2026-01-01'),
    { material_code: 'CIN-001', from_warehouse: 'WH1', batch_number: '', quantity: 100,
      movement_date: '2026-01-02', movement_type: 'goods_receipt_reversal' },
  ];
  const r = valuePosition(h, KEY, 'fifo');
  assert.equal(r.quantity, 0);
  assert.equal(r.totalValue, 0); // the old report still counted the reversed receipt
});

// ── Quantity and value must belong to each other ─────────────────────────────
test('a material in two warehouses rolls up quantity and value consistently', () => {
  const stockLevels = [
    { id: 'a', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '', quantity: 100 },
    { id: 'b', material_code: 'CIN-001', warehouse_code: 'WH2', bin_code: '', batch_number: '', quantity: 50 },
  ];
  const movements = [
    { material_code: 'CIN-001', to_warehouse: 'WH1', batch_number: '', quantity: 100, cost_per_unit: 10, movement_date: '2026-01-01' },
    { material_code: 'CIN-001', to_warehouse: 'WH2', batch_number: '', quantity: 50,  cost_per_unit: 20, movement_date: '2026-01-01' },
  ];
  const { rows, totals } = buildInventoryValuation({ stockLevels, movements, method: 'fifo' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 150);              // 100 + 50, both warehouses
  assert.equal(rows[0].totalValue, 2000);           // 100*10 + 50*20 — each at its own cost
  assert.equal(totals.value, 2000);
});

// ── Unverifiable positions must not inflate the total ────────────────────────
test('a position whose history does not reconcile contributes no value', () => {
  const stockLevels = [
    { id: 'a', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '', quantity: 500 },
  ];
  const movements = [
    { material_code: 'CIN-001', to_warehouse: 'WH1', batch_number: '', quantity: 100, cost_per_unit: 10, movement_date: '2026-01-01' },
  ];
  const { rows, unreconciled, totals } = buildInventoryValuation({ stockLevels, movements, method: 'fifo' });
  assert.equal(unreconciled.length, 1);
  assert.equal(rows[0].quantity, 500);   // physical quantity is still shown
  assert.equal(rows[0].totalValue, 0);   // but an unverifiable cost adds nothing
  assert.equal(totals.unreconciledCount, 1);
});

test('LIFO is flagged as not permitted under IFRS', () => {
  assert.equal(COSTING_METHODS.weighted_average.authoritative, true);
  assert.equal(COSTING_METHODS.lifo.authoritative, false);
  assert.match(COSTING_METHODS.lifo.note, /NOT permitted under IFRS/i);
});

// ── Weighted average must report the BOOK value, not a movement replay ────────
// Freight is capitalised into StockLevel.unit_cost/total_value but is NOT a stock
// movement. A movement replay therefore excludes it and understates the book value.
// The "Weighted Average — Book value" method must read StockLevel directly.
test('weighted average reports StockLevel book value including capitalised freight', () => {
  const stockLevels = [
    // Book says 100 @ 550 = 55,000 (500 goods + 50/unit freight capitalised).
    { id: 's1', material_code: 'CIN-001', warehouse_code: 'WH1', bin_code: '', batch_number: '',
      quantity: 100, unit_cost: 550, total_value: 55000 },
  ];
  // Movements only carry the purchase price (500) — no freight line exists.
  const movements = [receipt(100, 500, '2026-01-01')];

  const wa = buildInventoryValuation({ stockLevels, movements, method: 'weighted_average' });
  assert.equal(wa.totals.value, 55000);        // book value, freight included
  assert.equal(wa.rows[0].unitCost, 550);
  assert.equal(wa.unreconciled.length, 0);      // book value has nothing to reconcile

  // FIFO stays a movement replay, so it reflects the ex-freight purchase cost.
  const fifo = buildInventoryValuation({ stockLevels, movements, method: 'fifo' });
  assert.equal(fifo.totals.value, 50000);
});

test('weighted average book value is unaffected by incomplete movement history', () => {
  // No movements at all (opening balance loaded straight into stock). FIFO cannot
  // value it; the book value simply reads what is recorded.
  const stockLevels = [
    { id: 's1', material_code: 'M', warehouse_code: 'W', bin_code: '', batch_number: '',
      quantity: 80, unit_cost: 12.5, total_value: 1000 },
  ];
  const wa = buildInventoryValuation({ stockLevels, movements: [], method: 'weighted_average' });
  assert.equal(wa.totals.value, 1000);
  assert.equal(wa.unreconciled.length, 0);

  const fifo = buildInventoryValuation({ stockLevels, movements: [], method: 'fifo' });
  assert.equal(fifo.unreconciled.length, 1);    // FIFO flags the missing history
});
