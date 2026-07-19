/**
 * Pure helpers for reversing a delivery note (goods issue) after PGI.
 *
 * A reversal must put the stock back at the SAME cost it was issued at and post the
 * mirror of the COGS journal, or the inventory subledger and the Inventory GL drift
 * apart — the same class of bug fixed for GRN reversal. So the issue cost is stored
 * on each delivery line at PGI (cogs_unit_cost) and read back here.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRefs = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // comma-joined "DN-1, DN-2"
      return value.split(',').map((s) => s.trim()).filter(Boolean).map((n) => ({ delivery_number: n }));
    }
  }
  return [];
};

/**
 * Invoices that still reference this delivery and are not cancelled. If any exist,
 * the delivery cannot be reversed — cancel/reverse the invoice first, else the
 * invoice, AR and revenue would reference goods that were un-issued.
 */
export const findBlockingInvoices = (deliveryNumber, invoices = []) => {
  const target = String(deliveryNumber || '');
  if (!target) return [];

  return invoices.filter((inv) => {
    if (String(inv?.status || '').toLowerCase() === 'cancelled') return false;

    // Newer invoices carry a delivery_references array; older ones a delivery_number
    // string that may hold several comma-joined numbers.
    const refs = parseRefs(inv.delivery_references).map((r) => String(r.delivery_number || r));
    if (refs.includes(target)) return true;

    const legacy = String(inv.delivery_number || '');
    return legacy === target || legacy.split(',').map((s) => s.trim()).includes(target);
  });
};

/**
 * Normalise a delivery into the lines to put back into stock: product, warehouse,
 * quantity, and the unit cost it was issued at.
 *
 * Prefers the per-line delivery_lines (multi-product deliveries). Falls back to the
 * header fields for legacy single-product deliveries. cogs_unit_cost is the cost
 * captured at PGI; when it is absent (deliveries issued before that was stored) the
 * caller falls back to the current stock cost — flagged via costKnown=false.
 */
export const reversalLinesFromDelivery = (delivery = {}) => {
  const warehouse = delivery.shipping_location || '';
  let lines = delivery.delivery_lines;
  if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch { lines = null; } }

  const out = [];
  if (Array.isArray(lines) && lines.length) {
    for (const l of lines) {
      const qty = num(l.quantity_delivered ?? l.quantity);
      if (qty <= 0) continue;
      const cost = num(l.cogs_unit_cost);
      out.push({
        product_code: l.product_code,
        product_name: l.product_name,
        unit_of_measure: l.unit_of_measure || delivery.unit_of_measure || '',
        warehouse,
        batch_number: l.batch_number || delivery.batch_number || '',
        quantity: qty,
        cost,
        costKnown: cost > 0,
      });
    }
  } else if (delivery.product_code) {
    const qty = num(delivery.quantity_delivered);
    if (qty > 0) {
      const cost = num(delivery.cogs_unit_cost);
      out.push({
        product_code: delivery.product_code,
        product_name: delivery.product_name,
        unit_of_measure: delivery.unit_of_measure || '',
        warehouse,
        batch_number: delivery.batch_number || '',
        quantity: qty,
        cost,
        costKnown: cost > 0,
      });
    }
  }
  return out;
};
