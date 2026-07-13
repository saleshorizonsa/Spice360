import test from "node:test";
import assert from "node:assert/strict";
import {
  isVatEnabled,
  isVatApplicable,
  resolveVatRate,
  resolvePartyVatRate,
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
