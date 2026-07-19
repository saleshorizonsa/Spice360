/**
 * VAT applicability rules.
 *
 * VAT is NEVER charged automatically. It applies to a line only when BOTH:
 *   1. the party  (vendor on purchases / customer on sales) is VAT-activated, AND
 *   2. the item   (material / product) is VAT-activated.
 *
 * A missing `vat_applicable` flag counts as NOT activated, so every existing
 * vendor, customer and item is VAT-free until someone ticks the box. That is
 * deliberate — VAT must be opted into, never assumed.
 *
 * The resolved rate is only a DEFAULT. Document forms keep an editable VAT %
 * field, so a user can still override it on an individual document.
 */

/** True when a vendor / customer / item record has VAT switched on. */
export const isVatEnabled = (entity) => Boolean(entity?.vat_applicable);

/** True only when the party AND the item are both VAT-activated. */
export const isVatApplicable = (party, item) =>
    isVatEnabled(party) && isVatEnabled(item);

/**
 * VAT % to default a document (or line) to.
 * Returns 0 whenever the party or the item is not VAT-activated.
 * When applicable, prefers the item's own rate and falls back to the
 * organisation's standard rate.
 */
export const resolveVatRate = (party, item, standardRate = 0) => {
    if (!isVatApplicable(party, item)) return 0;
    const itemRate = Number(item?.vat_rate);
    if (Number.isFinite(itemRate) && itemRate > 0) return itemRate;
    const fallback = Number(standardRate);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

/**
 * VAT % for documents that have no single item to key off (e.g. a service
 * contract header, or a POS sale with no item context). Gated on the party only.
 */
export const resolvePartyVatRate = (party, standardRate = 0) => {
    if (!isVatEnabled(party)) return 0;
    const fallback = Number(standardRate);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

/**
 * The VAT rate a Sales Order actually charged, so a document raised FROM that SO
 * (its invoice) inherits the SO's VAT instead of re-deriving its own — which could
 * disagree with what the customer was quoted and ordered.
 *
 * Derived from the SO's stored totals (vat_amount / subtotal) so it reflects the
 * real charge regardless of how the SO computed it per line. Returns 0 for a
 * VAT-free order.
 */
export const resolveSalesOrderVatRate = (order = {}) => {
    const subtotal = Number(order?.subtotal) || 0;
    const vat = Number(order?.vat_amount) || 0;
    if (subtotal <= 0 || vat <= 0) return 0;
    // Round to 2dp to shed floating-point noise (e.g. 17.9999 -> 18).
    return Math.round((vat / subtotal) * 100 * 100) / 100;
};

/**
 * Per-line VAT for multi-line documents. `lines` carry their own `vat_rate`
 * (already resolved at item-selection time); the party flag gates all of them.
 * Returns the summed VAT amount.
 */
export const sumLineVat = (party, lines = []) => {
    if (!isVatEnabled(party)) return 0;
    return lines.reduce((sum, line) => {
        const base = Number(line?.line_total) || 0;
        const rate = Number(line?.vat_rate) || 0;
        return sum + base * (rate / 100);
    }, 0);
};
