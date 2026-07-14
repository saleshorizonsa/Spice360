/**
 * Journal lines for a vendor invoice.
 *
 * The previous entry was wrong in three separate ways:
 *
 *  1. UNBALANCED whenever there was a freight or other charge. It credited Trade
 *     Payables with the full invoice total but debited only the goods subtotal and
 *     the VAT — the freight was credited and never debited. assertBalanced() threw,
 *     postJournalEntry failed, and the failure was swallowed by a try/catch that
 *     showed a toast. The invoice saved, the AP record was created, and the invoice
 *     NEVER REACHED THE GENERAL LEDGER AT ALL.
 *
 *  2. COGS DOUBLE COUNTED. It debited Cost of Goods Sold at purchase time. But the
 *     sales invoice already posts Dr COGS / Cr Inventory when the goods are sold.
 *     Buying and then selling the same goods therefore expensed them twice.
 *
 *  3. GRNI NEVER CLEARED. The GRN credits Goods Received Not Invoiced; nothing ever
 *     debited it back, so it accumulated forever as a phantom liability.
 *
 * The correct purchase entry, under a perpetual inventory system:
 *
 *     Dr  Goods Received Not Invoiced   goods subtotal   (clears what the GRN accrued)
 *     Dr  Inventory                     freight + other  (landed cost, capitalised)
 *     Dr  VAT Input                     VAT
 *     Cr  Trade Payables                invoice total
 *
 * Cost only becomes an expense when the goods are SOLD (the sales invoice posts
 * Dr COGS / Cr Inventory). Inbound transport is capitalised into the carrying value
 * of the stock, which is what LKAS 2 / IAS 2 require — it is part of the cost of
 * bringing inventories to their present location and condition.
 *
 * Balance: subtotal + freight + other + vat === total, by construction.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const buildVendorInvoiceJournal = ({
  subtotal = 0,
  freightCost = 0,
  otherCharges = 0,
  vatAmount = 0,
  totalAmount = 0,
  gl = {},
  description = '',
} = {}) => {
  const goods = round(num(subtotal));
  const landed = round(num(freightCost) + num(otherCharges));
  const vat = round(num(vatAmount));
  const payable = round(num(totalAmount));

  const lines = [
    {
      account_code: gl.grni,
      account_name: 'Goods Received Not Invoiced',
      debit: goods,
      credit: 0,
      description: description ? `Clear GRNI — ${description}` : 'Clear GRNI',
    },
    {
      account_code: gl.inventory,
      account_name: 'Inventory',
      debit: landed,
      credit: 0,
      description: 'Inbound transport capitalised into stock (LKAS 2)',
    },
    {
      account_code: gl.vat_input,
      account_name: 'VAT Receivable',
      debit: vat,
      credit: 0,
      description: 'Input VAT',
    },
    {
      account_code: gl.trade_payables,
      account_name: 'Trade Payables',
      debit: 0,
      credit: payable,
      description,
    },
  ].filter((line) => Number(line.debit || line.credit || 0) > 0);

  const totalDebit = round(lines.reduce((sum, l) => sum + l.debit, 0));
  const totalCredit = round(lines.reduce((sum, l) => sum + l.credit, 0));

  return { lines, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};
