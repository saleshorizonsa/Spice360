/**
 * Apportion a vendor invoice's landed cost (freight + other charges) across the
 * stock positions it was received into, and re-average it into each per-unit cost.
 *
 * Why: the invoice capitalises freight into the Inventory GL account, but nothing
 * updated the per-unit StockLevel.unit_cost. So COGS on sale used the bare purchase
 * price while the Inventory account carried price + freight — the two drifted, the
 * balance-sheet inventory grew, and COGS was understated. This closes that gap.
 *
 * Freight is apportioned by the VALUE of goods received on each position (the
 * standard basis), then added to that position's total value and spread over the
 * quantity still on hand. The sum of the shares equals the landed cost, so the
 * stock revaluation matches the GL's Inventory debit to the cent.
 *
 * If a position has already been fully issued (qty 0) its freight cannot be spread
 * per-unit — it is reported as `stranded` rather than dividing by zero. That is a
 * genuine limitation of revaluing after the goods have gone, not a silent error.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, dp = 6) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const round2 = (value) => round(value, 2);

/**
 * @param {object} args
 * @param {Array}  args.positions   [{ id, key, receivedValue, currentQty, currentUnitCost, currentTotalValue }]
 * @param {number} args.landedCost  freight + other charges to spread
 * @returns {{ updates: Array, stranded: Array, applied: number, strandedAmount: number }}
 */
export const apportionLandedCost = ({ positions = [], landedCost = 0 } = {}) => {
  const total = round2(num(landedCost));
  const totalReceivedValue = positions.reduce((sum, p) => sum + num(p.receivedValue), 0);

  if (total <= 0 || totalReceivedValue <= 0) {
    return { updates: [], stranded: [], applied: 0, strandedAmount: 0 };
  }

  // Largest-remainder apportionment so the shares sum to exactly `landedCost`.
  const raw = positions.map((p) => ({
    p,
    exact: (total * num(p.receivedValue)) / totalReceivedValue,
  }));
  const shares = raw.map((r) => round2(Math.floor(r.exact * 100) / 100));
  let remainder = round2(total - shares.reduce((s, v) => s + v, 0));
  // Hand the leftover cents to the largest fractional parts, one cent at a time.
  const order = raw
    .map((r, i) => ({ i, frac: r.exact * 100 - Math.floor(r.exact * 100) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (remainder >= 0.01 && order.length) {
    shares[order[k % order.length].i] = round2(shares[order[k % order.length].i] + 0.01);
    remainder = round2(remainder - 0.01);
    k += 1;
  }

  const updates = [];
  const stranded = [];
  let applied = 0;
  let strandedAmount = 0;

  positions.forEach((p, i) => {
    const share = shares[i];
    if (share <= 0) return;

    const currentQty = num(p.currentQty);
    if (currentQty <= 0) {
      // Goods already gone — cannot capitalise per unit.
      stranded.push({ id: p.id, key: p.key, share });
      strandedAmount = round2(strandedAmount + share);
      return;
    }

    const newTotalValue = round2(num(p.currentTotalValue) + share);
    const newUnitCost = round(newTotalValue / currentQty, 6);
    updates.push({
      id: p.id,
      key: p.key,
      freightShare: share,
      newUnitCost,
      newTotalValue,
    });
    applied = round2(applied + share);
  });

  return { updates, stranded, applied, strandedAmount };
};
