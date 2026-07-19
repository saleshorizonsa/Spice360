/**
 * Line maths for a sales invoice raised against one or more delivery notes.
 *
 * The invoice form valued a single quantity x unit_price, so an order delivering
 * several products at different prices could not be billed correctly on one
 * invoice. This aggregates what was actually delivered per product across the
 * linked delivery notes, prices each from its SO line, and bills per line.
 *
 * Pure and dependency-free so the quantity/rounding rules can be tested.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, dp = 2) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const round6 = (value) => round(value, 6);

// Per-product delivered quantity from a delivery record, handling the multi-line
// shape (delivery_lines) and legacy single-product deliveries.
const deliveredLinesOf = (delivery) => {
  let lines = delivery?.delivery_lines;
  if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch { lines = null; } }
  if (Array.isArray(lines) && lines.length) {
    return lines.map((l) => ({
      product_code: l.product_code,
      product_name: l.product_name,
      unit_of_measure: l.unit_of_measure || '',
      unit_price: num(l.unit_price),
      quantity: num(l.quantity_delivered ?? l.quantity),
    }));
  }
  // Legacy: single product on the delivery header.
  if (delivery?.product_code) {
    return [{
      product_code: delivery.product_code,
      product_name: delivery.product_name,
      unit_of_measure: delivery.unit_of_measure || '',
      unit_price: num(delivery.unit_price),
      quantity: num(delivery.quantity_delivered ?? delivery.quantity),
    }];
  }
  return [];
};

/**
 * Build invoice lines by aggregating delivered quantity per product across the
 * linked deliveries. Each line defaults its billed quantity to everything
 * delivered ("pick everything"); the user edits it down for a partial bill.
 * Unit price comes from the SO line, falling back to the delivery's own price.
 *
 * @param {object} args
 * @param {Array}  args.linkedDeliveries [{ delivery_number }]
 * @param {Array}  args.deliveries        full Delivery records
 * @param {Array}  args.soLines           SalesOrderLine records for the SO
 */
export const buildInvoiceLines = ({ linkedDeliveries = [], deliveries = [], soLines = [] } = {}) => {
  const priceOf = (code) => {
    const so = soLines.find((l) => l.product_code === code);
    return so ? num(so.unit_price) : null;
  };

  const byProduct = new Map();
  const linkedNumbers = new Set(linkedDeliveries.map((d) => d.delivery_number));

  for (const del of deliveries) {
    if (!linkedNumbers.has(del.delivery_number)) continue;
    for (const line of deliveredLinesOf(del)) {
      if (!line.product_code || line.quantity <= 0) continue;
      const existing = byProduct.get(line.product_code) || {
        product_code: line.product_code,
        product_name: line.product_name,
        unit_of_measure: line.unit_of_measure,
        unit_price: priceOf(line.product_code) ?? line.unit_price,
        delivered_quantity: 0,
      };
      existing.delivered_quantity = round6(existing.delivered_quantity + line.quantity);
      byProduct.set(line.product_code, existing);
    }
  }

  return [...byProduct.values()].map((l) => ({
    ...l,
    quantity: l.delivered_quantity,       // pick everything delivered
    line_total: round(l.delivered_quantity * l.unit_price),
  }));
};

/** Clamp a billed quantity into [0, delivered] — no over-invoicing beyond delivery. */
export const clampInvoiceQty = (value, deliveredMax) => {
  const v = num(value);
  if (v < 0) return 0;
  const max = num(deliveredMax);
  return v > max ? max : round6(v);
};

/** Totals for the whole invoice: a single VAT rate applied to the summed subtotal. */
export const invoiceTotals = (lines = [], taxPercent = 0) => {
  const subtotal = round(lines.reduce((sum, l) => sum + num(l.quantity) * num(l.unit_price), 0));
  const taxAmount = round(subtotal * (num(taxPercent) / 100));
  return {
    subtotal,
    taxAmount,
    total: round(subtotal + taxAmount),
    totalQuantity: round6(lines.reduce((sum, l) => sum + num(l.quantity), 0)),
    totalDelivered: round6(lines.reduce((sum, l) => sum + num(l.delivered_quantity), 0)),
  };
};

export const validateInvoiceLines = (lines = []) => {
  const errors = [];
  const billable = lines.filter((l) => num(l.quantity) > 0);
  if (billable.length === 0) errors.push('Enter a quantity on at least one line.');
  for (const l of lines) {
    if (num(l.quantity) > num(l.delivered_quantity) + 1e-9) {
      errors.push(`${l.product_code}: billing ${num(l.quantity)} exceeds the ${num(l.delivered_quantity)} delivered.`);
    }
  }
  return { ok: errors.length === 0, errors, billable };
};
