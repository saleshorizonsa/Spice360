/**
 * A sales invoice becomes an Accounts Receivable open item once it is finalised —
 * issued to the customer — not only when its status is the exact string 'submitted'.
 *
 * The invoice→AR (and invoice→GL) trigger checked `status === 'submitted'`, so an
 * invoice saved as 'invoiced', 'paid', 'partially_paid' or 'overdue' created no AR
 * record and never posted its Dr AR / Cr Revenue entry. This is the single source
 * of truth for both, so they can't drift.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// A draft is not yet issued; a cancelled invoice is void. Everything else is a
// real, issued invoice that the customer owes against.
const NOT_RECEIVABLE = new Set(['draft', 'cancelled', 'void', 'rejected', '']);

export const isFinalisedInvoice = (invoice = {}) =>
  !NOT_RECEIVABLE.has(String(invoice?.status || '').trim().toLowerCase());

/**
 * The AR open-item payload for an invoice. Used by the invoice's auto-create, the
 * manual AR form's invoice picker, and the backfill — so all three build it the
 * same way.
 */
export const buildArRecordFromInvoice = (invoice = {}, orgId = null) => {
  const total = num(invoice.total_amount);
  const paid = num(invoice.amount_paid);
  const outstanding = Math.max(0, total - paid);

  return {
    ar_number: `AR-${invoice.invoice_number}`,
    invoice_number: invoice.invoice_number,
    customer_code: invoice.customer_code || '',
    customer_name: invoice.customer_name || '',
    invoice_date: invoice.invoice_date || '',
    due_date: invoice.due_date || '',
    invoice_amount: total,
    paid_amount: paid,
    outstanding_amount: outstanding,
    vat_amount: num(invoice.tax_amount || invoice.vat_amount),
    currency: invoice.currency || 'LKR',
    payment_terms: invoice.payment_terms || 'net_30',
    aging_days: 0,
    aging_bucket: 'current',
    // A fully-paid invoice is closed; a partly-paid one is partially_paid; else open.
    status: outstanding <= 0.01 && total > 0 ? 'paid'
      : paid > 0 ? 'partially_paid'
      : 'open',
    notes: `From Sales Invoice ${invoice.invoice_number}`,
    ...(orgId ? { organization_id: orgId } : {}),
  };
};

/**
 * Finalised invoices that have no AR record yet — for the backfill.
 * Matches on invoice_number (AR carries the source invoice number).
 */
export const findInvoicesMissingAr = (invoices = [], arRecords = []) => {
  const haveAr = new Set(arRecords.map((ar) => String(ar.invoice_number || '')));
  return invoices
    .filter(isFinalisedInvoice)
    .filter((inv) => inv.invoice_number && !haveAr.has(String(inv.invoice_number)))
    .map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      invoice_date: inv.invoice_date,
      status: inv.status,
      total_amount: num(inv.total_amount),
    }))
    .sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date)));
};
