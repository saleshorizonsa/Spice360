import assert from 'node:assert/strict';
import test from 'node:test';
import { isFinalisedInvoice, buildArRecordFromInvoice, findInvoicesMissingAr } from '../src/lib/arFromInvoice.js';

// ── Which invoices are receivables ──────────────────────────────────────────
test('any issued invoice is a receivable — not only status "submitted"', () => {
  assert.equal(isFinalisedInvoice({ status: 'submitted' }), true);
  assert.equal(isFinalisedInvoice({ status: 'invoiced' }), true);   // the user's status
  assert.equal(isFinalisedInvoice({ status: 'paid' }), true);
  assert.equal(isFinalisedInvoice({ status: 'partially_paid' }), true);
  assert.equal(isFinalisedInvoice({ status: 'overdue' }), true);
  assert.equal(isFinalisedInvoice({ status: 'Submitted' }), true);  // case-insensitive
});

test('drafts and cancelled invoices are NOT receivables', () => {
  assert.equal(isFinalisedInvoice({ status: 'draft' }), false);
  assert.equal(isFinalisedInvoice({ status: 'cancelled' }), false);
  assert.equal(isFinalisedInvoice({ status: '' }), false);
  assert.equal(isFinalisedInvoice({}), false);
});

// ── AR payload ──────────────────────────────────────────────────────────────
test('builds an open AR item from an unpaid invoice', () => {
  const ar = buildArRecordFromInvoice(
    { invoice_number: 'INV-1', customer_name: 'Acme', total_amount: 64900, tax_amount: 9900, invoice_date: '2026-02-01' },
    'org-1'
  );
  assert.equal(ar.ar_number, 'AR-INV-1');
  assert.equal(ar.invoice_amount, 64900);
  assert.equal(ar.outstanding_amount, 64900);
  assert.equal(ar.vat_amount, 9900);
  assert.equal(ar.status, 'open');
  assert.equal(ar.organization_id, 'org-1');
});

test('a partly-paid invoice yields a partially_paid AR item with the right balance', () => {
  const ar = buildArRecordFromInvoice({ invoice_number: 'INV-2', total_amount: 100000, amount_paid: 40000 });
  assert.equal(ar.outstanding_amount, 60000);
  assert.equal(ar.status, 'partially_paid');
});

test('a fully-paid invoice yields a paid AR item with zero outstanding', () => {
  const ar = buildArRecordFromInvoice({ invoice_number: 'INV-3', total_amount: 50000, amount_paid: 50000 });
  assert.equal(ar.outstanding_amount, 0);
  assert.equal(ar.status, 'paid');
});

test('omits organization_id when none is given', () => {
  const ar = buildArRecordFromInvoice({ invoice_number: 'INV-4', total_amount: 10 });
  assert.equal('organization_id' in ar, false);
});

// ── Backfill ────────────────────────────────────────────────────────────────
test('finds finalised invoices with no AR record', () => {
  const invoices = [
    { id: 'a', invoice_number: 'INV-1', status: 'invoiced', total_amount: 100, invoice_date: '2026-01-01' },
    { id: 'b', invoice_number: 'INV-2', status: 'submitted', total_amount: 200, invoice_date: '2026-02-01' },
    { id: 'c', invoice_number: 'INV-3', status: 'draft', total_amount: 300 },            // draft → skip
  ];
  const arRecords = [{ invoice_number: 'INV-2' }];                                        // INV-2 already has AR
  const missing = findInvoicesMissingAr(invoices, arRecords);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].invoice_number, 'INV-1');
});

test('nothing missing when every finalised invoice has an AR record', () => {
  const invoices = [{ invoice_number: 'INV-1', status: 'invoiced', total_amount: 100 }];
  assert.equal(findInvoicesMissingAr(invoices, [{ invoice_number: 'INV-1' }]).length, 0);
});
