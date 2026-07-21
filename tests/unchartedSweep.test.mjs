import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSweepJournal, inferStrayAccountType } from '../src/lib/unchartedSweep.js';

// Freight stranded on 2130 as a net CREDIT (balance debit−credit = −7100).
test('sweeps a net-credit stray (freight) into the target with Dr stray / Cr target', () => {
  const { lines, amount, isBalanced } = buildSweepJournal({
    strayCode: '2130', strayName: '2130', balance: -7100,
    targetCode: '2111', targetName: 'Fright & other cost',
  });
  assert.equal(amount, 7100);
  const stray = lines.find((l) => l.account_code === '2130');
  const target = lines.find((l) => l.account_code === '2111');
  assert.equal(stray.debit, 7100);    // clears the credit sitting in 2130
  assert.equal(target.credit, 7100);  // 2111 now carries the freight liability
  assert.ok(isBalanced);
});

test('sweeps a net-debit stray into the target with Dr target / Cr stray', () => {
  const { lines, isBalanced } = buildSweepJournal({
    strayCode: '1290', balance: 5000, targetCode: '1200', targetName: 'Inventory',
  });
  const stray = lines.find((l) => l.account_code === '1290');
  const target = lines.find((l) => l.account_code === '1200');
  assert.equal(stray.credit, 5000);   // clears the debit in 1290
  assert.equal(target.debit, 5000);
  assert.ok(isBalanced);
});

test('produces nothing for a zero balance or missing accounts', () => {
  assert.equal(buildSweepJournal({ strayCode: '2130', balance: 0, targetCode: '2111' }).lines.length, 0);
  assert.equal(buildSweepJournal({ strayCode: '2130', balance: -100 }).lines.length, 0); // no target
  assert.equal(buildSweepJournal({ balance: -100, targetCode: '2111' }).lines.length, 0); // no stray
});

test('rounds to cents and balances on awkward amounts', () => {
  const { totalDebit, totalCredit, isBalanced } = buildSweepJournal({
    strayCode: '2130', balance: -33.335, targetCode: '2111',
  });
  assert.equal(totalDebit, totalCredit);
  assert.ok(isBalanced);
});

test('infers a self-consistent account type for the stray it has to create', () => {
  assert.deepEqual(inferStrayAccountType(-7100), { account_type: 'liability', normal_balance: 'credit', account_subtype: 'current_liability' });
  assert.deepEqual(inferStrayAccountType(5000), { account_type: 'asset', normal_balance: 'debit', account_subtype: 'current_asset' });
});
