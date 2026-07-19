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
 *     Cr  Freight Accrual               freight          (owed to the 3rd-party carrier)
 *     Cr  Trade Payables                total − freight  (owed to the material vendor)
 *
 * Freight is billed by a separate carrier, not the material vendor, so it is NOT
 * owed to the vendor — it is credited to its own Freight Accrual liability and
 * cleared when the carrier's own invoice is entered. It is STILL capitalised into
 * inventory (the Inventory debit above, and the moving-average cost), which is what
 * LKAS 2 / IAS 2 require. Only freight is split out this way; other charges stay in
 * Trade Payables. If no freight-accrual account is mapped, freight falls back into
 * Trade Payables (the prior behaviour), so nothing breaks before it is configured.
 *
 * Cost only becomes an expense when the goods are SOLD (the sales invoice posts
 * Dr COGS / Cr Inventory).
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

  // Freight goes to its own liability (owed to the carrier), not to the vendor —
  // but only if a freight-accrual account is mapped. Without one it stays in Trade
  // Payables so the entry still balances before the account is configured.
  const freight = gl.freight_accrual ? round(num(freightCost)) : 0;
  const payable = round(num(totalAmount) - freight);

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
      account_code: gl.freight_accrual,
      account_name: 'Freight Accrual',
      debit: 0,
      credit: freight,
      description: description ? `Inbound freight — ${description}` : 'Inbound freight (carrier)',
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
