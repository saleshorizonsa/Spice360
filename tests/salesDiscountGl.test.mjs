import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceTotals } from '../src/lib/invoiceLines.js';
import { documentDiscount, lineDiscount } from '../src/lib/salesDiscount.js';
import { buildSalesInvoiceGlLines } from '../src/lib/arGlBackfill.js';

// The GL entry for a discounted sale used to debit Sales Discount *and* credit
// revenue net of the same discount, counting it twice. postJournalEntry rejects
// anything off by 0.01 or more, so every discounted invoice failed to post.
const assertBalanced = (lines, label) => {
  const debit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const credit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  assert.ok(
    Math.abs(debit - credit) < 0.01,
    `${label}: Dr ${debit.toFixed(2)} != Cr ${credit.toFixed(2)}`
  );
};

const gl = {
  ar_receivables: '1100',
  sales_discount: '5800',
  sales_revenue:  '4001',
  vat_output:     '2200',
  cash_bank:      '1010',
};

// Mirrors InvoiceForm's onSuccess journal.
const invoiceGlLines = (inv) => [
  { account_code: gl.ar_receivables, debit: inv.total_amount, credit: 0 },
  { account_code: gl.sales_discount, debit: inv.discount_total || inv.discount_amount || 0, credit: 0 },
  { account_code: gl.sales_revenue,  debit: 0, credit: Number(inv.subtotal) || 0 },
  { account_code: gl.vat_output,     debit: 0, credit: inv.tax_amount || inv.vat_amount || 0 },
].filter((l) => Number(l.debit || l.credit || 0) > 0);

// Mirrors POS.jsx createTransactionMutation.
const posGlLines = (tx) => {
  const lines = [{ account_code: gl.cash_bank, debit: tx.total_amount, credit: 0 }];
  if ((tx.discount_amount || 0) > 0) {
    lines.push({ account_code: gl.sales_discount, debit: tx.discount_amount, credit: 0 });
  }
  lines.push({ account_code: gl.sales_revenue, debit: 0, credit: tx.subtotal });
  if ((tx.vat_amount || 0) > 0) {
    lines.push({ account_code: gl.vat_output, debit: 0, credit: tx.vat_amount });
  }
  return lines;
};

// Mirrors SalesReturnForm's credit note.
const returnGlLines = (ret) => [
  { account_code: gl.sales_revenue,  debit: ret.subtotal, credit: 0 },
  { account_code: gl.vat_output,     debit: ret.vat_amount || 0, credit: 0 },
  { account_code: gl.sales_discount, debit: 0, credit: ret.discount_amount || 0 },
  { account_code: gl.ar_receivables, debit: 0, credit: ret.total_return_amount },
].filter((l) => Number(l.debit || l.credit || 0) > 0);

const invoiceFrom = (lines, taxPercent, docDiscount) => {
  const t = invoiceTotals(lines, taxPercent, docDiscount);
  return {
    subtotal: t.subtotal,
    discount_total: t.discountAmount,
    tax_amount: t.taxAmount,
    total_amount: t.total,
  };
};

test('sales invoice: a document discount posts balanced, revenue stays gross', () => {
  const inv = invoiceFrom([{ quantity: 10, unit_price: 100 }], 18, 200);
  assert.equal(inv.subtotal, 1000);
  assert.equal(inv.discount_total, 200);
  assert.equal(inv.total_amount, 944);

  const lines = invoiceGlLines(inv);
  assertBalanced(lines, 'sales invoice');
  assert.equal(lines.find((l) => l.account_code === '4001').credit, 1000, 'revenue is gross');
  assert.equal(lines.find((l) => l.account_code === '5800').debit, 200, 'discount hits 5800');
});

test('sales invoice: line-level discounts post balanced too', () => {
  const inv = invoiceFrom(
    [{ quantity: 4, unit_price: 250, discount_amount: 100 }, { quantity: 2, unit_price: 300 }],
    15,
    50
  );
  assert.equal(inv.subtotal, 1600);
  assert.equal(inv.discount_total, 150, 'line discount + document discount');
  assertBalanced(invoiceGlLines(inv), 'sales invoice with line discounts');
});

test('sales invoice: no discount still balances and never touches 5800', () => {
  const inv = invoiceFrom([{ quantity: 3, unit_price: 99.99 }], 18, 0);
  const lines = invoiceGlLines(inv);
  assertBalanced(lines, 'undiscounted invoice');
  assert.equal(lines.find((l) => l.account_code === '5800'), undefined);
});

test('sales invoice: a discount larger than the subtotal is clamped, not negative', () => {
  const inv = invoiceFrom([{ quantity: 1, unit_price: 100 }], 18, 500);
  assert.equal(inv.discount_total, 100);
  assert.equal(inv.total_amount, 0);
  assertBalanced(invoiceGlLines(inv), 'over-discounted invoice');
});

test('AR backfill builds the same balanced entry as InvoiceForm', () => {
  const inv = invoiceFrom([{ quantity: 10, unit_price: 100 }], 18, 200);
  const lines = buildSalesInvoiceGlLines(inv, gl);
  assertBalanced(lines, 'AR backfill');
  assert.equal(lines.find((l) => l.account_code === '4001').credit, 1000);
});

test('POS: a fixed cart discount posts balanced', () => {
  const cart = [{ line_total: 600, vat_rate: 18 }, { line_total: 400, vat_rate: 0 }];
  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const discount = Math.min(subtotal, Math.max(0, 150));
  const factor = (subtotal - discount) / subtotal;
  const vat = cart.reduce((s, i) => s + i.line_total * factor * (i.vat_rate / 100), 0);
  const tx = {
    subtotal,
    discount_amount: discount,
    vat_amount: vat,
    total_amount: subtotal - discount + vat,
  };
  const lines = posGlLines(tx);
  assertBalanced(lines, 'POS sale');
  assert.equal(lines.find((l) => l.account_code === '4001').credit, 1000, 'revenue is gross');
});

test('credit note reverses the discount out of 5800 and balances', () => {
  const subtotal = 10 * 100;
  const discount = documentDiscount(subtotal, 200);
  const vat = (subtotal - discount) * 0.18;
  const ret = {
    subtotal,
    discount_amount: discount,
    vat_amount: vat,
    total_return_amount: subtotal - discount + vat,
  };
  const lines = returnGlLines(ret);
  assertBalanced(lines, 'credit note');
  assert.equal(lines.find((l) => l.account_code === '5800').credit, 200, '5800 is credited back');
  assert.equal(ret.total_return_amount, 944, 'customer is credited what the invoice charged');
});

test('applying a contract price keeps the fixed discount instead of zeroing it', () => {
  // What SalesOrderForm.applyContractPrices now does: only the unit price moves.
  const line = { quantity: 4, unit_price: 250, discount_percent: 0, discount_amount: 100 };
  const repriced = { ...line, unit_price: 300 };
  const totals = lineDiscount(repriced);
  assert.equal(totals.discountAmount, 100, 'the entered discount survives the reprice');
  assert.equal(totals.lineTotal, 1100);
});
