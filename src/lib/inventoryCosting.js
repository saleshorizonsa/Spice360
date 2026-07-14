import { applyStockChange } from './stockValuation.js';
import { classifyMovement, positionKey } from './stockRevaluation.js';

/**
 * Value inventory by replaying the full stock movement history.
 *
 * Replaces a valuation report that was wrong in five separate ways:
 *
 *  1. FIFO and LIFO were swapped. The FIFO branch valued the remaining stock at
 *     the OLDEST costs — but under FIFO the oldest units are the ones you sold.
 *  2. Weighted average averaged every receipt ever, ignoring what had been
 *     consumed. Buy 100@10, sell all 100, buy 100@50 -> it reported cost 30 when
 *     the only stock held was the @50 lot.
 *  3. It only read `movement_type: 'goods_receipt'`, so stock created by
 *     production or an inbound transfer had no receipts and was silently valued
 *     at ZERO. Receipt reversals were never subtracted either.
 *  4. Unit cost was derived from one warehouse's quantity while the table showed
 *     the quantity summed across all warehouses, so value != qty x cost.
 *  5. LIFO is prohibited under IFRS/LKAS, but was offered as a reporting basis.
 *
 * Here every method is derived from the same replay, so the three can be compared
 * honestly, and direction comes from to_warehouse/from_warehouse (never from
 * movement_type) so transfers, production and adjustments all land correctly.
 */

export const COSTING_METHODS = {
  weighted_average: {
    label: 'Weighted Average',
    authoritative: true,
    note: 'The basis the system actually carries stock at. This is what your Balance Sheet reflects.',
  },
  fifo: {
    label: 'FIFO (First In, First Out)',
    authoritative: false,
    note: 'Indicative. The oldest units are treated as sold first, so the stock remaining is valued at the most recent purchase costs.',
  },
  lifo: {
    label: 'LIFO (Last In, First Out)',
    authoritative: false,
    note: 'Indicative only — LIFO is NOT permitted under IFRS / LKAS. Shown for comparison; do not report on this basis.',
  },
};

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, dp = 2) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const movementTime = (movement = {}) =>
  String(movement.movement_date || movement.created_at || '').slice(0, 10) +
  '#' + String(movement.created_at || '');

const chronological = (movements) =>
  [...movements].sort((a, b) => movementTime(a).localeCompare(movementTime(b)));

/**
 * Replay a position into cost layers, consuming them in FIFO or LIFO order.
 * The value of what remains is the sum of the surviving layers — which is what
 * ending inventory under that method actually means.
 */
export const valueByLayers = (movements, key, method = 'fifo') => {
  const layers = []; // [{ qty, cost }] held oldest-first

  for (const movement of chronological(movements)) {
    const operation = classifyMovement(movement, key);
    if (!operation) continue;

    const qty = Math.abs(num(movement.quantity));
    if (!qty) continue;

    if (operation === 'increase') {
      // An unpriced receipt inherits the most recent known cost rather than
      // entering the books at zero.
      const cost = num(movement.cost_per_unit ?? movement.unit_cost) || (layers.at(-1)?.cost ?? 0);
      layers.push({ qty, cost });
      continue;
    }

    // Consume: FIFO eats the oldest layer first, LIFO the newest.
    let toConsume = qty;
    while (toConsume > 0 && layers.length) {
      const index = method === 'lifo' ? layers.length - 1 : 0;
      const layer = layers[index];
      const taken = Math.min(layer.qty, toConsume);
      layer.qty -= taken;
      toConsume -= taken;
      if (layer.qty <= 1e-9) layers.splice(index, 1);
    }
    // Any residue means more was issued than was ever received — the history is
    // incomplete. Reported via the quantity reconciliation below, not silently.
  }

  const quantity = round(layers.reduce((sum, l) => sum + l.qty, 0), 6);
  const totalValue = round(layers.reduce((sum, l) => sum + l.qty * l.cost, 0), 2);

  return {
    quantity,
    totalValue,
    unitCost: quantity > 0 ? round(totalValue / quantity, 6) : 0,
    layers,
  };
};

