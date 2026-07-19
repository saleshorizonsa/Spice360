/**
 * Pure helper for reversing a GRN. A GRN that a vendor invoice still references
 * cannot be reversed — reverse/cancel the invoice first, else the invoice, AP and
 * the GRNI/inventory clearing would reference goods that were un-received.
 */

const parseRefs = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(',').map((s) => s.trim()).filter(Boolean).map((n) => ({ grn_number: n }));
    }
  }
  return [];
};

/**
 * Vendor invoices that still reference this GRN and are not cancelled.
 * Handles the grn_references array (newer) and the comma-joined grn_number string
 * (older), whether the array is stored as a JSON string or a real array.
 */
export const findBlockingVendorInvoices = (grnNumber, vendorInvoices = []) => {
  const target = String(grnNumber || '');
  if (!target) return [];

  return vendorInvoices.filter((inv) => {
    if (String(inv?.status || '').toLowerCase() === 'cancelled') return false;

    const refs = parseRefs(inv.grn_references).map((r) => String(r.grn_number || r));
    if (refs.includes(target)) return true;

    const legacy = String(inv.grn_number || '');
    return legacy === target || legacy.split(',').map((s) => s.trim()).includes(target);
  });
};
