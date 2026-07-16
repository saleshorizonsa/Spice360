import { applyStockChange, reversalValueOf } from './stockValuation.js';

/**
 * Recompute inventory valuation by replaying stock movement history.
 *
 * Why: updateStockLevel never recalculated `unit_cost` on receipt, so every
 * position that was received at more than one price carries a stale cost and a
 * wrong `total_value`. Fixing the code stops it getting worse; it does not repair
 * what is already on disk. This replays the movements and recomputes the weighted
 * moving average from scratch.
 *
 * SAFETY RULE — the whole design rests on this:
 *   A position is only proposed for revaluation when the replayed QUANTITY matches
 *   the stored quantity. If they disagree, the movement history is incomplete or
 *   inconsistent (opening balances loaded straight into StockLevel, movements
 *   deleted, edits made outside the movement trail...) and the replayed cost cannot
 *   be trusted either. Those positions are reported as `unreliable` and left ALONE.
 *   Silently overwriting a valuation from an incomplete history would be worse than
 *   the bug it is trying to fix.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, dp = 2) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const positionKey = (row = {}) =>
  [
    row.material_code ?? '',
    row.warehouse_code ?? '',
    row.bin_code ?? '',
    row.batch_number ?? '',
  ].join('|');

/** The key of the position a movement affects, from the given side. */
const movementKey = (movement, side) => {
  const warehouse = side === 'in' ? movement.to_warehouse : movement.from_warehouse;
  return [
    movement.material_code ?? '',
    warehouse ?? '',
    (side === 'in' ? movement.to_bin : movement.from_bin) ?? '',
    movement.batch_number ?? '',
  ].join('|');
};

const movementTime = (movement = {}) =>
  String(movement.movement_date || movement.created_at || '').slice(0, 10) +
  '#' + String(movement.created_at || '');

/**
 * Direction of a movement with respect to a position.
 * Deliberately driven by to_warehouse / from_warehouse rather than movement_type:
 * a transfer is an issue from one position and a receipt into another, and a cycle
 * count adjustment encodes its sign the same way. Type alone cannot express that.
 */
export const classifyMovement = (movement, key) => {
  if (movement.to_warehouse && movementKey(movement, 'in') === key) return 'increase';
  if (movement.from_warehouse && movementKey(movement, 'out') === key) return 'decrease';
  return null;
};

/**
 * Replay one position's movements into a final quantity + weighted average cost.
 */
export const replayPosition = (movements = [], key) => {
  const ordered = [...movements].sort((a, b) => movementTime(a).localeCompare(movementTime(b)));

  let quantity = 0;
  let unitCost = 0;
  let totalValue = 0;
  let applied = 0;

  for (const movement of ordered) {
    const operation = classifyMovement(movement, key);
    if (!operation) continue;

    const result = applyStockChange({
      currentQty: quantity,
      currentUnitCost: unitCost,
      currentTotalValue: totalValue,
      quantity: num(movement.quantity),
      unitCost: num(movement.cost_per_unit ?? movement.unit_cost),
      operation,
      strict: false, // replaying history: never throw, just report the mismatch
      // A receipt reversal gives back exactly what its receipt added, matching the
      // GL's mirror entry. Replaying it as an ordinary issue (qty x average) would
      // reproduce the very drift this replay exists to detect.
      valueToRemove: operation === 'decrease' ? reversalValueOf(movement) : null,
    });

    quantity = result.quantity;
    unitCost = result.unitCost;
    totalValue = result.totalValue;
    applied += 1;
  }

  return {
    quantity: round(quantity, 6),
    unitCost: round(unitCost, 6),
    totalValue: round(totalValue, 2),
    movementsApplied: applied,
  };
};

/**
 * Build a dry-run plan: what each stock position is worth now, what it should be
 * worth, and whether the change is safe to apply.
 *
 * Returns { changes, unreliable, unchanged, totals }.
 *   changes    – safe to write: replayed quantity agrees with stored quantity
 *   unreliable – quantity mismatch: history incomplete, DO NOT touch
 *   unchanged  – already correct
 */
export const buildRevaluationPlan = ({ stockLevels = [], movements = [], quantityTolerance = 0.001 } = {}) => {
  const byPosition = new Map();
  for (const movement of movements) {
    for (const side of ['in', 'out']) {
      const warehouse = side === 'in' ? movement.to_warehouse : movement.from_warehouse;
      if (!warehouse) continue;
      const key = movementKey(movement, side);
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(movement);
    }
  }

  const changes = [];
  const unreliable = [];
  const unchanged = [];

  for (const stock of stockLevels) {
    const key = positionKey(stock);
    const history = byPosition.get(key) || [];
    const replayed = replayPosition(history, key);

    const storedQty = num(stock.quantity);
    const storedCost = num(stock.unit_cost);
    const storedValue = num(stock.total_value);

    const row = {
      id: stock.id,
      key,
      material_code: stock.material_code,
      material_name: stock.material_name,
      warehouse_code: stock.warehouse_code,
      bin_code: stock.bin_code,
      batch_number: stock.batch_number,
      storedQty,
      storedCost,
      storedValue,
      replayedQty: replayed.quantity,
      newCost: replayed.unitCost,
      newValue: replayed.totalValue,
      movementsApplied: replayed.movementsApplied,
      valueDelta: round(replayed.totalValue - storedValue, 2),
    };

    // The safety rule. Quantity must reconcile before we trust the cost.
    if (Math.abs(replayed.quantity - storedQty) > quantityTolerance) {
      unreliable.push({
        ...row,
        reason: history.length === 0
          ? 'No movement history for this position — it was likely loaded as an opening balance.'
          : `Replayed quantity ${replayed.quantity} does not match the stored quantity ${storedQty}. The movement history is incomplete.`,
      });
      continue;
    }

    const costMoved = Math.abs(replayed.unitCost - storedCost) > 0.005;
    const valueMoved = Math.abs(row.valueDelta) > 0.01;
    if (costMoved || valueMoved) changes.push(row);
    else unchanged.push(row);
  }

  const totals = {
    positions: stockLevels.length,
    changeCount: changes.length,
    unreliableCount: unreliable.length,
    unchangedCount: unchanged.length,
    storedValue: round(changes.reduce((sum, r) => sum + r.storedValue, 0), 2),
    newValue: round(changes.reduce((sum, r) => sum + r.newValue, 0), 2),
    valueDelta: round(changes.reduce((sum, r) => sum + r.valueDelta, 0), 2),
  };

  return { changes, unreliable, unchanged, totals };
};