/** Replay a position as a weighted moving average — the basis stock is carried at. */
export const valueByMovingAverage = (movements, key) => {
  let quantity = 0;
  let unitCost = 0;

  for (const movement of chronological(movements)) {
    const operation = classifyMovement(movement, key);
    if (!operation) continue;

    const result = applyStockChange({
      currentQty: quantity,
      currentUnitCost: unitCost,
      quantity: num(movement.quantity),
      unitCost: num(movement.cost_per_unit ?? movement.unit_cost),
      operation,
      strict: false,
    });
    quantity = result.quantity;
    unitCost = result.unitCost;
  }

  return {
    quantity: round(quantity, 6),
    unitCost: round(unitCost, 6),
    totalValue: round(quantity * unitCost, 2),
  };
};

export const valuePosition = (movements, key, method) =>
  method === 'weighted_average'
    ? valueByMovingAverage(movements, key)
    : valueByLayers(movements, key, method);

/**
 * Group movements by the position they affect. A transfer touches two positions —
 * an issue out of one and a receipt into the other — so it appears in both.
 */
const groupMovementsByPosition = (movements = []) => {
  const byPosition = new Map();
  for (const movement of movements) {
    for (const side of ['in', 'out']) {
      const warehouse = side === 'in' ? movement.to_warehouse : movement.from_warehouse;
      if (!warehouse) continue;
      const key = [
        movement.material_code ?? '',
        warehouse,
        (side === 'in' ? movement.to_bin : movement.from_bin) ?? '',
        movement.batch_number ?? '',
      ].join('|');
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(movement);
    }
  }
  return byPosition;
};

/**
 * Build the valuation, per material, under the chosen method.
 *
 * Values every stock position from its own movement history, then rolls up by
 * material — so quantity and value always belong to each other (the old report
 * costed one warehouse and displayed the quantity of all of them).
 *
 * A position whose replayed quantity disagrees with the quantity on hand has an
 * incomplete history; its value cannot be trusted, so it is reported separately
 * rather than folded into the total.
 */
export const buildInventoryValuation = ({
  stockLevels = [],
  movements = [],
  method = 'weighted_average',
  quantityTolerance = 0.001,
} = {}) => {
  const byPosition = groupMovementsByPosition(movements);
  const byMaterial = new Map();
  const unreconciled = [];

  for (const stock of stockLevels) {
    const key = positionKey(stock);
    const history = byPosition.get(key) || [];
    const valued = valuePosition(history, key, method);

    const storedQty = num(stock.quantity);
    const code = stock.material_code;

    if (!byMaterial.has(code)) {
      byMaterial.set(code, {
        material_code: code,
        material_name: stock.material_name,
        unit_of_measure: stock.unit_of_measure,
        quantity: 0,
        totalValue: 0,
        positions: 0,
        hasUnreconciled: false,
      });
    }
    const row = byMaterial.get(code);
    row.positions += 1;

    if (Math.abs(valued.quantity - storedQty) > quantityTolerance) {
      row.hasUnreconciled = true;
      unreconciled.push({
        key,
        material_code: code,
        material_name: stock.material_name,
        warehouse_code: stock.warehouse_code,
        storedQty,
        replayedQty: valued.quantity,
        reason: history.length === 0
          ? 'No movement history — likely an opening balance loaded directly into stock.'
          : `Movements account for ${valued.quantity}, but ${storedQty} is on hand.`,
      });
      // Count the quantity so the report still shows what is physically there,
      // but contribute no value: an unverifiable cost must not inflate the total.
      row.quantity += storedQty;
      continue;
    }

    row.quantity += valued.quantity;
    row.totalValue += valued.totalValue;
  }

  const rows = [...byMaterial.values()]
    .map((row) => ({
      ...row,
      quantity: round(row.quantity, 6),
      totalValue: round(row.totalValue, 2),
      unitCost: row.quantity > 0 ? round(row.totalValue / row.quantity, 2) : 0,
    }))
    .sort((a, b) => String(a.material_code).localeCompare(String(b.material_code)));

  return {
    rows,
    unreconciled,
    totals: {
      value: round(rows.reduce((sum, r) => sum + r.totalValue, 0), 2),
      materials: rows.length,
      unreconciledCount: unreconciled.length,
    },
  };
};
