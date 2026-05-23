import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBalanceSheet,
  buildPeriodComparison,
  buildProfitAndLoss,
  buildTrialBalance,
  normalizeLedgerEntries
} from '../src/lib/financialStatements.js';

const accounts = [
  { account_code: '1010', account_name: 'Cash', account_type: 'asset', financial_statement_category: 'current_asset', normal_balance: 'debit', opening_balance: 500, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '1200', account_name: 'Accounts Receivable', account_type: 'asset', financial_statement_category: 'current_asset', normal_balance: 'debit', opening_balance: 0, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '1300', account_name: 'Inventory', account_type: 'asset', financial_statement_category: 'current_asset', normal_balance: 'debit', opening_balance: 800, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '3000', account_name: 'Owner Capital', account_type: 'equity', financial_statement_category: 'equity', normal_balance: 'credit', opening_balance: 1300, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '4000', account_name: 'Sales Revenue', account_type: 'revenue', financial_statement_category: 'revenue', normal_balance: 'credit', opening_balance: 0, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '5000', account_name: 'Cost of Sales', account_type: 'expense', financial_statement_category: 'cost_of_sales', normal_balance: 'debit', opening_balance: 0, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '6100', account_name: 'Office Expense', account_type: 'expense', financial_statement_category: 'operating_expense', normal_balance: 'debit', opening_balance: 0, tenant_id: 'tenant-a', status: 'active' },
  { account_code: '1010', account_name: 'Other Tenant Cash', account_type: 'asset', financial_statement_category: 'current_asset', normal_balance: 'debit', opening_balance: 999, tenant_id: 'tenant-b', status: 'active' }
];

const journalEntries = [
  { id: 'sale-dr', status: 'posted', posting_date: '2026-01-15', journal_number: 'JE-001', account_code: '1200', account_name: 'Accounts Receivable', debit_amount: 1000, credit_amount: 0, tenant_id: 'tenant-a' },
  { id: 'sale-cr', status: 'posted', posting_date: '2026-01-15', journal_number: 'JE-001', account_code: '4000', account_name: 'Sales Revenue', debit_amount: 0, credit_amount: 1000, tenant_id: 'tenant-a' },
  { id: 'cogs-dr', status: 'posted', posting_date: '2026-01-16', journal_number: 'JE-002', account_code: '5000', account_name: 'Cost of Sales', debit_amount: 400, credit_amount: 0, tenant_id: 'tenant-a' },
  { id: 'cogs-cr', status: 'posted', posting_date: '2026-01-16', journal_number: 'JE-002', account_code: '1300', account_name: 'Inventory', debit_amount: 0, credit_amount: 400, tenant_id: 'tenant-a' },
  { id: 'exp-dr', status: 'posted', posting_date: '2026-01-20', journal_number: 'JE-003', account_code: '6100', account_name: 'Office Expense', debit_amount: 100, credit_amount: 0, tenant_id: 'tenant-a' },
  { id: 'exp-cr', status: 'posted', posting_date: '2026-01-20', journal_number: 'JE-003', account_code: '1010', account_name: 'Cash', debit_amount: 0, credit_amount: 100, tenant_id: 'tenant-a' },
  { id: 'ignored-draft', status: 'draft', posting_date: '2026-01-20', journal_number: 'JE-004', account_code: '4000', debit_amount: 0, credit_amount: 9999, tenant_id: 'tenant-a' },
  { id: 'other-tenant', status: 'posted', posting_date: '2026-01-20', journal_number: 'JE-005', account_code: '1010', debit_amount: 123, credit_amount: 0, tenant_id: 'tenant-b' }
];

test('normalizes one-sided and two-sided journal entry formats into ledger lines', () => {
  const normalized = normalizeLedgerEntries([
    { id: 'simple', status: 'posted', posting_date: '2026-01-01', debit_account_code: '1010', credit_account_code: '3000', amount: 250 }
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].debit, 250);
  assert.equal(normalized[1].credit, 250);
});

test('calculates P&L from posted general ledger entries', () => {
  const report = buildProfitAndLoss({
    accounts,
    journalEntries,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    filters: { tenantId: 'tenant-a' }
  });

  assert.equal(report.totals.revenue, 1000);
  assert.equal(report.totals.costOfSales, 400);
  assert.equal(report.totals.grossProfit, 600);
  assert.equal(report.totals.operatingExpenses, 100);
  assert.equal(report.totals.netProfit, 500);
});

test('calculates balance sheet with opening balances and current year profit', () => {
  const report = buildBalanceSheet({
    accounts,
    journalEntries,
    asOfDate: '2026-01-31',
    filters: { tenantId: 'tenant-a' }
  });

  assert.equal(report.totals.currentAssets, 1800);
  assert.equal(report.totals.currentYearProfit, 500);
  assert.equal(report.totals.equity, 1800);
  assert.equal(report.totals.balanceDifference, 0);
});

test('includes opening balances in trial balance', () => {
  const report = buildTrialBalance({
    accounts,
    journalEntries: [],
    asOfDate: '2026-01-01',
    filters: { tenantId: 'tenant-a' }
  });
  const cash = report.rows.find((row) => row.account_code === '1010');

  assert.equal(cash.balance, 500);
});

test('warns when ledger entries are unbalanced or unmapped', () => {
  const report = buildTrialBalance({
    accounts,
    journalEntries: [
      { id: 'bad-1', status: 'posted', posting_date: '2026-01-01', account_code: '9999', debit_amount: 50, tenant_id: 'tenant-a' },
      { id: 'bad-2', status: 'posted', posting_date: '2026-01-01', account_code: '1010', debit_amount: 25, tenant_id: 'tenant-a' }
    ],
    asOfDate: '2026-01-31',
    filters: { tenantId: 'tenant-a' }
  });

  assert.ok(report.warnings.some((warning) => warning.type === 'missing_account_mapping'));
  assert.ok(report.warnings.some((warning) => warning.type === 'ledger_unbalanced'));
});

test('drill-down transactions remain tied to the selected account', () => {
  const report = buildProfitAndLoss({
    accounts,
    journalEntries,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    filters: { tenantId: 'tenant-a' }
  });
  const revenue = report.sections.revenue[0];

  assert.equal(revenue.account_code, '4000');
  assert.equal(revenue.transactions.length, 1);
  assert.equal(revenue.transactions[0].reference_number, 'JE-001');
});

test('tenant filter excludes other tenant ledger activity and opening balances', () => {
  const report = buildTrialBalance({
    accounts,
    journalEntries,
    asOfDate: '2026-01-31',
    filters: { tenantId: 'tenant-a' }
  });
  const cash = report.rows.find((row) => row.account_code === '1010');

  assert.equal(cash.balance, 400);
  assert.equal(report.rows.filter((row) => row.account_name === 'Other Tenant Cash').length, 0);
});

test('builds monthly financial statement comparison periods', () => {
  const periods = buildPeriodComparison({
    accounts,
    journalEntries,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    mode: 'monthly',
    filters: { tenantId: 'tenant-a' }
  });

  assert.equal(periods.length, 3);
  assert.equal(periods[0].revenue, 1000);
  assert.equal(periods[0].netProfit, 500);
  assert.equal(periods[1].revenue, 0);
});
