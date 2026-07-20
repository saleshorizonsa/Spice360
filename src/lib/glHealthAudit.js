/**
 * Read-only diagnostics for the damage left by three vendor-invoice journal defects
 * (fixed in 9b03fc7). Reports only — nothing here writes.
 *
 *   1. Invoices with a transport charge produced an unbalanced entry, so the post
 *      threw and was swallowed. The invoice saved, AP recorded it, and it never
 *      reached the GL. -> findUnpostedVendorInvoices
 *
 *   2. The entry debited COGS at purchase, while the sales invoice already debits
 *      COGS at sale. The same goods were expensed twice. -> findPurchaseCogsPostings
 *
 *   3. The GRN credits GRNI and nothing ever debited it back, so it grew forever
 *      as a phantom liability. -> summariseGrniBalance
 */

import { CORRECTION_REF_TYPE } from './cogsGrniCorrection.js';

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const isLive = (entry) => String(entry?.status || '').toLowerCase() === 'posted';

/**
 * Approved vendor invoices with no live journal entry behind them.
 * These are in AP but absent from the ledger — the books understate Trade Payables
 * and the goods by the full invoice value.
 */
export const findUnpostedVendorInvoices = ({ vendorInvoices = [], journalEntries = [] } = {}) => {
  const postedRefs = new Set(
    journalEntries
      .filter((e) => isLive(e) && e.reference_type === 'vendor_invoice')
      .map((e) => String(e.reference_id))
  );

  const shouldBePosted = (inv) =>
    ['approved', 'approved_for_payment', 'paid'].includes(String(inv?.status || '').toLowerCase());

  const missing = vendorInvoices
    .filter(shouldBePosted)
    .filter((inv) => !postedRefs.has(String(inv.vendor_invoice_number)))
    .map((inv) => ({
      id: inv.id,
      vendor_invoice_number: inv.vendor_invoice_number,
      vendor_name: inv.vendor_name,
      invoice_date: inv.invoice_date,
      status: inv.status,
      // Almost always a freight/other charge — that is what unbalanced the entry.
      freight_cost: round(num(inv.freight_cost) + num(inv.other_charges)),
      total_amount: round(num(inv.total_amount)),
    }))
    .sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date)));

  return {
    missing,
    totals: {
      count: missing.length,
      value: round(missing.reduce((sum, i) => sum + i.total_amount, 0)),
      withCharges: missing.filter((i) => i.freight_cost > 0).length,
    },
  };
};

/**
 * COGS debited by a PURCHASE. Every one of these is a double count: the sale posts
 * COGS again when the goods leave.
 *
 * Correction-aware: the reported overstatement is the gross purchase COGS minus what
 * the reclassification tool (reference_type = CORRECTION_REF_TYPE) has already
 * credited back, so this goes to zero once the correction is posted rather than
 * flagging the original entries forever.
 */
export const findPurchaseCogsPostings = ({
  journalEntries = [],
  journalLines = [],
  cogsAccount,
} = {}) => {
  if (!cogsAccount) return { entries: [], totals: { count: 0, value: 0, gross: 0, corrected: 0 } };

  const purchaseJournals = new Map(
    journalEntries
      .filter((e) => isLive(e) && e.reference_type === 'vendor_invoice')
      .map((e) => [String(e.journal_number), e])
  );

  const correctionJournals = new Set(
    journalEntries
      .filter((e) => isLive(e) && e.reference_type === CORRECTION_REF_TYPE)
      .map((e) => String(e.journal_number))
  );

  const entries = journalLines
    .filter(
      (l) =>
        String(l.account_code) === String(cogsAccount) &&
        num(l.debit) > 0 &&
        purchaseJournals.has(String(l.journal_number))
    )
    .map((l) => {
      const entry = purchaseJournals.get(String(l.journal_number));
      return {
        journal_number: l.journal_number,
        reference_id: entry?.reference_id,
        entry_date: entry?.entry_date,
        amount: round(num(l.debit)),
      };
    })
    .sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));

  const gross = round(entries.reduce((sum, e) => sum + e.amount, 0));
  const corrected = round(
    journalLines
      .filter((l) => String(l.account_code) === String(cogsAccount) && correctionJournals.has(String(l.journal_number)))
      .reduce((sum, l) => sum + num(l.credit), 0)
  );
  const value = round(Math.max(0, gross - corrected));

  return {
    entries,
    totals: {
      count: value > 0.01 ? entries.length : 0,
      value,
      gross,
      corrected,
    },
  };
};

