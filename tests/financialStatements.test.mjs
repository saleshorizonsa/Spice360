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

  assert.ok(report.warnings.some((warning) => warning.type === 'unmapped_account'));
  assert.ok(report.warnings.some((warning) => warning.type === 'ledger_unbalanced'));
});

test('a posting to an account not in the COA is shown, not dropped from the trial balance', () => {
  // Regression: capitalised freight posted to a fallback account (2130) that was not
  // in the chart. The trial balance silently skipped the line, so the freight
  // vanished from the TB and the mapped freight account showed zero.
  const report = buildTrialBalance({
    accounts,
    journalEntries: [
      { id: 'f-1', status: 'posted', posting_date: '2026-01-15', account_code: '2130', credit_amount: 7100, tenant_id: 'tenant-a' },
      { id: 'f-2', status: 'posted', posting_date: '2026-01-15', account_code: '1010', debit_amount: 7100, tenant_id: 'tenant-a' },
    ],
    asOfDate: '2026-01-31',
    filters: { tenantId: 'tenant-a' },
  });

  const stray = report.rows.find((row) => row.account_code === '2130');
  assert.ok(stray, 'the unmapped-account posting must appear as its own row');
  assert.equal(stray.credit, 7100);           // the freight is visible
  assert.equal(stray.unmapped, true);
  assert.match(stray.account_name, /not in Chart of Accounts/i);
  assert.ok(report.warnings.some((w) => w.type === 'unmapped_account'));

  // The 7,100 is counted on both sides, so the trial balance still ties.
  assert.equal(report.totalDebit, 7100);
  assert.equal(report.totalCredit, 7100);
  assert.equal(report.difference, 0);

  // It stays OUT of the P&L / Balance Sheet until it is charted (no category).
  assert.equal(stray.statement_category, null);
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

// ── Regression: Cost of Sales was classified as Revenue ──────────────────────
// "cost_of_sales" contains the substring "sales", and the revenue check ran
// before the cost check — so every COGS account became credit-normal revenue.
// Cost of Sales rendered empty and the top line was understated by the COGS.
test('classifies cost_of_sales as cost of sales, not revenue', () => {
  const coa = [
    { account_code: '4001', account_name: 'Sales',    account_type: 'revenue' },
    { account_code: '5001', account_name: 'COGS',     account_type: 'cost_of_sales' },
  ];
  const entries = [
    { id: 'r', status: 'posted', entry_date: '2026-05-10', lines: [
      { account_code: '4001', debit: 0, credit: 1000000 },
      { account_code: '1100', debit: 1000000, credit: 0 }] },
    { id: 'c', status: 'posted', entry_date: '2026-05-10', lines: [
      { account_code: '5001', debit: 600000, credit: 0 },
      { account_code: '1200', debit: 0, credit: 600000 }] },
  ];
  const pl = buildProfitAndLoss({ accounts: coa, journalEntries: entries, startDate: '2026-05-01', endDate: '2026-05-31' });

  assert.equal(pl.totals.revenue, 1000000);
  assert.equal(pl.totals.costOfSales, 600000);
  assert.equal(pl.totals.grossProfit, 400000);
  assert.equal(Math.round(pl.totals.grossMarginPercent), 40);
  assert.equal(pl.sections.costOfSales.length, 1);
  assert.equal(pl.sections.revenue.length, 1); // COGS must NOT sit inside revenue
});

// ── Regression: an entry dated only by created_at (a full timestamp) ─────────
// "2026-05-10T09:30:00Z" <= "2026-05-10" is false, so it surfaced a day late.
test('includes entries dated by created_at on their own date', () => {
  const coa = [
    { account_code: '1010', account_name: 'Cash',  account_type: 'asset' },
    { account_code: '4001', account_name: 'Sales', account_type: 'revenue' },
  ];
  const entries = [{ id: 'x', status: 'posted', created_at: '2026-05-10T09:30:00.000Z', lines: [
    { account_code: '1010', debit: 1000, credit: 0 },
    { account_code: '4001', debit: 0, credit: 1000 }] }];

  assert.equal(buildTrialBalance({ accounts: coa, journalEntries: entries, asOfDate: '2026-05-10' }).totalDebit, 1000);
});

// ── Regression: balance sheet "current year profit" was all-time profit ──────
// computedFyStart was derived and then never passed in. Current-year profit must
// run from the FY start, and prior-year profit must still land in equity (as
// unclosed retained earnings) or the balance sheet goes out by that amount.
test('balance sheet reports FY-to-date profit and stays balanced', () => {
  const coa = [
    { account_code: '1010', account_name: 'Cash',              account_type: 'asset' },
    { account_code: '3900', account_name: 'Retained Earnings', account_type: 'equity' },
    { account_code: '4001', account_name: 'Sales',             account_type: 'revenue' },
  ];
  const priorYear   = { id: 'p', status: 'posted', entry_date: '2025-06-01', lines: [
    { account_code: '1010', debit: 200000, credit: 0 }, { account_code: '4001', debit: 0, credit: 200000 }] };
  const currentYear = { id: 'c', status: 'posted', entry_date: '2026-05-01', lines: [
    { account_code: '1010', debit: 50000, credit: 0 }, { account_code: '4001', debit: 0, credit: 50000 }] };

  // (a) year-end closing entries NOT posted
  const open = buildBalanceSheet({ accounts: coa, journalEntries: [priorYear, currentYear], asOfDate: '2026-06-30' });
  assert.equal(open.totals.currentYearProfit, 50000);        // not 250000
  assert.ok(Math.abs(open.totals.equity - 250000) < 0.01);
  assert.ok(Math.abs(open.totals.balanceDifference) < 0.01);

  // (b) closing entry posted — prior profit now sits in the RE account; must not double count
  const closing = { id: 'z', status: 'posted', entry_date: '2026-03-31', lines: [
    { account_code: '4001', debit: 200000, credit: 0 }, { account_code: '3900', debit: 0, credit: 200000 }] };
  const closed = buildBalanceSheet({ accounts: coa, journalEntries: [priorYear, closing, currentYear], asOfDate: '2026-06-30' });
  assert.equal(closed.totals.currentYearProfit, 50000);
  assert.ok(Math.abs(closed.totals.equity - 250000) < 0.01); // still 250k, not 450k
  assert.ok(Math.abs(closed.totals.balanceDifference) < 0.01);
});
