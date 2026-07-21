/**
 * Move the balance sitting on an uncharted account (one with postings but not in
 * the Chart of Accounts, e.g. the freight fallback 2130) into a real account.
 *
 * You cannot post to an account that is not in the chart — postJournalEntry rejects
 * it. So the sweep: (1) create the stray code in the chart so the entry validates,
 * (2) post a journal that zeroes the stray into the target, (3) retire the stray.
 * This module is the pure part: the journal and the type to create the stray as.
 *
 * `balance` is debit − credit (as findUnchartedPostings reports it):
 *   balance < 0  → the stray holds a net CREDIT (a liability, like freight). Zero it
 *                  with Dr stray / Cr target — the target receives the credit.
 *   balance > 0  → the stray holds a net DEBIT (an asset). Zero it with
 *                  Cr stray / Dr target.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// How to create the stray account so posting is allowed. It is retired straight
// after, so the type only has to be self-consistent with its balance.
export const inferStrayAccountType = (balance) =>
  num(balance) < 0
    ? { account_type: 'liability', normal_balance: 'credit', account_subtype: 'current_liability' }
    : { account_type: 'asset', normal_balance: 'debit', account_subtype: 'current_asset' };

export const buildSweepJournal = ({
  strayCode,
  strayName = '',
  balance = 0,
  targetCode,
  targetName = '',
  description = '',
} = {}) => {
  const bal = num(balance);
  const amt = round(Math.abs(bal));
  if (!strayCode || !targetCode || amt < 0.01) {
    return { lines: [], amount: 0, isBalanced: false };
  }

  const strayLabel = strayName || String(strayCode);
  const targetLabel = targetName || String(targetCode);
  const note = description || `Sweep ${strayCode} → ${targetCode}`;

  // Zero the stray, move its balance to the target.
  const lines = bal < 0
    ? [
        { account_code: strayCode,  account_name: strayLabel,  debit: amt, credit: 0,   description: `Clear ${strayCode}` },
        { account_code: targetCode, account_name: targetLabel, debit: 0,   credit: amt, description: note },
      ]
    : [
        { account_code: targetCode, account_name: targetLabel, debit: amt, credit: 0,   description: note },
        { account_code: strayCode,  account_name: strayLabel,  debit: 0,   credit: amt, description: `Clear ${strayCode}` },
      ];

  const totalDebit = round(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, amount: amt, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};
