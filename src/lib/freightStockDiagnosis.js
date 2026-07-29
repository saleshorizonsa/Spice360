import { apportionLandedCost } from "./landedCostApportionment.js";

// Diagnose (and plan the repair for) a vendor invoice whose freight never reached
// the per-unit stock cost. Pure and testable: the caller supplies the already-loaded
// invoice, GRNs and stock levels; this resolves each linked GRN to its stock position
// exactly as capitaliseLandedCostToStock intends, and reports WHERE it drops out so a
// "freight not applied" invoice can be explained rather than guessed at.
//
// Matching is done in memory over the supplied stock levels, which also side-steps
// the JSONB exact-string `.filter()` that can miss on a bin/batch mismatch.

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

const parseRefs = (raw) => {
  let refs = raw;
  if (typeof refs === "string") {
    try { refs = JSON.parse(refs); } catch { refs = []; }
  }
  return Array.isArray(refs) ? refs : [];
};

const matchStock = (stockLevels, grn) =>
  stockLevels.find((s) =>
    s.material_code === grn.material_code &&
    s.warehouse_code === grn.receiving_location &&
    (!grn.storage_bin || s.bin_code === grn.storage_bin) &&
    (!grn.batch_number || s.batch_number === grn.batch_number)
  );

/**
 * @param {object} args
 * @param {object} args.invoice       the vendor invoice (freight_cost, other_charges, grn_references)
 * @param {Array}  args.grns          all GRNs
 * @param {Array}  args.stockLevels   all stock levels
 * @returns {{ landedCost:number, rows:Array, positions:Array, plan:object, reason:string|null }}
 *   reason: null when there is freight to apply; otherwise one of
 *   'no_freight' | 'no_grn_linked' | 'stock_not_matched' | 'all_stranded' | 'nothing_to_apply'
 */
export function diagnoseFreightToStock({ invoice, grns = [], stockLevels = [] } = {}) {
  const landedCost = round2(num(invoice?.freight_cost) + num(invoice?.other_charges));
  const refs = parseRefs(invoice?.grn_references);

  const rows = [];
  const positions = [];

  for (const ref of refs) {
    const grn = grns.find((g) => g.grn_number === ref?.grn_number);
    const row = { grn_number: ref?.grn_number ?? null, grnFound: !!grn, stockMatched: false };

    if (grn) {
      row.material_code = grn.material_code;
      row.warehouse = grn.receiving_location;
      row.bin = grn.storage_bin || "";
      row.batch = grn.batch_number || "";

      const stock = matchStock(stockLevels, grn);
      if (stock) {
        const recvQty = num(ref?.grn_quantity) || num(grn.quantity_received);
        const recvCost = num(ref?.unit_cost) || num(grn.unit_price);
        row.stockMatched = true;
        row.currentQty = num(stock.quantity);
        row.currentUnitCost = num(stock.unit_cost);
        row.receivedValue = recvQty * recvCost;
        positions.push({
          id: stock.id,
          key: `${grn.material_code}|${grn.receiving_location}|${grn.storage_bin || ""}|${grn.batch_number || ""}`,
          receivedValue: row.receivedValue,
          currentQty: num(stock.quantity),
          currentUnitCost: num(stock.unit_cost),
          currentTotalValue: num(stock.total_value),
        });
      }
    }
    rows.push(row);
  }

  const plan = apportionLandedCost({ positions, landedCost });

  let reason = null;
  if (landedCost <= 0) reason = "no_freight";
  else if (refs.length === 0) reason = "no_grn_linked";
  else if (positions.length === 0) reason = "stock_not_matched";
  else if (plan.updates.length === 0 && plan.strandedAmount > 0) reason = "all_stranded";
  else if (plan.updates.length === 0) reason = "nothing_to_apply";

  return { landedCost, rows, positions, plan, reason };
}