/**
 * Net GRNI balance. GRNI is a clearing account: a GRN credits it, the vendor invoice
 * should debit it back. A large standing credit means receipts were never cleared by
 * their invoices — the liability is phantom.
 */
export const summariseGrniBalance = ({ journalLines = [], grniAccount } = {}) => {
  if (!grniAccount) return { credited: 0, debited: 0, balance: 0, uncleared: 0 };

  const lines = journalLines.filter((l) => String(l.account_code) === String(grniAccount));
  const credited = round(lines.reduce((sum, l) => sum + num(l.credit), 0));
  const debited = round(lines.reduce((sum, l) => sum + num(l.debit), 0));

  // Credit-normal liability: a positive balance is an outstanding accrual.
  const balance = round(credited - debited);

  return { credited, debited, balance, uncleared: Math.max(0, balance) };
};

/**
 * Postings on account codes that are NOT in the Chart of Accounts.
 *
 * A role mapped (or fallen back) to a code the tenant never created posts to a
 * phantom account — the money is in the ledger but off every chart-driven report
 * (this is how capitalised freight on fallback 2130 disappeared from the trial
 * balance). Grouped by account code with the net balance and the sources that
 * posted there, so every stray code shows in one list.
 *
 * Counts 'posted' and 'reversed' entries: a reversal posts a mirror and marks the
 * original 'reversed'; both are real history and net out, so a fully-reversed
 * stray nets to zero and drops off.
 */
export const findUnchartedPostings = ({ journalEntries = [], journalLines = [], accounts = [] } = {}) => {
  // Without the chart we cannot tell charted from uncharted — skip rather than
  // flag every posting as a false positive.
  if (!accounts.length) return { rows: [], totals: { count: 0, netDebit: 0, netCredit: 0 } };

  const charted = new Set(accounts.map((a) => String(a.account_code)));
  const ledgerEntry = new Map(
    journalEntries
      .filter((e) => ['posted', 'reversed'].includes(String(e?.status || '').toLowerCase()))
      .map((e) => [String(e.journal_number), e])
  );

  const byCode = new Map();
  for (const line of journalLines) {
    const code = String(line.account_code || '');
    if (!code || charted.has(code)) continue;
    const entry = ledgerEntry.get(String(line.journal_number));
    if (!entry) continue; // line belongs to a draft/never-posted entry

    if (!byCode.has(code)) byCode.set(code, { account_code: code, debit: 0, credit: 0, count: 0, sources: new Set() });
    const row = byCode.get(code);
    row.debit = round(row.debit + num(line.debit));
    row.credit = round(row.credit + num(line.credit));
    row.count += 1;
    if (entry.reference_type) row.sources.add(entry.reference_type);
  }

  const rows = [...byCode.values()]
    .map((r) => ({
      account_code: r.account_code,
      debit: r.debit,
      credit: r.credit,
      balance: round(r.debit - r.credit),
      count: r.count,
      sources: [...r.sources],
    }))
    // Only a non-zero net balance matters: a stray that has been fully reversed
    // (equal debit and credit) has no money left in it and drops off.
    .filter((r) => Math.abs(r.balance) > 0.01)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  return {
    rows,
    totals: {
      count: rows.length,
      netDebit: round(rows.reduce((s, r) => s + Math.max(0, r.balance), 0)),
      netCredit: round(rows.reduce((s, r) => s + Math.max(0, -r.balance), 0)),
    },
  };
};

export const buildGlHealthReport = ({
  vendorInvoices = [],
  journalEntries = [],
  journalLines = [],
  accounts = [],
  gl = {},
} = {}) => {
  const unposted = findUnpostedVendorInvoices({ vendorInvoices, journalEntries });
  const purchaseCogs = findPurchaseCogsPostings({
    journalEntries,
    journalLines,
    cogsAccount: gl.cogs_general,
  });
  const grni = summariseGrniBalance({ journalLines, grniAccount: gl.grni });
  const uncharted = findUnchartedPostings({ journalEntries, journalLines, accounts });

  return {
    unposted,
    purchaseCogs,
    grni,
    uncharted,
    isHealthy:
      unposted.totals.count === 0 &&
      purchaseCogs.totals.count === 0 &&
      grni.uncleared < 0.01 &&
      uncharted.totals.count === 0,
  };
};
