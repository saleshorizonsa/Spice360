import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCashBankAccount,
  amountPaidForInvoice,
  outstandingForInvoice,
  validatePaymentAmount,
  buildVendorPaymentJournal,
} from '../src/lib/vendorPayment.js';

const gl = { trade_payables: '2100' };

// ── Which accounts you can pay from ─────────────────────────────────────────
test('recognises cash, bank and petty-cash asset accounts', () => {
  assert.equal(isCashBankAccount({ account_name: 'Petty Cash', account_type: 'asset' }), true);
  assert.equal(isCashBankAccount({ account_name: 'Cash in Hand', account_type: 'asset' }), true);
  assert.equal(isCashBankAccount({ account_name: 'Bank - BOC Current Account', account_type: 'asset' }), true);
  assert.equal(isCashBankAccount({ account_name: 'Cash at Bank' }), true); // blank type allowed
});

test('rejects non-cash and non-asset accounts', () => {
  assert.equal(isCashBankAccount({ account_name: 'Trade Payables', account_type: 'liability' }), false);
  assert.equal(isCashBankAccount({ account_name: 'Inventory', account_type: 'asset' }), false);
  assert.equal(isCashBankAccount({ account_name: 'Bank Charges', account_type: 'expense' }), false); // expense, not asset
  assert.equal(isCashBankAccount({ account_name: 'Cash', is_header: true, account_type: 'asset' }), false); // header
});

// ── Outstanding / already paid ──────────────────────────────────────────────
const invoice = { vendor_invoice_number: 'VI-1', total_amount: 100000 };

test('sums prior outgoing payments against an invoice', () => {
  const payments = [
    { reference_number: 'VI-1', payment_type: 'outgoing', status: 'cleared', amount: 30000 },
    { reference_number: 'VI-1', payment_type: 'outgoing', status: 'cleared', amount: 20000 },
    { reference_number: 'VI-2', payment_type: 'outgoing', status: 'cleared', amount: 99999 }, // other invoice
    { reference_number: 'VI-1', payment_type: 'incoming', status: 'cleared', amount: 5000 },   // not a payment out
    { reference_number: 'VI-1', payment_type: 'outgoing', status: 'reversed', amount: 10000 }, // reversed, ignored
  ];
  assert.equal(amountPaidForInvoice('VI-1', payments), 50000);
  assert.equal(outstandingForInvoice(invoice, payments), 50000);
});

test('outstanding never goes below zero', () => {
  const payments = [{ reference_number: 'VI-1', payment_type: 'outgoing', status: 'cleared', amount: 120000 }];
  assert.equal(outstandingForInvoice(invoice, payments), 0);
});

test('a fresh invoice is fully outstanding', () => {
  assert.equal(outstandingForInvoice(invoice, []), 100000);
});

// ── Amount validation (partials allowed) ────────────────────────────────────
test('accepts a partial payment within the outstanding balance', () => {
  assert.deepEqual(validatePaymentAmount(40000, 50000), { ok: true, error: '' });
});

test('rejects zero, negative, and over-payment', () => {
  assert.equal(validatePaymentAmount(0, 50000).ok, false);
  assert.equal(validatePaymentAmount(-10, 50000).ok, false);
  assert.equal(validatePaymentAmount(60000, 50000).ok, false);
});

test('allows an exact full settlement despite rounding', () => {
  assert.equal(validatePaymentAmount(50000.004, 50000).ok, true);
});

// ── The journal ─────────────────────────────────────────────────────────────
test('posts Dr Trade Payables / Cr the chosen cash-bank account, balanced', () => {
  const { lines, isBalanced, totalDebit, totalCredit } = buildVendorPaymentJournal({
    amount: 50000, payFromCode: '1020', payFromName: 'Bank - BOC', gl, description: 'VI-1',
  });
  const ap = lines.find((l) => l.account_code === '2100');
  const bank = lines.find((l) => l.account_code === '1020');
  assert.equal(ap.debit, 50000);
  assert.equal(bank.credit, 50000);
  assert.equal(totalDebit, 50000);
  assert.equal(totalCredit, 50000);
  assert.ok(isBalanced);
});

test('credits the specific account chosen, so petty cash and banks stay separate', () => {
  const petty = buildVendorPaymentJournal({ amount: 1000, payFromCode: '1010', payFromName: 'Petty Cash', gl });
  assert.equal(petty.lines.find((l) => l.credit > 0).account_code, '1010');
});
