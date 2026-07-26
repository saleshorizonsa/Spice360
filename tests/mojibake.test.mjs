import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fixMojibake, findMojibakeFixes } from "../src/lib/mojibake.js";

// Reproduce the corruption the way it happens in the wild: real UTF-8 bytes
// decoded through a single-byte codec. `latin1` exercises the 0x00-0xFF identity
// path; the app's live data is the CP1252 variant, covered by the explicit
// code-point tests below.
const mangle = (s) => Buffer.from(s, "utf8").toString("latin1");

test("reverses mojibake for an em dash", () => {
  const clean = "Cost of Goods Sold — General";
  assert.equal(fixMojibake(mangle(clean)), clean);
});

test("reverses accented letters and symbols", () => {
  for (const clean of ["Café", "Señor Müller", "Price £5 / €4", "20°C"]) {
    assert.equal(fixMojibake(mangle(clean)), clean);
  }
});

test("reverses the CP1252 em dash actually stored in the data (E2 80 94)", () => {
  // U+00E2 U+20AC U+201D is 'E2 80 94' decoded as CP1252 -- what sits in the DB.
  const cp1252 = "Cost of Goods Sold â€” General";
  assert.equal(fixMojibake(cp1252), "Cost of Goods Sold — General");
});

test("reverses a CP1252 curly apostrophe (E2 80 99)", () => {
  assert.equal(fixMojibake("Oâ€™Brien"), "O’Brien");
});

test("leaves clean text untouched -- including strings that contain a real a-circumflex", () => {
  for (const clean of [
    "Cost of Goods Sold — General",
    "Trade Payables",
    "Café",
    "3 — 4",
    "€100",
    "Château rôti", // real U+00E2 that must survive the marker guard
  ]) {
    assert.equal(fixMojibake(clean), clean);
  }
});

test("is idempotent", () => {
  const once = fixMojibake(mangle("A — B ’C‘ …"));
  assert.equal(fixMojibake(once), once);
});

test("handles non-strings and empties", () => {
  assert.equal(fixMojibake(null), null);
  assert.equal(fixMojibake(undefined), undefined);
  assert.equal(fixMojibake(42), 42);
  assert.equal(fixMojibake(""), "");
});

test("findMojibakeFixes returns only changed rows, with before/after per field", () => {
  const accounts = [
    { id: "1", account_code: "5001", account_name: mangle("Cost of Goods Sold — General") },
    { id: "2", account_code: "2100", account_name: "Trade Payables" },
    { id: "3", account_code: "4000", account_name: "Sales", account_description: mangle("Revenue — net") },
    { id: "4", account_code: "1000", account_name: null },
  ];
  const fixes = findMojibakeFixes(accounts);
  assert.equal(fixes.length, 2);
  assert.equal(fixes[0].account_code, "5001");
  assert.equal(fixes[0].changed.account_name.after, "Cost of Goods Sold — General");
  assert.equal(fixes[1].account_code, "4000");
  assert.equal(fixes[1].changed.account_description.after, "Revenue — net");
  assert.equal(fixes[1].changed.account_name, undefined); // name was clean, not listed
});
