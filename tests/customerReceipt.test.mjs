import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerReceiptJournal, applyReceiptToAr, validatePaymentAmount } from "../src/lib/customerReceipt.js";

const GL = { ar_receivables: "1100" };

test("posts Dr chosen cash/bank / Cr Accounts Receivable, balanced", () => {
  const { lines, isBalanced } = buildCustomerReceiptJournal({
    amount: 5000,
    receiveIntoCode: "1012",
    receiveIntoName: "Commercial Bank",
    gl: GL,
  });
  assert.equal(isBalanced, true);
  const dr = lines.find((l) => l.debit > 0);
  const cr = lines.find((l) => l.credit > 0);
  assert.equal(dr.account_code, "1012");
  assert.equal(dr.debit, 5000);
  assert.equal(cr.account_code, "1100");
  assert.equal(cr.credit, 5000);
});

test("credits the specific account chosen, so petty cash and banks stay separate", () => {
  const petty = buildCustomerReceiptJournal({ amount: 100, receiveIntoCode: "1011", receiveIntoName: "Petty Cash", gl: GL });
  assert.equal(petty.lines.find((l) => l.debit > 0).account_code, "1011");
});

test("drops lines with no account or zero amount instead of posting an unbalanced entry", () => {
  const { lines, isBalanced } = buildCustomerReceiptJournal({ amount: 0, receiveIntoCode: "1012", gl: GL });
  assert.equal(lines.length, 0);
  assert.equal(isBalanced, true);
});

test("applyReceiptToAr marks a partial receipt partially_paid and leaves the remainder", () => {
  const ar = { invoice_amount: 10000, paid_amount: 0, status: "open" };
  const upd = applyReceiptToAr(ar, 4000);
  assert.equal(upd.paid_amount, 4000);
  assert.equal(upd.outstanding_amount, 6000);
  assert.equal(upd.status, "partially_paid");
});

test("applyReceiptToAr clears the balance and marks paid on full settlement", () => {
  const ar = { invoice_amount: 10000, paid_amount: 6000, status: "partially_paid" };
  const upd = applyReceiptToAr(ar, 4000);
  assert.equal(upd.paid_amount, 10000);
  assert.equal(upd.outstanding_amount, 0);
  assert.equal(upd.status, "paid");
});

test("applyReceiptToAr never drives outstanding below zero on a rounding overshoot", () => {
  const ar = { invoice_amount: 10000, paid_amount: 9999.99, status: "partially_paid" };
  const upd = applyReceiptToAr(ar, 0.02);
  assert.equal(upd.outstanding_amount, 0);
  assert.equal(upd.status, "paid");
});

test("validatePaymentAmount rejects zero, negative and over-receipt", () => {
  assert.equal(validatePaymentAmount(0, 5000).ok, false);
  assert.equal(validatePaymentAmount(-1, 5000).ok, false);
  assert.equal(validatePaymentAmount(6000, 5000).ok, false);
  assert.equal(validatePaymentAmount(5000, 5000).ok, true);
  assert.equal(validatePaymentAmount(2500, 5000).ok, true); // partial
});
