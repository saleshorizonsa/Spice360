/**
 * Pure helpers for paying a vendor invoice from a chosen cash/bank account.
 *
 * The payment credits the SPECIFIC account picked (petty cash, or a named bank),
 * not a single generic cash_bank code — so each cash box and bank stays separate in
 * the ledger. The debit clears Trade Payables.
 *
 *     Dr  Trade Payables      amount   (settle what is owed the vendor)
 *     Cr  <chosen cash/bank>  amount   (money leaves that account)
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const clean = (value) => String(value ?? '').trim().toLowerCase();

// Accounts you can pay OUT of: asset-type cash, bank or petty-cash accounts.
const CASH_BANK_WORDS = ['cash', 'bank', 'petty', 'till', 'current account', 'savings'];
const NON_ASSET_TYPES = new Set(['liability', 'equity', 'revenue', 'income', 'expense', 'cost_of_sales', 'unmapped']);

export const isCashBankAccount = (account = {}) => {
  if (account.is_header) return false;
  const type = clean(account.account_type || account.type);
  // Exclude anything clearly not an asset; a blank type is allowed (treated as asset).
  if (NON_ASSET_TYPES.has(type)) return false;
  const hay = `${clean(account.account_name)} ${clean(account.account_subtype || account.subtype)}`;
  return CASH_BANK_WORDS.some((w) => hay.includes(w));
};

/** Total already paid against an invoice — outgoing payments that still stand. */
export const amountPaidForInvoice = (invoiceNumber, payments = []) => {
  const target = String(invoiceNumber || '');
  if (!target) return 0;
  return round(
    payments
      .filter((p) => {
        if (String(p.reference_number || '') !== target) return false;
        if (clean(p.payment_type) === 'incoming') return false;
        return !['cancelled', 'reversed'].includes(clean(p.status));
      })
      .reduce((sum, p) => sum + num(p.amount), 0)
  );
};

/** Outstanding on an invoice = its total less what has already been paid. */
export const outstandingForInvoice = (invoice = {}, payments = []) => {
  const total = num(invoice.total_amount);
  return round(Math.max(0, total - amountPaidForInvoice(invoice.vendor_invoice_number, payments)));
};

/**
 * Validate a payment amount against the outstanding balance.
 * A tiny tolerance covers rounding on a full settlement.
 */
export const validatePaymentAmount = (amount, outstanding) => {
  const amt = num(amount);
  if (amt <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  if (amt > round(outstanding) + 0.01) {
    return { ok: false, error: `Amount exceeds the outstanding balance of ${round(outstanding).toFixed(2)}.` };
  }
  return { ok: true, error: '' };
};

export const buildVendorPaymentJournal = ({ amount = 0, payFromCode, payFromName = 'Cash & Bank', gl = {}, description = '' } = {}) => {
  const amt = round(num(amount));
  const lines = [
    {
      account_code: gl.trade_payables,
      account_name: 'Trade Payables',
      debit: amt,
      credit: 0,
      description: description ? `Payment — ${description}` : 'Vendor payment',
    },
    {
      account_code: payFromCode,
      account_name: payFromName,
      debit: 0,
      credit: amt,
      description: description ? `Paid from ${payFromName} — ${description}` : `Paid from ${payFromName}`,
    },
  ].filter((line) => line.account_code && Number(line.debit || line.credit || 0) > 0);

  const totalDebit = round(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};
