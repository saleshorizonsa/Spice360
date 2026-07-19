import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVendorInvoiceJournal } from '../src/lib/vendorInvoiceJournal.js';

const gl = {
  grni: '2110',
  inventory: '1200',
  vat_input: '2210',
  trade_payables: '2100',
  cogs_general: '5001',
};

// 100 kg @ 500 = 50,000 goods; 5,000 transport; VAT 18% on 55,000 = 9,900; total 64,900.
const invoice = {
  subtotal: 50000,
  freightCost: 5000,
  otherCharges: 0,
  vatAmount: 9900,
  totalAmount: 64900,
  gl,
};

test('the entry BALANCES when there is a transport charge', () => {
  // The old entry credited Payables 64,900 but debited only 59,900 — out by exactly
  // the 5,000 transport. assertBalanced() threw and the invoice never posted at all.
  const { totalDebit, totalCredit, isBalanced } = buildVendorInvoiceJournal(invoice);
  assert.equal(totalDebit, 64900);
  assert.equal(totalCredit, 64900);
  assert.ok(isBalanced);
});

test('inbound transport is capitalised into Inventory, not lost', () => {
  const { lines } = buildVendorInvoiceJournal(invoice);
  const inventory = lines.find((l) => l.account_code === gl.inventory);
  assert.ok(inventory, 'an Inventory line must exist');
  assert.equal(inventory.debit, 5000); // the transport
});

test('other charges are capitalised alongside freight', () => {
  const { lines, isBalanced } = buildVendorInvoiceJournal({
    ...invoice, otherCharges: 1500, vatAmount: 10170, totalAmount: 66670,
  });
  assert.equal(lines.find((l) => l.account_code === gl.inventory).debit, 6500); // 5000 + 1500
  assert.ok(isBalanced);
});

test('GRNI is CLEARED by the goods value', () => {
  // The GRN credits GRNI; nothing ever debited it back, so it grew forever.
  const { lines } = buildVendorInvoiceJournal(invoice);
  const grni = lines.find((l) => l.account_code === gl.grni);
  assert.ok(grni, 'a GRNI line must exist');
  assert.equal(grni.debit, 50000);
});

test('COGS is NOT touched at purchase — that would double count it', () => {
  // The sales invoice already posts Dr COGS / Cr Inventory when the goods are sold.
  const { lines } = buildVendorInvoiceJournal(invoice);
  assert.equal(lines.find((l) => l.account_code === gl.cogs_general), undefined);
});

test('Trade Payables is credited with the full invoice total', () => {
  const { lines } = buildVendorInvoiceJournal(invoice);
  const ap = lines.find((l) => l.account_code === gl.trade_payables);
  assert.equal(ap.credit, 64900);
  assert.equal(ap.debit, 0);
});

test('an invoice with no transport still balances and omits the Inventory line', () => {
  const { lines, isBalanced } = buildVendorInvoiceJournal({
    subtotal: 50000, freightCost: 0, otherCharges: 0, vatAmount: 9000, totalAmount: 59000, gl,
  });
  assert.ok(isBalanced);
  assert.equal(lines.find((l) => l.account_code === gl.inventory), undefined); // zero lines dropped
  assert.equal(lines.length, 3);
});

// ── Freight to its own liability (3rd-party carrier) ────────────────────────
const glWithFreight = { ...gl, freight_accrual: '2130' };

test('freight is credited to Freight Accrual, not Trade Payables, when mapped', () => {
  const { lines, isBalanced } = buildVendorInvoiceJournal({ ...invoice, gl: glWithFreight });
  const freight = lines.find((l) => l.account_code === '2130');
  const ap = lines.find((l) => l.account_code === gl.trade_payables);
  assert.ok(freight, 'a Freight Accrual line must exist');
  assert.equal(freight.credit, 5000);          // owed to the carrier
  assert.equal(ap.credit, 59900);              // vendor owed total − freight (64,900 − 5,000)
  assert.ok(isBalanced);
});

test('freight is STILL capitalised into Inventory even when split to its own liability', () => {
  const { lines } = buildVendorInvoiceJournal({ ...invoice, gl: glWithFreight });
  assert.equal(lines.find((l) => l.account_code === gl.inventory).debit, 5000);
});

test('only freight is split — other charges stay in Trade Payables', () => {
  // 50,000 goods + 5,000 freight + 1,500 other + VAT 10,170 = 66,670 total.
  const { lines, isBalanced } = buildVendorInvoiceJournal({
    ...invoice, otherCharges: 1500, vatAmount: 10170, totalAmount: 66670, gl: glWithFreight,
  });
  assert.equal(lines.find((l) => l.account_code === '2130').credit, 5000);          // freight only
  assert.equal(lines.find((l) => l.account_code === gl.inventory).debit, 6500);     // freight + other capitalised
  assert.equal(lines.find((l) => l.account_code === gl.trade_payables).credit, 61670); // 66,670 − 5,000 (other stays)
  assert.ok(isBalanced);
});

test('with no freight-accrual account mapped, freight stays in Trade Payables (fallback)', () => {
  const { lines } = buildVendorInvoiceJournal(invoice); // gl has no freight_accrual
  assert.equal(lines.find((l) => l.account_code === '2130'), undefined);
  assert.equal(lines.find((l) => l.account_code === gl.trade_payables).credit, 64900);
});

test('a freight-only invoice with zero VAT balances and splits correctly', () => {
  const { lines, isBalanced } = buildVendorInvoiceJournal({
    subtotal: 50000, freightCost: 5000, otherCharges: 0, vatAmount: 0, totalAmount: 55000, gl: glWithFreight,
  });
  assert.equal(lines.find((l) => l.account_code === '2130').credit, 5000);
  assert.equal(lines.find((l) => l.account_code === gl.trade_payables).credit, 50000);
  assert.ok(isBalanced);
});

test('a zero-VAT invoice (VAT not activated for the vendor) still balances', () => {
  const { totalDebit, totalCredit, isBalanced } = buildVendorInvoiceJournal({
    subtotal: 50000, freightCost: 5000, otherCharges: 0, vatAmount: 0, totalAmount: 55000, gl,
  });
  assert.equal(totalDebit, 55000);
  assert.equal(totalCredit, 55000);
  assert.ok(isBalanced);
});

test('rounding does not break the balance', () => {
  const { isBalanced } = buildVendorInvoiceJournal({
    subtotal: 33.33, freightCost: 11.11, otherCharges: 0.01, vatAmount: 8.0, totalAmount: 52.45, gl,
  });
  assert.ok(isBalanced);
});
