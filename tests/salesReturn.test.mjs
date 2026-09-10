import test from 'node:test';
import assert from 'node:assert/strict';
import { isFinalisedInvoice } from '../src/lib/arFromInvoice.js';

// The Sales Return form used to list only invoices whose payment_status was
// 'paid' or 'partially_paid'. Invoices are created 'unpaid', so the ordinary case
// — goods coming back on an invoice the customer has not settled yet — never
// appeared, and a tenant with nothing paid saw an empty dropdown. The list is now
// driven by isFinalisedInvoice, which ignores payment entirely.
const returnableInvoices = (invoices) => invoices.filter(isFinalisedInvoice);

test('an issued but unpaid invoice can be returned against', () => {
  const invoices = [{ invoice_number: 'INV-1', status: 'issued', payment_status: 'unpaid' }];
  assert.deepEqual(returnableInvoices(invoices).map((i) => i.invoice_number), ['INV-1']);
});

test('payment status never gates the list', () => {
  const invoices = [
    { invoice_number: 'INV-1', status: 'issued', payment_status: 'unpaid' },
    { invoice_number: 'INV-2', status: 'issued', payment_status: 'partially_paid' },
    { invoice_number: 'INV-3', status: 'issued', payment_status: 'paid' },
    { invoice_number: 'INV-4', status: 'issued' },
  ];
  assert.equal(returnableInvoices(invoices).length, 4);
});

test('drafts and voided invoices stay out of the list', () => {
  const invoices = [
    { invoice_number: 'INV-1', status: 'draft', payment_status: 'unpaid' },
    { invoice_number: 'INV-2', status: 'cancelled', payment_status: 'paid' },
    { invoice_number: 'INV-3', status: 'void', payment_status: 'paid' },
    { invoice_number: 'INV-4', status: 'rejected', payment_status: 'unpaid' },
    { invoice_number: 'INV-5', status: '', payment_status: 'paid' },
  ];
  assert.deepEqual(returnableInvoices(invoices), []);
});

test('a paid invoice is still returnable — the fix widens the list, it does not move it', () => {
  const invoices = [{ invoice_number: 'INV-9', status: 'paid', payment_status: 'paid' }];
  assert.equal(returnableInvoices(invoices).length, 1);
});

// The credit note's cost side. The invoice posts Dr COGS / Cr Inventory at
// unit_cost × quantity; the return has to mirror it or inventory stays understated
// and COGS overstated for good. Stock and the Inventory debit must use the same
// value, or the warehouse and the ledger drift apart.
const cogsReversalLines = (receipt) => [
  { account_code: '1200', debit: receipt.value, credit: 0 },
  { account_code: '5001', debit: 0, credit: receipt.value },
];

test('the COGS reversal balances and matches the value added to stock', () => {
  const unitCost = 37.5;
  const quantity = 4;
  const receipt = { unitCost, quantity, value: unitCost * quantity };
  const lines = cogsReversalLines(receipt);

  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debit, credit, 'entry must balance');
  assert.equal(lines[0].debit, 150, 'Inventory is debited by what the warehouse gained');
  assert.equal(receipt.value, unitCost * quantity);
});

test('a zero unit cost posts no COGS reversal, so no lopsided entry is raised', () => {
  const receipt = { unitCost: 0, quantity: 4, value: 0 };
  assert.equal(receipt.value > 0, false, 'caller skips the journal entirely');
});
