/**
 * Reclassify inbound freight on already-posted vendor invoices out of Trade Payables
 * and into the Freight Accrual liability (feature b15aef8 does this for new invoices;
 * this repairs the history).
 *
 * The correcting entry is:
 *
 *     Dr  Trade Payables    X
 *     Cr  Freight Accrual   X
 *
 * X is the freight on posted vendor invoices whose journal credited it to Trade
 * Payables — i.e. the entry has NO Freight Accrual line. Freight stays capitalised
 * in inventory throughout; only the liability moves from the vendor to the carrier.
 *
 * IDEMPOTENT: every correction is tagged reference_type = FREIGHT_RECLASS_REF_TYPE.
 * An invoice already carrying a Freight Accrual credit — whether from the new posting
 * path or a prior run of this tool — is skipped, so re-running finds nothing left.
 */

export const FREIGHT_RECLASS_REF_TYPE = 'freight_reclass';
export const FREIGHT_RECLASS_REF_ID = 'FREIGHT-RECLASS';

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const isPosted = (entry) => String(entry?.status || '').toLowerCase() === 'posted';

/**
 * @returns {{ ready, amount, invoices, alreadyDone, reason }}
 *   invoices: [{ vendor_invoice_number, vendor_name, invoice_date, freight }]
 */
export const computeFreightReclassification = ({
  vendorInvoices = [],
  journalEntries = [],
  journalLines = [],
  gl = {},
} = {}) => {
  const tp = gl.trade_payables;
  const freightAcc = gl.freight_accrual;

  if (!tp || !freightAcc) {
    return { ready: false, amount: 0, invoices: [], reason: 'Map Trade Payables and Freight Accrual first.' };
  }

  // Posted vendor-invoice journals, by the invoice number they reference.
  const postedInvoiceRefs = new Map(
    journalEntries
      .filter((e) => isPosted(e) && e.reference_type === 'vendor_invoice')
      .map((e) => [String(e.reference_id), String(e.journal_number)])
  );

  // Vendor-invoice journals that already carry a Freight Accrual credit — the
  // freight went straight to its own liability on posting (new path), so there is
  // nothing to move for those.
  const vendorJournalsWithFreight = new Set(
    journalLines
      .filter((l) => String(l.account_code) === String(freightAcc) && num(l.credit) > 0)
      .map((l) => String(l.journal_number))
  );

  const invoices = [];
  for (const inv of vendorInvoices) {
    const freight = round(num(inv.freight_cost));
    if (freight <= 0.01) continue;

    const invNo = String(inv.vendor_invoice_number || '');
    const journalNo = postedInvoiceRefs.get(invNo);
    if (!journalNo) continue;                              // never posted to the GL
    if (vendorJournalsWithFreight.has(journalNo)) continue; // freight already split at posting

    invoices.push({
      vendor_invoice_number: invNo,
      vendor_name: inv.vendor_name || '',
      invoice_date: inv.invoice_date || '',
      freight,
    });
  }
  invoices.sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date)));
  const gross = round(invoices.reduce((sum, i) => sum + i.freight, 0));

  // IDEMPOTENCY (amount-based, like the COGS/GRNI tool). The tool posts one aggregate
  // entry, so per-invoice ref matching cannot see it. Instead net off what prior
  // reclassification runs already credited to Freight Accrual: once that equals the
  // gross, there is nothing left and a re-run posts nothing.
  const reclassJournals = new Set(
    journalEntries
      .filter((e) => isPosted(e) && e.reference_type === FREIGHT_RECLASS_REF_TYPE)
      .map((e) => String(e.journal_number))
  );
  const alreadyReclassed = round(
    journalLines
      .filter((l) => String(l.account_code) === String(freightAcc) && reclassJournals.has(String(l.journal_number)))
      .reduce((sum, l) => sum + num(l.credit), 0)
  );

  const amount = round(Math.max(0, gross - alreadyReclassed));

  return {
    ready: amount > 0.01,
    amount,
    gross,
    alreadyReclassed,
    invoices,
    reason: amount <= 0.01 ? 'Nothing to reclassify — all posted freight is already in Freight Accrual.' : '',
  };
};

export const buildFreightReclassLines = ({ amount, gl, description }) => [
  {
    account_code: gl.trade_payables,
    account_name: 'Trade Payables',
    debit: round(amount),
    credit: 0,
    description,
  },
  {
    account_code: gl.freight_accrual,
    account_name: 'Freight Accrual',
    debit: 0,
    credit: round(amount),
    description,
  },
];
