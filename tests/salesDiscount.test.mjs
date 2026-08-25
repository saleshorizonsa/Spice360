import test from 'node:test';
import assert from 'node:assert/strict';
import { documentDiscount, lineDiscount, normalizeSalesLine } from '../src/lib/salesDiscount.js';
import { invoiceTotals } from '../src/lib/invoiceLines.js';
import { buildSalesInvoiceGlLines } from '../src/lib/arGlBackfill.js';

test('fixed line discount replaces a legacy percentage', () => {
  const line = normalizeSalesLine({ quantity: 2, unit_price: 100, discount_percent: 10, discount_amount: 0 });
  assert.equal(line.discount_percent, 0);
  assert.equal(line.discount_amount, 20);
  assert.equal(line.line_total, 180);
});

test('fixed discounts are capped at the gross line or document amount', () => {
  assert.deepEqual(lineDiscount({ quantity: 2, unit_price: 100, discount_amount: 250 }), {
    gross: 200, discountAmount: 200, lineTotal: 0
  });
  assert.equal(documentDiscount(100, 125), 100);
});

test('invoice totals and GL separate discount from net revenue', () => {
  const totals = invoiceTotals([{ quantity: 2, unit_price: 100, discount_amount: 20 }], 10, 10);
  assert.deepEqual(totals, {
    subtotal: 200, discountAmount: 30, taxAmount: 17, total: 187,
    totalQuantity: 2, totalDelivered: 0
  });

  const lines = buildSalesInvoiceGlLines({ total_amount: 187, subtotal: 200, discount_amount: 30, tax_amount: 17 }, {
    ar_receivables: '1100', sales_revenue: '4001', vat_output: '2200'
  });
  assert.deepEqual(lines.map(({ account_code, debit, credit }) => ({ account_code, debit, credit })), [
    { account_code: '1100', debit: 187, credit: 0 },
    { account_code: '5800', debit: 30, credit: 0 },
    { account_code: '4001', debit: 0, credit: 170 },
    { account_code: '2200', debit: 0, credit: 17 }
  ]);
});
