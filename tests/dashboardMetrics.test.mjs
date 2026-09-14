import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pendingSalesOrderCount,
  overdueScheduledCount,
  revenueInvoices,
  unpaidInvoiceCount,
  cashPositionFromLedger,
  lowStockMaterials,
} from '../src/lib/dashboardMetrics.js';

// ── Overview counts ──────────────────────────────────────────────────────────

test('pending sales orders are counted over every order, not the newest 10', () => {
  const orders = Array.from({ length: 25 }, (_, i) => ({ status: i % 2 ? 'draft' : 'pending_approval' }));
  orders.push({ status: 'confirmed' }, { status: 'delivered' });
  assert.equal(pendingSalesOrderCount(orders), 25, 'used to cap at 10');
});

test('the oldest overdue maintenance is counted — it used to fall off the list', () => {
  const today = new Date('2026-09-14T09:00:00Z');
  const items = [
    { status: 'scheduled', scheduled_date: '2025-01-05' },  // very overdue
    { status: 'scheduled', scheduled_date: '2026-09-13' },  // overdue by a day
    { status: 'scheduled', scheduled_date: '2026-09-14' },  // due today: not overdue yet
    { status: 'scheduled', scheduled_date: '2026-10-01' },  // future
    { status: 'completed', scheduled_date: '2025-01-01' },  // done
    { status: 'scheduled' },                                 // no date
  ];
  assert.equal(overdueScheduledCount(items, today), 2);
});

// ── Revenue & invoices ───────────────────────────────────────────────────────

const invoices = [
  { invoice_number: 'INV-1', status: 'issued', payment_status: 'unpaid', invoice_date: '2026-09-02', total_amount: 1000 },
  { invoice_number: 'INV-2', status: 'draft', payment_status: 'unpaid', invoice_date: '2026-09-03', total_amount: 5000 },
  { invoice_number: 'INV-3', status: 'paid', payment_status: 'paid', invoice_date: '2026-08-20', total_amount: 300 },
  { invoice_number: 'INV-4', status: 'cancelled', payment_status: 'unpaid', invoice_date: '2026-09-04', total_amount: 900 },
  { invoice_number: 'INV-5', status: 'issued', payment_status: 'overdue', invoice_date: '2026-01-15', total_amount: 200 },
];

test('draft invoices are not revenue — the old filter counted them', () => {
  const mtd = revenueInvoices(invoices, '2026-09-01').map((i) => i.invoice_number);
  assert.deepEqual(mtd, ['INV-1'], 'draft INV-2 and cancelled INV-4 excluded');
});

test('year-to-date revenue spans every issued invoice this year', () => {
  const ytd = revenueInvoices(invoices, '2026-01-01').map((i) => i.invoice_number);
  assert.deepEqual(ytd, ['INV-1', 'INV-3', 'INV-5']);
});

test('unpaid invoice count ignores drafts', () => {
  assert.equal(unpaidInvoiceCount(invoices), 2, 'INV-1 unpaid and INV-5 overdue; draft INV-2 and void INV-4 are not owed');
});

// ── Cash from the ledger ─────────────────────────────────────────────────────

const accounts = [
  { account_code: '1010', account_name: 'Cash at Bank - Sampath', account_type: 'asset', normal_balance: 'debit', opening_balance: 50000 },
  { account_code: '1011', account_name: 'Petty Cash', account_type: 'asset', normal_balance: 'debit', opening_balance: 2000 },
  { account_code: '1100', account_name: 'Trade Receivables', account_type: 'asset', normal_balance: 'debit', opening_balance: 9999 },
  { account_code: '4001', account_name: 'Sales Revenue', account_type: 'revenue', normal_balance: 'credit', opening_balance: 0 },
];

test('cash is opening balance plus posted movements on cash/bank accounts only', () => {
  const lines = [
    { journal_number: 'JE-1', account_code: '1010', debit: 15000, credit: 0 },   // customer receipt
    { journal_number: 'JE-1', account_code: '1100', debit: 0, credit: 15000 },
    { journal_number: 'JE-2', account_code: '1011', debit: 0, credit: 500 },     // petty cash spend
    { journal_number: 'JE-3', account_code: '4001', debit: 0, credit: 70000 },   // not cash
  ];
  const entries = [
    { journal_number: 'JE-1', status: 'posted' },
    { journal_number: 'JE-2', status: 'posted' },
    { journal_number: 'JE-3', status: 'posted' },
  ];
  const { total, accountCount } = cashPositionFromLedger({ accounts, lines, entries });
  assert.equal(accountCount, 2, 'receivables and revenue are not cash');
  assert.equal(total, 50000 + 15000 + 2000 - 500);
});

