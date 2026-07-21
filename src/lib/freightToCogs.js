/**
 * Capitalise freight that was reclassified as a liability move (Dr Trade Payables /
 * Cr Freight Accrual) into Cost of Goods Sold, so it lands in product cost.
 *
 * When the freight reclassification ran, it debited Trade Payables — a liability
 * reduction, not a cost. The freight therefore never reached COGS. For goods that
 * are already sold, "in product cost" means "in COGS", so the correcting entry
 * moves that debit from Trade Payables to COGS:
 *
 *     Dr  Cost of Goods Sold   amount   (freight now in the cost of the sold goods)
 *     Cr  Trade Payables        amount   (cancel the freight debit left on payables)
 *
 * The freight liability (Freight Accrual, e.g. 2130) is untouched — it stays as
 * what is owed to the carrier.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const buildFreightToCogsJournal = ({
  amount = 0,
  cogsCode,
  cogsName = 'Cost of Goods Sold',
  payablesCode,
  payablesName = 'Trade Payables',
  description = '',
} = {}) => {
  const amt = round(num(amount));
  if (!cogsCode || !payablesCode || amt < 0.01) {
    return { lines: [], amount: 0, totalDebit: 0, totalCredit: 0, isBalanced: false };
  }

  const note = description || 'Capitalise inbound freight into cost of goods sold';
  const lines = [
    { account_code: cogsCode, account_name: cogsName, debit: amt, credit: 0, description: note },
    { account_code: payablesCode, account_name: payablesName, debit: 0, credit: amt, description: 'Reverse freight held in Trade Payables' },
  ];

  const totalDebit = round(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, amount: amt, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};
