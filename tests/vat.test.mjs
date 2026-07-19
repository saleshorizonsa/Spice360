import test from "node:test";
import assert from "node:assert/strict";
import {
  isVatEnabled,
  isVatApplicable,
  resolveVatRate,
  resolvePartyVatRate,
  resolveSalesOrderVatRate,
  sumLineVat
} from "../src/lib/vat.js";

const PARTY_ON = { vat_applicable: true };
const PARTY_OFF = { vat_applicable: false };
const LEGACY = {}; // pre-existing record with no flag at all
const ITEM_ON = { vat_applicable: true, vat_rate: 18 };
const ITEM_ON_REDUCED = { vat_applicable: true, vat_rate: 5 };
const ITEM_ON_NO_RATE = { vat_applicable: true };
const ITEM_OFF = { vat_applicable: false, vat_rate: 18 }; // rate set but not activated
const STANDARD_RATE = 18;

test("VAT applies only when BOTH the party and the item are activated", () => {
  assert.equal(resolveVatRate(PARTY_ON, ITEM_ON, STANDARD_RATE), 18);
  assert.equal(resolveVatRate(PARTY_ON, ITEM_OFF, STANDARD_RATE), 0);
  assert.equal(resolveVatRate(PARTY_OFF, ITEM_ON, STANDARD_RATE), 0);
  assert.equal(resolveVatRate(PARTY_OFF, ITEM_OFF, STANDARD_RATE), 0);
  assert.equal(isVatApplicable(PARTY_ON, ITEM_ON), true);
  assert.equal(isVatApplicable(PARTY_ON, ITEM_OFF), false);
});

test("records with no vat_applicable flag are never charged VAT", () => {
  // Every vendor/customer/item that existed before VAT was made opt-in must
  // stay VAT-free until someone explicitly ticks the box.
  assert.equal(isVatEnabled(LEGACY), false);
  assert.equal(resolveVatRate(LEGACY, LEGACY, STANDARD_RATE), 0);
  assert.equal(resolveVatRate(LEGACY, ITEM_ON, STANDARD_RATE), 0);
  assert.equal(resolveVatRate(PARTY_ON, LEGACY, STANDARD_RATE), 0);
  assert.equal(resolveVatRate(undefined, null, STANDARD_RATE), 0);
});

test("the item's own rate wins; the standard rate is only a fallback", () => {
  assert.equal(resolveVatRate(PARTY_ON, ITEM_ON_REDUCED, STANDARD_RATE), 5);
  assert.equal(resolveVatRate(PARTY_ON, ITEM_ON_NO_RATE, STANDARD_RATE), 18);
  assert.equal(resolveVatRate(PARTY_ON, ITEM_ON_NO_RATE, 0), 0);
});

test("party-only documents (service contract, POS) gate on the party alone", () => {
  assert.equal(resolvePartyVatRate(PARTY_ON, STANDARD_RATE), 18);
  assert.equal(resolvePartyVatRate(PARTY_OFF, STANDARD_RATE), 0);
  assert.equal(resolvePartyVatRate(LEGACY, STANDARD_RATE), 0);
});

test("multi-line documents tax each line, gated by the party", () => {
  const lines = [
    { line_total: 1000, vat_rate: 18 }, // -> 180
    { line_total: 500, vat_rate: 0 },   // -> 0 (exempt item)
    { line_total: 200, vat_rate: 5 }    // -> 10
  ];
  assert.equal(sumLineVat(PARTY_ON, lines), 190);
  assert.equal(sumLineVat(PARTY_OFF, lines), 0);
  assert.equal(sumLineVat(LEGACY, lines), 0);
  assert.equal(sumLineVat(PARTY_ON, []), 0);
});

// ── An invoice inherits the Sales Order's VAT, not its own re-derived rate ────
test("resolveSalesOrderVatRate derives the SO's effective rate from its totals", () => {
  assert.equal(resolveSalesOrderVatRate({ subtotal: 50000, vat_amount: 9000 }), 18);
  assert.equal(resolveSalesOrderVatRate({ subtotal: 1000, vat_amount: 150 }), 15);
});

test("a VAT-free sales order yields a zero invoice rate", () => {
  assert.equal(resolveSalesOrderVatRate({ subtotal: 50000, vat_amount: 0 }), 0);
  assert.equal(resolveSalesOrderVatRate({ subtotal: 0, vat_amount: 0 }), 0);
  assert.equal(resolveSalesOrderVatRate({}), 0);
});

test("floating-point noise is rounded away", () => {
  // 8999.5 / 50000 = 17.999 -> 18.00
  assert.equal(resolveSalesOrderVatRate({ subtotal: 50000, vat_amount: 8999.5 }), 18);
});
