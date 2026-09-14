import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManagementSummary } from '../src/lib/financialStatements.js';

// The financial statements' Cash Position summed BankAccount.current_balance, a
// stored figure most postings never update, so it disagreed with the dashboard and
// with the ledger itself. The report now passes the ledger cash in.

const bankAccounts = [{ current_balance: 10 }, { current_balance: 20 }];

test('a ledger cash figure takes precedence over stored bank balances', () => {
  const summary = buildManagementSummary({ bankAccounts, cashPosition: 12345.67 });
  assert.equal(summary.cashPosition, 12345.67);
});

test('a ledger figure of zero is honoured, not treated as missing', () => {
  const summary = buildManagementSummary({ bankAccounts, cashPosition: 0 });
  assert.equal(summary.cashPosition, 0);
});

test('a negative ledger cash (overdrawn) is honoured', () => {
  assert.equal(buildManagementSummary({ bankAccounts, cashPosition: -500 }).cashPosition, -500);
});

test('without a ledger figure it still falls back to the bank balances', () => {
  assert.equal(buildManagementSummary({ bankAccounts }).cashPosition, 30);
});

test('the rest of the summary is unaffected', () => {
  const summary = buildManagementSummary({
    cashPosition: 1,
    arRecords: [{ outstanding_amount: 100 }],
    apRecords: [{ outstanding_amount: 40 }],
  });
  assert.equal(summary.receivables, 100);
  assert.equal(summary.payables, 40);
});
