/**
 * Reclassification for the historical damage from the vendor-invoice journal defect
 * (invoices that debited COGS at purchase and never cleared GRNI).
 *
 * The correcting entry is:
 *
 *     Dr  Goods Received Not Invoiced   X
 *     Cr  Cost of Goods Sold            X
 *
 * It removes the wrong purchase-side COGS and clears the phantom GRNI in one move.
 * X is the still-uncorrected purchase COGS, which equals the uncleared GRNI when the
 * damage is exactly the paired GRN/invoice postings — as it is by construction.
 *
 * IDEMPOTENT: every correction this tool posts is tagged reference_type =
 * CORRECTION_REF_TYPE. The amount still needing correction is the gross purchase
 * COGS minus what past corrections already credited back, so re-running once it is
 * done finds nothing left to do.
 */

export const CORRECTION_REF_TYPE = 'cogs_grni_correction';
export const CORRECTION_REF_ID = 'COGS-GRNI-RECLASS';

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const isPosted = (entry) => String(entry?.status || '').toLowerCase() === 'posted';

export const computeCogsGrniCorrection = ({ journalEntries = [], journalLines = [], gl = {} } = {}) => {
  const cogs = gl.cogs_general;
  const grni = gl.grni;

  if (!cogs || !grni) {
    return { ready: false, reason: 'GL mapping is incomplete — map Cost of Goods Sold and GRNI first.', amount: 0 };
  }

  const journalsByRef = (refType) =>
    new Set(
      journalEntries
        .filter((e) => isPosted(e) && e.reference_type === refType)
        .map((e) => String(e.journal_number))
    );

  const purchaseJournals = journalsByRef('vendor_invoice');
  const correctionJournals = journalsByRef(CORRECTION_REF_TYPE);

  // Wrong COGS = COGS debited by a purchase journal.
  const grossCogs = round(
    journalLines
      .filter((l) => String(l.account_code) === String(cogs) && purchaseJournals.has(String(l.journal_number)))
      .reduce((sum, l) => sum + num(l.debit), 0)
  );

  // What earlier runs of this tool already credited back to COGS.
  const alreadyCorrected = round(
    journalLines
      .filter((l) => String(l.account_code) === String(cogs) && correctionJournals.has(String(l.journal_number)))
      .reduce((sum, l) => sum + num(l.credit), 0)
  );

  const remainingCogs = round(grossCogs - alreadyCorrected);

  // GRNI net balance across the whole ledger (credit-normal liability). Prior
  // corrections have already debited it, so this figure moves down as we go.
  const grniLines = journalLines.filter((l) => String(l.account_code) === String(grni));
  const grniCredited = round(grniLines.reduce((sum, l) => sum + num(l.credit), 0));
  const grniDebited = round(grniLines.reduce((sum, l) => sum + num(l.debit), 0));
  const grniUncleared = round(grniCredited - grniDebited);

  const amount = remainingCogs;

  // Never clear more GRNI than is actually sitting there — that would flip it into a
  // debit balance and just move the error somewhere else.
  const withinGrni = amount <= grniUncleared + 0.01;
  const reconciles = Math.abs(remainingCogs - grniUncleared) < 0.01;

  return {
    ready: amount > 0.01 && withinGrni,
    grossCogs,
    alreadyCorrected,
    remainingCogs,
    grniCredited,
    grniDebited,
    grniUncleared,
    amount,
    withinGrni,
    reconciles,
    reason:
      amount <= 0.01
        ? 'Nothing to correct — purchase-side COGS has already been reclassified.'
        : !withinGrni
          ? `The COGS overstatement (${remainingCogs}) exceeds the uncleared GRNI (${grniUncleared}). This needs manual review before posting.`
          : '',
  };
};

export const buildCorrectionJournalLines = ({ amount, gl, description }) => [
  {
    account_code: gl.grni,
    account_name: 'Goods Received Not Invoiced',
    debit: round(amount),
    credit: 0,
    description,
  },
  {
    account_code: gl.cogs_general,
    account_name: 'Cost of Goods Sold',
    debit: 0,
    credit: round(amount),
    description,
  },
];
