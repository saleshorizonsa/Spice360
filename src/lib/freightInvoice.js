/**
 * Entering the carrier's freight bill — the step that CLEARS the freight accrual.
 *
 * The vendor invoice accrues inbound freight:  Dr Inventory / Cr Freight Accrual.
 * Nothing ever debited the accrual back, so it grew forever (the same defect GRNI
 * had). This is the other half of the cycle.
 *
 * Two settlement modes, because both are real:
 *
 *   pay_now  (no carrier account, paid on the spot from petty cash / bank)
 *       Dr  Freight Accrual   amount
 *       Cr  <cash / bank>     amount
 *
 *   payable  (a transporter on credit terms — a payable to settle later)
 *       Dr  Freight Accrual   amount
 *       Cr  Trade Payables    amount
 *   …then the existing payment flow settles it:  Dr Trade Payables / Cr cash.
 *
 * Either way the accrual is debited down by exactly what the carrier billed.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const hitTheLedger = (entry) =>
  ['posted', 'reversed'].includes(String(entry?.status || '').toLowerCase());

/**
 * How much freight is still accrued and unbilled — the credit balance sitting on
 * the freight accrual account. Counts posted and reversed entries (a reversal
 * posts its own mirror, so the pair nets out).
 */
export const outstandingFreightAccrual = ({ journalEntries = [], journalLines = [], freightAccrualCode } = {}) => {
  if (!freightAccrualCode) return 0;
  const live = new Set(journalEntries.filter(hitTheLedger).map((e) => String(e.journal_number)));

  let credited = 0;
  let debited = 0;
  for (const line of journalLines) {
    if (String(line.account_code) !== String(freightAccrualCode)) continue;
    if (!live.has(String(line.journal_number))) continue;
    credited += num(line.credit);
    debited += num(line.debit);
  }
  // Credit-normal liability: what is left owed on freight.
  return round(Math.max(0, credited - debited));
};

/**
 * Amount must be positive and cannot exceed what is actually accrued — clearing
 * more would push the accrual into a debit balance, which is meaningless for a
 * liability. A carrier billing MORE than accrued is a separate cost event, not a
 * clearing, so it is deliberately not allowed through here.
 */
export const validateFreightInvoiceAmount = (amount, outstanding) => {
  const amt = num(amount);
  if (amt <= 0) return { ok: false, error: 'Enter an amount greater than zero.' };
  if (amt > round(outstanding) + 0.01) {
    return {
      ok: false,
      error: `Only ${round(outstanding).toFixed(2)} of freight is accrued. Billing more than that is a new cost — post it separately.`,
    };
  }
  return { ok: true, error: '' };
};

export const buildFreightInvoiceJournal = ({
  amount = 0,
  mode = 'pay_now',
  freightAccrualCode,
  payablesCode,
  cashCode,
  cashName = 'Cash / Bank',
  carrierName = '',
  description = '',
} = {}) => {
  const amt = round(num(amount));
  const creditCode = mode === 'payable' ? payablesCode : cashCode;
  const creditName = mode === 'payable' ? 'Trade Payables' : cashName;

  if (!freightAccrualCode || !creditCode || amt < 0.01) {
    return { lines: [], amount: 0, isBalanced: false };
  }

  const note = description || (carrierName ? `Freight invoice — ${carrierName}` : 'Freight invoice');

  const lines = [
    {
      account_code: freightAccrualCode,
      account_name: 'Accrued Freight & other cost',
      debit: amt,
      credit: 0,
      description: `Clear freight accrual — ${note}`,
    },
    {
      account_code: creditCode,
      account_name: creditName,
      debit: 0,
      credit: amt,
      description: note,
    },
  ];

  const totalDebit = round(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, amount: amt, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};
