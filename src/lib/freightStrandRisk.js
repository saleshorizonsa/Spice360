/**
 * Will the freight on this vendor invoice capitalise into product cost, or strand?
 *
 * Freight capitalises by re-averaging it into the on-hand units of the linked GRNs'
 * stock positions. If those goods have already been sold (little or nothing on
 * hand), the freight has no units to attach to — it strands, stays out of the unit
 * cost, and never rides to COGS on a sale that already happened.
 *
 * This is a heads-up heuristic for the form: it compares, per linked-GRN position,
 * the quantity received against the quantity still on hand. The exact stranded
 * amount is computed at post time by apportionLandedCost.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export const assessFreightStrand = ({ linkedGRNs = [], grns = [], stockLevels = [] } = {}) => {
  let received = 0;
  let onHand = 0;
  let atRiskPositions = 0;

  for (const ref of linkedGRNs) {
    const grn = grns.find((g) => g.grn_number === ref.grn_number);
    if (!grn) continue;

    const recvQty = num(ref.grn_quantity) || num(grn.quantity_received) || 0;
    if (recvQty <= 0) continue;
    received += recvQty;

    // Current on-hand for this GRN's exact position (material + warehouse, and bin/
    // batch when the GRN recorded them).
    const stock = stockLevels.find((s) =>
      s.material_code === grn.material_code &&
      s.warehouse_code === grn.receiving_location &&
      (!grn.storage_bin || s.bin_code === grn.storage_bin) &&
      (!grn.batch_number || s.batch_number === grn.batch_number)
    );
    const positionOnHand = num(stock?.quantity);
    onHand += positionOnHand;

    // This position's goods are (partly) gone if less is on hand than it received.
    if (positionOnHand + 0.001 < recvQty) atRiskPositions += 1;
  }

  return {
    atRisk: atRiskPositions > 0,
    receivedQty: round(received),
    onHandQty: round(onHand),
    soldQty: round(Math.max(0, received - onHand)),
    atRiskPositions,
  };
};
