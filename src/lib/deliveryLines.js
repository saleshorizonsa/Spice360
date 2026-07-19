/**
 * Line maths for delivering against a multi-line Sales Order.
 *
 * The delivery form used to read a single product_code/quantity off the SO header.
 * On a multi-line SO that header product is usually empty, so PGI failed with
 * "Product code and a positive delivered quantity are required". This models every
 * SO line, tracks what has already been delivered across prior deliveries, and
 * pre-fills each line with what is still outstanding.
 *
 * Pure and dependency-free so the quantity rules can be tested in isolation.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, dp = 6) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Total already delivered per product across prior deliveries — handling both the
 * new multi-line shape (delivery_lines: [{product_code, quantity_delivered}]) and
 * legacy single-product deliveries (product_code + quantity_delivered on the head).
 * Only PGI-posted deliveries count as delivered.
 */
export const deliveredByProduct = (priorDeliveries = []) => {
  const map = new Map();
  const add = (code, qty) => {
    if (!code) return;
    map.set(code, round((map.get(code) || 0) + num(qty)));
  };

  for (const d of priorDeliveries) {
    // Only issued stock counts, and a reversed delivery has had its issue undone —
    // its quantity is available to deliver again, so it must not count.
    if (!d || !d.pgi_done || String(d.status || '').toLowerCase() === 'reversed') continue;

    let lines = d.delivery_lines;
    if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch { lines = null; } }

    if (Array.isArray(lines) && lines.length) {
      for (const l of lines) add(l.product_code, l.quantity_delivered ?? l.quantity);
    } else {
      add(d.product_code, d.quantity_delivered); // legacy single-product delivery
    }
  }
  return map;
};

/**
 * Build the editable delivery lines for an SO: one per SO line, each pre-filled
 * with its remaining (ordered − already delivered) quantity. Lines with nothing
 * left to deliver are marked fullyDelivered.
 */
export const buildDeliveryLines = ({ soLines = [], priorDeliveries = [] } = {}) => {
  const delivered = deliveredByProduct(priorDeliveries);

  return soLines
    .map((line) => {
      const ordered = num(line.quantity);
      const already = delivered.get(line.product_code) || 0;
      const remaining = round(Math.max(0, ordered - already));
      return {
        line_number: line.line_number,
        product_code: line.product_code,
        product_name: line.product_name,
        unit_of_measure: line.unit_of_measure || '',
        unit_price: num(line.unit_price),
        quantity_ordered: ordered,
        quantity_already_delivered: already,
        quantity_remaining: remaining,
        // Default to shipping everything still outstanding; the user edits down.
        quantity_delivering: remaining,
        fullyDelivered: remaining <= 0,
      };
    });
};

/**
 * Clamp an edited "delivering now" value into [0, remaining]. Over-delivery is
 * blocked: you cannot ship more than is still outstanding on the line.
 */
export const clampDeliverQty = (value, remaining) => {
  const v = num(value);
  if (v < 0) return 0;
  const max = num(remaining);
  return v > max ? max : round(v);
};

export const totalDelivering = (lines = []) =>
  round(lines.reduce((sum, l) => sum + num(l.quantity_delivering), 0));

/**
 * Validate the lines before PGI. Returns { ok, errors, deliverable }.
 * deliverable = the lines actually being shipped (qty > 0).
 */
export const validateDeliveryLines = (lines = []) => {
  const errors = [];
  const deliverable = lines.filter((l) => num(l.quantity_delivering) > 0);

  if (deliverable.length === 0) {
    errors.push('Enter a delivery quantity on at least one line.');
  }
  for (const l of lines) {
    const q = num(l.quantity_delivering);
    if (q < 0) errors.push(`${l.product_code}: quantity cannot be negative.`);
    if (q > l.quantity_remaining + 1e-9) {
      errors.push(`${l.product_code}: delivering ${q} exceeds the ${l.quantity_remaining} still outstanding.`);
    }
  }
  return { ok: errors.length === 0, errors, deliverable };
};