test('a receipt posted only to the GL moves cash — the stored bank balance never did', () => {
  const before = cashPositionFromLedger({ accounts, lines: [], entries: [] }).total;
  const after = cashPositionFromLedger({
    accounts,
    lines: [{ journal_number: 'JE-9', account_code: '1010', debit: 1234, credit: 0 }],
    entries: [{ journal_number: 'JE-9', status: 'posted' }],
  }).total;
  assert.equal(after - before, 1234);
});

test('a saved draft journal does not move cash', () => {
  const lines = [{ journal_number: 'JE-D', account_code: '1010', debit: 99999, credit: 0 }];
  const entries = [{ journal_number: 'JE-D', status: 'draft' }];
  assert.equal(cashPositionFromLedger({ accounts, lines, entries }).total, 52000);
});

test('a reversed entry and its mirror net to zero', () => {
  const lines = [
    { journal_number: 'JE-5', account_code: '1010', debit: 800, credit: 0 },
    { journal_number: 'JE-5R', account_code: '1010', debit: 0, credit: 800 },
  ];
  const entries = [
    { journal_number: 'JE-5', status: 'reversed' },
    { journal_number: 'JE-5R', status: 'posted' },
  ];
  assert.equal(cashPositionFromLedger({ accounts, lines, entries }).total, 52000);
});

test('an overdraft (credit-normal bank account) reduces cash', () => {
  const withOverdraft = [
    ...accounts,
    { account_code: '1020', account_name: 'Bank Overdraft - HNB', account_type: 'asset', normal_balance: 'credit', opening_balance: 3000 },
  ];
  assert.equal(cashPositionFromLedger({ accounts: withOverdraft }).total, 52000 - 3000);
});

test('a duplicated chart row is not counted twice', () => {
  const duplicated = [...accounts, { ...accounts[0] }];
  const lines = [{ journal_number: 'JE-1', account_code: '1010', debit: 100, credit: 0 }];
  assert.equal(cashPositionFromLedger({ accounts: duplicated, lines }).total, 52100);
});

test('no chart of accounts yet means zero, not a crash', () => {
  assert.deepEqual(cashPositionFromLedger({}), { total: 0, accountCount: 0 });
});

// ── Low stock from StockLevel ────────────────────────────────────────────────

test('low stock is judged on StockLevel quantities summed across warehouses', () => {
  const materials = [
    { material_code: 'CIN-01', status: 'active', reorder_point: 100, current_stock: 9999 },
    { material_code: 'CIN-02', status: 'active', reorder_point: 50, current_stock: 0 },
  ];
  const stockLevels = [
    { material_code: 'CIN-01', warehouse_code: 'MAIN', quantity: 40 },
    { material_code: 'CIN-01', warehouse_code: 'KANDY', quantity: 30 },
    { material_code: 'CIN-02', warehouse_code: 'MAIN', quantity: 500 },
  ];
  const low = lowStockMaterials({ materials, stockLevels });
  assert.deepEqual(low.map((m) => [m.material_code, m.on_hand]), [['CIN-01', 70]],
    'the stale current_stock field is ignored in both directions');
});

test('a material with no stock record at all has nothing on hand', () => {
  const low = lowStockMaterials({
    materials: [{ material_code: 'NEW-1', status: 'active', reorder_point: 10 }],
    stockLevels: [],
  });
  assert.deepEqual(low.map((m) => m.on_hand), [0]);
});

test('inactive materials and those without a reorder point are never flagged', () => {
  const low = lowStockMaterials({
    materials: [
      { material_code: 'A', status: 'inactive', reorder_point: 10 },
      { material_code: 'B', status: 'active', reorder_point: 0 },
    ],
    stockLevels: [],
  });
  assert.deepEqual(low, []);
});

test('the most critical shortages come first', () => {
  const low = lowStockMaterials({
    materials: [
      { material_code: 'HALF', status: 'active', reorder_point: 100 },
      { material_code: 'EMPTY', status: 'active', reorder_point: 100 },
      { material_code: 'NEAR', status: 'active', reorder_point: 100 },
    ],
    stockLevels: [
      { material_code: 'HALF', quantity: 50 },
      { material_code: 'NEAR', quantity: 95 },
    ],
  });
  assert.deepEqual(low.map((m) => m.material_code), ['EMPTY', 'HALF', 'NEAR']);
});
