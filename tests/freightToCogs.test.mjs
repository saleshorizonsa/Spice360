import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFreightToCogsJournal } from '../src/lib/freightToCogs.js';

test('moves freight from Trade Payables into COGS, balanced', () => {
  const { lines, amount, totalDebit, totalCredit, isBalanced } = buildFreightToCogsJournal({
    amount: 7100, cogsCode: '5001', cogsName: 'Cost of Goods Sold — General',
    payablesCode: '2100', payablesName: 'Trade Payables',
  });
  const cogs = lines.find((l) => l.account_code === '5001');
  const ap = lines.find((l) => l.account_code === '2100');
  assert.equal(cogs.debit, 7100);   // freight now in cost of sold goods
  assert.equal(ap.credit, 7100);    // cancels the debit the reclass left on payables
  assert.equal(amount, 7100);
  assert.equal(totalDebit, 7100);
  assert.equal(totalCredit, 7100);
  assert.ok(isBalanced);
});

test('does NOT touch the freight liability account', () => {
  const { lines } = buildFreightToCogsJournal({ amount: 7100, cogsCode: '5001', payablesCode: '2100' });
  assert.equal(lines.find((l) => l.account_code === '2130'), undefined);
  assert.equal(lines.length, 2);
});

test('produces nothing for a zero amount or missing accounts', () => {
  assert.equal(buildFreightToCogsJournal({ amount: 0, cogsCode: '5001', payablesCode: '2100' }).lines.length, 0);
  assert.equal(buildFreightToCogsJournal({ amount: 100, payablesCode: '2100' }).lines.length, 0); // no cogs
  assert.equal(buildFreightToCogsJournal({ amount: 100, cogsCode: '5001' }).lines.length, 0);     // no payables
});

test('rounds to cents and stays balanced', () => {
  const { totalDebit, totalCredit, isBalanced } = buildFreightToCogsJournal({
    amount: 7100.005, cogsCode: '5001', payablesCode: '2100',
  });
  assert.equal(totalDebit, totalCredit);
  assert.ok(isBalanced);
});
