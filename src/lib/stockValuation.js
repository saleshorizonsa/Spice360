/**
 * Stock quantity + valuation maths. Pure and dependency-free so it can be tested.
 *
 * Costing method: weighted moving average. The StockLevel row carries a single
 * `unit_cost` and `total_value`, so a moving average is the only method the
 * schema can actually express (FIFO would need cost layers).
 *
 * Two defects this replaces:
 *
 * 1. `unit_cost` was never recalculated on receipt. Receiving 100 @ 50 into
 *    100 @ 10 left the cost at 10, valuing 200 units at 2,000 instead of 6,000.
 *    Inventory value drifted every time a purchase price changed.
 *
 * 2. A decrease was clamped with `Math.max(0, currentQty - qty)`. Reversing a
 *    GRN whose goods had already been issued silently wrote stock down to zero
 *    while the GL reversed the full receipt value — the ledger and the warehouse
 *    diverged with no error. A shortfall is now an explicit failure.
 */

export class StockShortfallError extends Error {
  constructor({ materialCode, warehouse, available, requested }) {
    super(
      `Cannot remove ${requested} of ${materialCode} from ${warehouse}: only ${available} on hand. ` +
      `Reverse the issue/delivery that consumed this stock first.`
    );
    this.name = 'StockShortfallError';
    this.materialCode = materialCode;
    this.warehouse = warehouse;
    this.available = available;
    this.requested = requested;
    this.shortfall = requested - available;
  }
}

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Money/quantity rounding — avoids 0.1+0.2 style drift accumulating in the ledger.
const round = (value, dp = 6) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Apply a receipt or an issue to a stock position.
 *
 * @param {object}  args
 * @param {number}  args.currentQty       quantity currently on hand
 * @param {number}  args.currentUnitCost  weighted-average cost of that quantity
 * @param {number}  args.quantity         quantity moving (always positive)
 * @param {number}  args.unitCost         cost per unit of an incoming receipt
 * @param {'increase'|'decrease'} args.operation
 * @param {boolean} args.strict           throw on shortfall instead of clamping to 0
 * @param {string}  args.materialCode     for the error message
 * @param {string}  args.warehouse        for the error message
 * @returns {{quantity:number, unitCost:number, totalValue:number}}
 */
export const applyStockChange = ({
  currentQty = 0,
  currentUnitCost = 0,
  currentTotalValue = null,
  quantity = 0,
  unitCost = 0,
  operation,
  strict = false,
  valueToRemove = null,
  materialCode = '',
  warehouse = '',
}) => {
  const onHand = num(currentQty);
  const heldCost = num(currentUnitCost);
  const qty = Math.abs(num(quantity));
  const incomingCost = num(unitCost);
  const heldValue = currentTotalValue == null ? round(onHand * heldCost, 2) : num(currentTotalValue);

  if (operation === 'increase') {
    const newQty = round(onHand + qty);

    // Weighted moving average. An incoming cost of 0 (unknown/unpriced receipt)
    // must not drag the average down, so fall back to the cost already held.
    const effectiveIncoming = incomingCost || heldCost;
    const newTotalValue = round(onHand * heldCost + qty * effectiveIncoming, 2);
    const newUnitCost = newQty > 0 ? round(newTotalValue / newQty) : effectiveIncoming;

    return { quantity: newQty, unitCost: newUnitCost, totalValue: newTotalValue };
  }

  // decrease
  if (qty > onHand) {
    if (strict) {
      throw new StockShortfallError({ materialCode, warehouse, available: onHand, requested: qty });
    }
    // Legacy clamp, kept only for callers that have not opted into strict mode.
    return { quantity: 0, unitCost: heldCost, totalValue: 0 };
  }

  const newQty = round(onHand - qty);

  // Reversing a receipt: remove exactly the VALUE that receipt added, not
  // qty x current average.
  //
  // The GL reversal is a mirror of the original entry, so it credits Inventory
  // with the original receipt value. Removing the average instead left the stock
  // subledger and the Inventory GL permanently apart by
  // qty x (original price - blended average) on every reversal.
  //
  // It also un-blends the average correctly: take back what was put in and the
  // cost returns to what it was before the receipt, rather than staying blended.
  if (valueToRemove != null) {
    const newTotalValue = newQty <= 0 ? 0 : round(heldValue - num(valueToRemove), 2);
    return {
      quantity: newQty,
      unitCost: newQty > 0 ? round(newTotalValue / newQty) : 0,
      totalValue: newTotalValue,
    };
  }

  // Ordinary issue: consuming at the moving average leaves the unit cost of what
  // remains unchanged.
  return {
    quantity: newQty,
    unitCost: heldCost,
    totalValue: round(newQty * heldCost, 2),
  };
};
