import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFreightReclassification, buildFreightReclassLines, FREIGHT_RECLASS_REF_TYPE } from '../src/lib/freightReclassification.js';

const gl = { trade_payables: '2100', freight_accrual: '2130' };

test('finds freight on posted invoices that went to Trade Payables', () => {
  const vendorInvoices = [
    { vendor_invoice_number: 'VI-1', vendor_name: 'Acme', invoice_date: '2026-01-01', freight_cost: 5000 },
    { vendor_invoice_number: 'VI-2', vendor_name: 'Beta', invoice_date: '2026-02-01', freight_cost: 3000 },
    { vendor_invoice_number: 'VI-3', vendor_name: 'Gamma', invoice_date: '2026-03-01', freight_cost: 0 }, // no freight
  ];
  const journalEntries = [
    { journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1' },
    { journal_number: 'JE-2', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-2' },
  ];
  const journalLines = [
    { journal_number: 'JE-1', account_code: '2100', debit: 0, credit: 64900 }, // freight lumped into TP
    { journal_number: 'JE-2', account_code: '2100', debit: 0, credit: 40000 },
  ];

  const r = computeFreightReclassification({ vendorInvoices, journalEntries, journalLines, gl });
  assert.ok(r.ready);
  assert.equal(r.amount, 8000);          // 5,000 + 3,000
  assert.equal(r.invoices.length, 2);
  assert.equal(r.invoices[0].vendor_invoice_number, 'VI-1'); // date-sorted
});

test('skips an invoice whose journal already has a Freight Accrual credit', () => {
  const vendorInvoices = [{ vendor_invoice_number: 'VI-1', freight_cost: 5000, invoice_date: '2026-01-01' }];
  const journalEntries = [{ journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1' }];
  const journalLines = [
    { journal_number: 'JE-1', account_code: '2100', debit: 0, credit: 59900 },
    { journal_number: 'JE-1', account_code: '2130', debit: 0, credit: 5000 }, // already split
  ];
  const r = computeFreightReclassification({ vendorInvoices, journalEntries, journalLines, gl });
  assert.equal(r.amount, 0);
  assert.equal(r.ready, false);
});

test('is idempotent — a prior aggregate reclassification nets the amount to zero', () => {
  // The vendor journal (JE-1) still shows freight in Trade Payables, but a prior
  // reclass run (JE-9) already credited Freight Accrual 5,000 — so nothing remains.
  const vendorInvoices = [{ vendor_invoice_number: 'VI-1', freight_cost: 5000, invoice_date: '2026-01-01' }];
  const journalEntries = [
    { journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1' },
    { journal_number: 'JE-9', status: 'posted', reference_type: FREIGHT_RECLASS_REF_TYPE, reference_id: 'FREIGHT-RECLASS' },
  ];
  const journalLines = [
    { journal_number: 'JE-1', account_code: '2100', debit: 0, credit: 59900 },
    { journal_number: 'JE-9', account_code: '2100', debit: 5000, credit: 0 },     // Dr TP
    { journal_number: 'JE-9', account_code: '2130', debit: 0, credit: 5000 },     // Cr Freight Accrual
  ];
  const r = computeFreightReclassification({ vendorInvoices, journalEntries, journalLines, gl });
  assert.equal(r.gross, 5000);
  assert.equal(r.alreadyReclassed, 5000);
  assert.equal(r.amount, 0);
  assert.equal(r.ready, false);
});

test('partial: a second run posts only the not-yet-reclassified remainder', () => {
  // 8,000 of freight in TP; a prior run reclassified 5,000. 3,000 remains.
  const vendorInvoices = [
    { vendor_invoice_number: 'VI-1', freight_cost: 5000, invoice_date: '2026-01-01' },
    { vendor_invoice_number: 'VI-2', freight_cost: 3000, invoice_date: '2026-02-01' },
  ];
  const journalEntries = [
    { journal_number: 'JE-1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1' },
    { journal_number: 'JE-2', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-2' },
    { journal_number: 'JE-9', status: 'posted', reference_type: FREIGHT_RECLASS_REF_TYPE, reference_id: 'FREIGHT-RECLASS' },
  ];
  const journalLines = [
    { journal_number: 'JE-1', account_code: '2100', debit: 0, credit: 59900 },
    { journal_number: 'JE-2', account_code: '2100', debit: 0, credit: 40000 },
    { journal_number: 'JE-9', account_code: '2130', debit: 0, credit: 5000 },
  ];
  const r = computeFreightReclassification({ vendorInvoices, journalEntries, journalLines, gl });
  assert.equal(r.gross, 8000);
  assert.equal(r.amount, 3000);
});

test('an invoice that never posted to the GL is not reclassified', () => {
  const vendorInvoices = [{ vendor_invoice_number: 'VI-1', freight_cost: 5000, invoice_date: '2026-01-01' }];
  const r = computeFreightReclassification({ vendorInvoices, journalEntries: [], journalLines: [], gl });
  assert.equal(r.amount, 0);
});

test('not ready when the GL mapping is incomplete', () => {
  const r = computeFreightReclassification({ gl: { trade_payables: '2100' } });
  assert.equal(r.ready, false);
  assert.match(r.reason, /Freight Accrual/);
});

test('the correcting entry moves freight from Trade Payables to Freight Accrual and balances', () => {
  const lines = buildFreightReclassLines({ amount: 8000, gl, description: 'Freight reclass' });
  const tp = lines.find((l) => l.account_code === '2100');
  const fa = lines.find((l) => l.account_code === '2130');
  assert.equal(tp.debit, 8000);   // reduce vendor payable
  assert.equal(fa.credit, 8000);  // recognise carrier liability
  assert.equal(tp.debit, fa.credit);
});
