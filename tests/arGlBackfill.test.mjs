import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasInvoiceJournal,
  assessInvoiceReflection,
  findUnreflectedInvoices,
  buildSalesInvoiceGlLines,
  buildCogsGlLines,
} from '../src/lib/arGlBackfill.js';

const gl = { ar_receivables: '1100', sales_revenue: '4001', vat_output: '2200', cogs_general: '5001', inventory: '1200' };

const je = (reference_type, reference_id, status = 'posted') => ({ reference_type, reference_id, status });

test('hasInvoiceJournal matches posted/reversed but not drafts', () => {
  const entries = [je('sales_invoice', 'INV-1'), je('sales_invoice', 'INV-2', 'draft'), je('sales_invoice', 'INV-3', 'reversed')];
  assert.equal(hasInvoiceJournal(entries, 'sales_invoice', 'INV-1'), true);
  assert.equal(hasInvoiceJournal(entries, 'sales_invoice', 'INV-2'), false); // draft doesn't count
  assert.equal(hasInvoiceJournal(entries, 'sales_invoice', 'INV-3'), true);  // reversed still on ledger
  assert.equal(hasInvoiceJournal(entries, 'sales_invoice', 'INV-9'), false);
});

test('assessInvoiceReflection flags a finalised invoice with nothing posted', () => {
  const inv = { invoice_number: 'INV-1', status: 'invoiced', total_amount: 1150, subtotal: 1000, tax_amount: 150, product_code: 'CIN-01', quantity: 10 };
  const r = assessInvoiceReflection(inv, [], []);
  assert.equal(r.needsAr, true);
  assert.equal(r.needsArGl, true);
  assert.equal(r.needsCogs, true);
});

test('assessInvoiceReflection returns null for a draft (not receivable)', () => {
  assert.equal(assessInvoiceReflection({ invoice_number: 'D-1', status: 'draft' }, [], []), null);
});

test('a fully-reflected invoice is not listed', () => {
  const inv = { invoice_number: 'INV-2', status: 'paid', total_amount: 500, subtotal: 500, product_code: 'X', quantity: 1 };
  const ar = [{ invoice_number: 'INV-2' }];
  const entries = [je('sales_invoice', 'INV-2'), je('sales_invoice_cogs', 'INV-2')];
  assert.equal(assessInvoiceReflection(inv, ar, entries).needsAr, false);
  assert.deepEqual(findUnreflectedInvoices([inv], ar, entries), []);
});

test('needsCogs is false when a Delivery already issued the goods', () => {
  const inv = { invoice_number: 'INV-3', status: 'invoiced', total_amount: 100, subtotal: 100, product_code: 'X', quantity: 1, delivery_references: ['DN-1'] };
  assert.equal(assessInvoiceReflection(inv, [], []).needsCogs, false);
});

test('needsCogs is false for a service invoice with no product', () => {
  const inv = { invoice_number: 'INV-4', status: 'invoiced', total_amount: 100, subtotal: 100 };
  assert.equal(assessInvoiceReflection(inv, [], []).needsCogs, false);
});

test('buildSalesInvoiceGlLines is balanced and drops a zero VAT line', () => {
  const withVat = buildSalesInvoiceGlLines({ total_amount: 1150, subtotal: 1000, tax_amount: 150 }, gl);
  const dr = withVat.reduce((s, l) => s + l.debit, 0);
  const cr = withVat.reduce((s, l) => s + l.credit, 0);
  assert.equal(dr, 1150);
  assert.equal(cr, 1150);
  assert.equal(withVat.length, 3);

  const noVat = buildSalesInvoiceGlLines({ total_amount: 1000, subtotal: 1000, tax_amount: 0 }, gl);
  assert.equal(noVat.length, 2); // VAT line filtered out
});

test('buildCogsGlLines returns empty when unit cost is zero', () => {
  assert.deepEqual(buildCogsGlLines({ invoice_number: 'INV-1', quantity: 5 }, 0, gl), []);
  const lines = buildCogsGlLines({ invoice_number: 'INV-1', quantity: 5, product_name: 'Cinnamon' }, 20, gl);
  assert.equal(lines[0].debit, 100);
  assert.equal(lines[1].credit, 100);
});
