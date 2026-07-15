import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileInventoryToGl } from '../src/lib/inventoryGlReconciliation.js';

const gl = { inventory: '1200', grni: '2110', cogs_general: '5001' };

test('reconciles when stock book value equals the Inventory GL balance', () => {
  const stockLevels = [{ material_code: 'M', warehouse_code: 'W', bin_code: '', batch_number: '', quantity: 100, total_value: 50000 }];
  const journalEntries = [
    { journal_number: 'JE-G', status: 'posted', reference_type: 'grn' },
    { journal_number: 'JE-S', status: 'posted', reference_type: 'invoice' },
  ];
  const journalLines = [
    { journal_number: 'JE-G', account_code: '1200', debit: 60000, credit: 0 }, // received
    { journal_number: 'JE-S', account_code: '1200', debit: 0, credit: 10000 }, // sold
  ];
  const movements = [{ material_code: 'M', to_warehouse: 'W', batch_number: '', quantity: 100 }];

  const r = reconcileInventoryToGl({ stockLevels, journalEntries, journalLines, movements, gl });
  assert.equal(r.stockBookValue, 50000);
  assert.equal(r.glBalance, 50000);
  assert.equal(r.difference, 0);
  assert.ok(r.reconciled);
});

test('attributes the Inventory GL balance by source', () => {
  const journalEntries = [
    { journal_number: 'JE-G', status: 'posted', reference_type: 'grn' },
    { journal_number: 'JE-V', status: 'posted', reference_type: 'vendor_invoice' },
    { journal_number: 'JE-S', status: 'posted', reference_type: 'invoice' },
  ];
  const journalLines = [
    { journal_number: 'JE-G', account_code: '1200', debit: 60000, credit: 0 },
    { journal_number: 'JE-V', account_code: '1200', debit: 5000, credit: 0 },  // freight
    { journal_number: 'JE-S', account_code: '1200', debit: 0, credit: 10000 },
  ];
  const r = reconcileInventoryToGl({ stockLevels: [], journalEntries, journalLines, gl });
  const grn = r.bySource.find((s) => s.reference_type === 'grn');
  const vi = r.bySource.find((s) => s.reference_type === 'vendor_invoice');
  const sale = r.bySource.find((s) => s.reference_type === 'invoice');
  assert.equal(grn.net, 60000);
  assert.equal(vi.net, 5000);
  assert.equal(sale.net, -10000);
});

test('freight in the GL that never reached the stock cost shows as a gap (GL > stock)', () => {
  // Stock book excludes freight; GL includes it -> GL higher, difference negative.
  const stockLevels = [{ material_code: 'M', warehouse_code: 'W', bin_code: '', batch_number: '', quantity: 100, total_value: 50000 }];
  const journalEntries = [
    { journal_number: 'JE-G', status: 'posted', reference_type: 'grn' },
    { journal_number: 'JE-V', status: 'posted', reference_type: 'vendor_invoice' },
  ];
  const journalLines = [
    { journal_number: 'JE-G', account_code: '1200', debit: 50000, credit: 0 },
    { journal_number: 'JE-V', account_code: '1200', debit: 1267.80, credit: 0 }, // historical freight
  ];
  const movements = [{ material_code: 'M', to_warehouse: 'W', batch_number: '', quantity: 100 }];
  const r = reconcileInventoryToGl({ stockLevels, journalEntries, journalLines, movements, gl });
  assert.equal(r.glBalance, 51267.80);
  assert.equal(r.difference, -1267.80); // stock lower than GL by the uncapitalised freight
  assert.equal(r.reconciled, false);
});

test('opening-balance stock with no movements is flagged (stock > GL)', () => {
  const stockLevels = [
    { material_code: 'OPEN', warehouse_code: 'W', bin_code: '', batch_number: '', quantity: 40, total_value: 8000 },
  ];
  // No GL entries, no movements -> the 8,000 sits in stock but not in the GL.
  const r = reconcileInventoryToGl({ stockLevels, journalEntries: [], journalLines: [], movements: [], gl });
  assert.equal(r.stockBookValue, 8000);
  assert.equal(r.glBalance, 0);
  assert.equal(r.difference, 8000);
  assert.equal(r.openingBalanceValue, 8000);
  assert.equal(r.openingCount, 1);
});

test('a reversed journal is excluded from the GL balance', () => {
  const journalEntries = [{ journal_number: 'JE-G', status: 'reversed', reference_type: 'grn' }];
  const journalLines = [{ journal_number: 'JE-G', account_code: '1200', debit: 60000, credit: 0 }];
  const r = reconcileInventoryToGl({ stockLevels: [], journalEntries, journalLines, gl });
  assert.equal(r.glBalance, 0);
});

test('lines on other accounts are ignored', () => {
  const journalEntries = [{ journal_number: 'JE', status: 'posted', reference_type: 'grn' }];
  const journalLines = [
    { journal_number: 'JE', account_code: '1200', debit: 100, credit: 0 },
    { journal_number: 'JE', account_code: '2110', debit: 0, credit: 100 }, // GRNI, not inventory
  ];
  const r = reconcileInventoryToGl({ stockLevels: [], journalEntries, journalLines, gl });
  assert.equal(r.glBalance, 100);
});

test('no inventory account mapped returns not ready', () => {
  const r = reconcileInventoryToGl({ gl: {} });
  assert.equal(r.ready, false);
});
