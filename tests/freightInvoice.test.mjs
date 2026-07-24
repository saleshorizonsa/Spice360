import assert from 'node:assert/strict';
import test from 'node:test';
import {
  outstandingFreightAccrual,
  validateFreightInvoiceAmount,
  buildFreightInvoiceJournal,
} from '../src/lib/freightInvoice.js';

const FREIGHT = '2130';
const PAYABLES = '2100';
const PETTY = '1011';

// ── What is still accrued ───────────────────────────────────────────────────
test('outstanding accrual is credits less debits on the freight account', () => {
  const journalEntries = [
    { journal_number: 'JE-1', status: 'posted' },  // vendor invoice accrues
    { journal_number: 'JE-2', status: 'posted' },  // a carrier bill clears part
  ];
  const journalLines = [
    { journal_number: 'JE-1', account_code: FREIGHT, debit: 0, credit: 7100 },
    { journal_number: 'JE-2', account_code: FREIGHT, debit: 2000, credit: 0 },
    { journal_number: 'JE-2', account_code: PETTY,   debit: 0, credit: 2000 },
  ];
  assert.equal(outstandingFreightAccrual({ journalEntries, journalLines, freightAccrualCode: FREIGHT }), 5100);
});

test('a fully cleared accrual reads zero, never negative', () => {
  const journalEntries = [{ journal_number: 'JE-1', status: 'posted' }];
  const journalLines = [
    { journal_number: 'JE-1', account_code: FREIGHT, debit: 9000, credit: 7100 },
  ];
  assert.equal(outstandingFreightAccrual({ journalEntries, journalLines, freightAccrualCode: FREIGHT }), 0);
});

test('draft entries do not count toward the accrual', () => {
  const journalEntries = [{ journal_number: 'JE-D', status: 'draft' }];
  const journalLines = [{ journal_number: 'JE-D', account_code: FREIGHT, debit: 0, credit: 5000 }];
  assert.equal(outstandingFreightAccrual({ journalEntries, journalLines, freightAccrualCode: FREIGHT }), 0);
});

// ── Amount rules ────────────────────────────────────────────────────────────
test('allows a partial clearing (carriers bill periodically)', () => {
  assert.equal(validateFreightInvoiceAmount(2000, 7100).ok, true);
});

test('rejects zero, negative, and billing more than is accrued', () => {
  assert.equal(validateFreightInvoiceAmount(0, 7100).ok, false);
  assert.equal(validateFreightInvoiceAmount(-5, 7100).ok, false);
  const over = validateFreightInvoiceAmount(9000, 7100);
  assert.equal(over.ok, false);
  assert.match(over.error, /new cost/i);   // told to post the excess separately
});

// ── The journal, both modes ─────────────────────────────────────────────────
test('pay-now clears the accrual straight to petty cash', () => {
  const { lines, isBalanced } = buildFreightInvoiceJournal({
    amount: 2000, mode: 'pay_now',
    freightAccrualCode: FREIGHT, cashCode: PETTY, cashName: 'Petty Cash – Priyantha',
    carrierName: 'Local transporter',
  });
  assert.equal(lines.find((l) => l.account_code === FREIGHT).debit, 2000);
  assert.equal(lines.find((l) => l.account_code === PETTY).credit, 2000);
  assert.equal(lines.find((l) => l.account_code === PAYABLES), undefined); // no payable created
  assert.ok(isBalanced);
});

test('payable mode clears the accrual into Trade Payables for later settlement', () => {
  const { lines, isBalanced } = buildFreightInvoiceJournal({
    amount: 2000, mode: 'payable',
    freightAccrualCode: FREIGHT, payablesCode: PAYABLES, cashCode: PETTY,
    carrierName: 'ABC Transport',
  });
  assert.equal(lines.find((l) => l.account_code === FREIGHT).debit, 2000);
  assert.equal(lines.find((l) => l.account_code === PAYABLES).credit, 2000);
  assert.equal(lines.find((l) => l.account_code === PETTY), undefined); // cash untouched until paid
  assert.ok(isBalanced);
});

test('produces nothing without an amount or a credit account', () => {
  assert.equal(buildFreightInvoiceJournal({ amount: 0, freightAccrualCode: FREIGHT, cashCode: PETTY }).lines.length, 0);
  assert.equal(buildFreightInvoiceJournal({ amount: 100, freightAccrualCode: FREIGHT }).lines.length, 0);
  assert.equal(buildFreightInvoiceJournal({ amount: 100, cashCode: PETTY }).lines.length, 0);
});
