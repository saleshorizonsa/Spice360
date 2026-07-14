import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findUnpostedVendorInvoices,
  findPurchaseCogsPostings,
  summariseGrniBalance,
  buildGlHealthReport,
} from '../src/lib/glHealthAudit.js';

const gl = { cogs_general: '5001', grni: '2110', inventory: '1200', trade_payables: '2100' };

// ── 1. Invoices that never reached the ledger ───────────────────────────────
test('finds approved invoices with no journal entry behind them', () => {
  const vendorInvoices = [
    { id: 'a', vendor_invoice_number: 'VI-1', status: 'approved', total_amount: 64900, freight_cost: 5000, invoice_date: '2026-02-01' },
    { id: 'b', vendor_invoice_number: 'VI-2', status: 'approved', total_amount: 59000, freight_cost: 0,    invoice_date: '2026-01-01' },
    { id: 'c', vendor_invoice_number: 'VI-3', status: 'pending_match', total_amount: 100, invoice_date: '2026-03-01' },
  ];
  // Only VI-2 actually posted (it had no transport, so its entry balanced).
  const journalEntries = [
    { journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-2' },
  ];

  const { missing, totals } = findUnpostedVendorInvoices({ vendorInvoices, journalEntries });
  assert.equal(missing.length, 1);
  assert.equal(missing[0].vendor_invoice_number, 'VI-1');
  assert.equal(totals.value, 64900);       // the FULL invoice is missing, not just the transport
  assert.equal(totals.withCharges, 1);     // and it is the one with a transport charge
});

test('an invoice not yet approved is not expected in the ledger', () => {
  const { missing } = findUnpostedVendorInvoices({
    vendorInvoices: [{ id: 'x', vendor_invoice_number: 'VI-9', status: 'pending_match', total_amount: 500 }],
    journalEntries: [],
  });
  assert.equal(missing.length, 0);
});

test('a reversed journal entry does not count as posted', () => {
  const { missing } = findUnpostedVendorInvoices({
    vendorInvoices: [{ id: 'a', vendor_invoice_number: 'VI-1', status: 'approved', total_amount: 100 }],
    journalEntries: [{ journal_number: 'JE-1', status: 'reversed', reference_type: 'vendor_invoice', reference_id: 'VI-1' }],
  });
  assert.equal(missing.length, 1);
});

// ── 2. COGS debited at purchase = double count ──────────────────────────────
test('finds COGS debited by a purchase (it is debited again on sale)', () => {
  const journalEntries = [
    { journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1', entry_date: '2026-01-01' },
    { journal_number: 'JE-2', status: 'posted', reference_type: 'invoice',        reference_id: 'INV-1', entry_date: '2026-02-01' },
  ];
  const journalLines = [
    { journal_number: 'JE-1', account_code: '5001', debit: 50000, credit: 0 }, // purchase COGS -> WRONG
    { journal_number: 'JE-1', account_code: '2100', debit: 0, credit: 59000 },
    { journal_number: 'JE-2', account_code: '5001', debit: 50000, credit: 0 }, // sale COGS -> correct
  ];

  const { entries, totals } = findPurchaseCogsPostings({ journalEntries, journalLines, cogsAccount: '5001' });
  assert.equal(totals.count, 1);            // only the purchase-side one
  assert.equal(totals.value, 50000);        // overstated COGS
  assert.equal(entries[0].reference_id, 'VI-1');
});

test('COGS from sales is never flagged', () => {
  const { totals } = findPurchaseCogsPostings({
    journalEntries: [{ journal_number: 'JE-2', status: 'posted', reference_type: 'invoice', reference_id: 'INV-1' }],
    journalLines: [{ journal_number: 'JE-2', account_code: '5001', debit: 50000, credit: 0 }],
    cogsAccount: '5001',
  });
  assert.equal(totals.count, 0);
});

// ── 3. GRNI never cleared ───────────────────────────────────────────────────
test('reports GRNI credited by GRNs but never debited back', () => {
  const journalLines = [
    { journal_number: 'JE-A', account_code: '2110', debit: 0, credit: 50000 }, // GRN 1
    { journal_number: 'JE-B', account_code: '2110', debit: 0, credit: 30000 }, // GRN 2
  ];
  const grni = summariseGrniBalance({ journalLines, grniAccount: '2110' });
  assert.equal(grni.credited, 80000);
  assert.equal(grni.debited, 0);
  assert.equal(grni.uncleared, 80000); // phantom liability
});

test('a GRNI properly cleared by its invoice nets to zero', () => {
  const journalLines = [
    { journal_number: 'JE-A', account_code: '2110', debit: 0, credit: 50000 },
    { journal_number: 'JE-B', account_code: '2110', debit: 50000, credit: 0 }, // invoice clears it
  ];
  assert.equal(summariseGrniBalance({ journalLines, grniAccount: '2110' }).uncleared, 0);
});

// ── Roll-up ─────────────────────────────────────────────────────────────────
test('a clean ledger reports healthy', () => {
  const report = buildGlHealthReport({
    vendorInvoices: [{ id: 'a', vendor_invoice_number: 'VI-1', status: 'approved', total_amount: 100 }],
    journalEntries: [{ journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1' }],
    journalLines: [
      { journal_number: 'JE-1', account_code: '2110', debit: 100, credit: 0 },
      { journal_number: 'JE-0', account_code: '2110', debit: 0, credit: 100 },
    ],
    gl,
  });
  assert.equal(report.isHealthy, true);
});

test('a damaged ledger reports unhealthy', () => {
  const report = buildGlHealthReport({
    vendorInvoices: [{ id: 'a', vendor_invoice_number: 'VI-1', status: 'approved', total_amount: 64900, freight_cost: 5000 }],
    journalEntries: [],
    journalLines: [],
    gl,
  });
  assert.equal(report.isHealthy, false);
  assert.equal(report.unposted.totals.count, 1);
});

test('missing GL mapping does not crash the audit', () => {
  const report = buildGlHealthReport({ vendorInvoices: [], journalEntries: [], journalLines: [], gl: {} });
  assert.equal(report.purchaseCogs.totals.count, 0);
  assert.equal(report.grni.uncleared, 0);
});
