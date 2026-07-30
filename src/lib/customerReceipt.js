/**
 * Pure helpers for receiving a customer payment against a sales invoice / AR item,
 * into a chosen cash/bank account. The mirror of vendorPayment.js.
 *
 *     Dr  <chosen cash/bank>       amount   (money arrives in that account)
 *     Cr  Accounts Receivable      amount   (settle what the customer owed)
 *
 * The receipt debits the SPECIFIC account picked (petty cash, or a named bank), not
 * one generic cash code, so each cash box and bank stays separate in the ledger.
 */

import { isCashBankAccount, validatePaymentAmount } from "./vendorPayment.js";

// Re-exported so the receipt dialog imports everything payment-related from one place.
export { isCashBankAccount, validatePaymentAmount };

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const buildCustomerReceiptJournal = ({
  amount = 0,
  receiveIntoCode,
  receiveIntoName = "Cash & Bank",
  gl = {},
  description = "",
} = {}) => {
  const amt = round(num(amount));
  const lines = [
    {
      account_code: receiveIntoCode,
      account_name: receiveIntoName,
      debit: amt,
      credit: 0,
      description: description ? `Received into ${receiveIntoName} — ${description}` : `Received into ${receiveIntoName}`,
    },
    {
      account_code: gl.ar_receivables,
      account_name: "Accounts Receivable",
      debit: 0,
      credit: amt,
      description: description ? `Receipt — ${description}` : "Customer receipt",
    },
  ].filter((line) => line.account_code && Number(line.debit || line.credit || 0) > 0);

  const totalDebit = round(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};

/**
 * Apply a receipt to an AR record and return the fields to persist.
 * Partial receipts leave the balance 'partially_paid'; a full one clears it.
 */
export const applyReceiptToAr = (ar = {}, amount = 0) => {
  const invoiceAmount = num(ar.invoice_amount);
  const newPaid = round(num(ar.paid_amount) + num(amount));
  const newOutstanding = round(Math.max(0, invoiceAmount - newPaid));
  const status = newOutstanding <= 0.01 ? "paid" : newPaid > 0 ? "partially_paid" : (ar.status || "open");
  return { paid_amount: newPaid, outstanding_amount: newOutstanding, status };
};
