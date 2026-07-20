import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestGlMapping, findUnknownMappings } from '../src/lib/glAccountAutoMap.js';

// A realistic Sri Lankan chart, containing the exact trap that caused the bug:
// 2100 is ACCRUED EXPENSES, but the hard-coded default for trade_payables was
// "2100" — so vendor invoices credited Accrued Expenses instead of Trade Payables.
const coa = [
  { account_code: '1010', account_name: 'Cash in Hand',                account_type: 'asset' },
  { account_code: '1020', account_name: 'Cash at Bank',                account_type: 'asset' },
  { account_code: '1100', account_name: 'Trade Receivables',           account_type: 'asset' },
  { account_code: '1200', account_name: 'Inventory - Raw Materials',   account_type: 'asset' },
  { account_code: '1250', account_name: 'VAT Input (Recoverable)',     account_type: 'asset' },
  { account_code: '1400', account_name: 'Property, Plant & Equipment', account_type: 'asset' },
  { account_code: '1410', account_name: 'Accumulated Depreciation',    account_type: 'asset' },
  { account_code: '2050', account_name: 'Trade Payables',              account_type: 'liability' },
  { account_code: '2100', account_name: 'Accrued Expenses',            account_type: 'liability' },
  { account_code: '2110', account_name: 'Goods Received Not Invoiced', account_type: 'liability' },
  { account_code: '2200', account_name: 'VAT Output (Payable)',        account_type: 'liability' },
  { account_code: '4001', account_name: 'Sales Revenue',               account_type: 'revenue' },
  { account_code: '5001', account_name: 'Cost of Goods Sold',          account_type: 'cost_of_sales' },
  { account_code: '5500', account_name: 'Depreciation Expense',        account_type: 'expense' },
  { account_code: '2000', account_name: 'LIABILITIES',                 account_type: 'liability', is_header: true },
];

test('maps trade payables to Trade Payables, never to Accrued Expenses', () => {
  const s = suggestGlMapping(coa);
  assert.equal(s.trade_payables, '2050');
  assert.notEqual(s.trade_payables, '2100');
  // Accrued Expenses must not be silently picked up by any role.
  assert.ok(!Object.values(s).includes('2100'));
});

test('matches the core purchasing/inventory roles against the real chart', () => {
  const s = suggestGlMapping(coa);
  assert.equal(s.inventory, '1200');
  assert.equal(s.grni, '2110');
  assert.equal(s.cogs_general, '5001');
  assert.equal(s.vat_input, '1250');
  assert.equal(s.vat_output, '2200');
  assert.equal(s.ar_receivables, '1100');
  assert.equal(s.sales_revenue, '4001');
  assert.equal(s.accum_depreciation, '1410');
  assert.equal(s.fixed_asset_cost, '1400');
});

test('never suggests a header account (nothing can be posted to it)', () => {
  const s = suggestGlMapping(coa);
  assert.ok(!Object.values(s).includes('2000'));
});

test('matches a freight liability account, including the common "Fright & other cost" spelling', () => {
  const withFreight = [
    ...coa,
    { account_code: '2111', account_name: 'Fright & other cost', account_type: 'liability' },
  ];
  assert.equal(suggestGlMapping(withFreight).freight_accrual, '2111');

  // and a correctly-spelled variant
  const variant = [{ account_code: '2130', account_name: 'Freight Payable', account_type: 'liability' }];
  assert.equal(suggestGlMapping(variant).freight_accrual, '2130');
});

test('suggests nothing rather than guessing when no account matches', () => {
  const s = suggestGlMapping([{ account_code: '9999', account_name: 'Suspense', account_type: 'asset' }]);
  assert.equal(s.trade_payables, undefined);
  assert.equal(s.cogs_general, undefined);
});

test('flags mapped codes that do not exist in the chart of accounts', () => {
  // 2210 is the old hard-coded vat_input default and is absent from this chart.
  const unknown = findUnknownMappings({ trade_payables: '2050', vat_input: '2210' }, coa);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].role, 'vat_input');
  assert.equal(unknown[0].code, '2210');
});

test('a fully valid mapping raises no flags', () => {
  assert.deepEqual(findUnknownMappings({ trade_payables: '2050', inventory: '1200' }, coa), []);
});
