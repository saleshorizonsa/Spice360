import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseFreightToStock, assessFreightGlLeg } from "../src/lib/freightStockDiagnosis.js";

const grn = {
  grn_number: "GRN-7000",
  material_code: "CIN-001",
  receiving_location: "WH1",
  storage_bin: "",
  batch_number: "",
  quantity_received: 100,
  unit_price: 500,
};
const stock = {
  id: "st1",
  material_code: "CIN-001",
  warehouse_code: "WH1",
  bin_code: "",
  batch_number: "",
  quantity: 100,
  unit_cost: 500,
  total_value: 50000,
};

test("plans the freight onto the one in-stock material (the 7931 case)", () => {
  const invoice = {
    freight_cost: 7100,
    other_charges: 0,
    grn_references: [{ grn_number: "GRN-7000", grn_quantity: 100, unit_cost: 500 }],
  };
  const { landedCost, plan, reason } = diagnoseFreightToStock({ invoice, grns: [grn], stockLevels: [stock] });
  assert.equal(reason, null);
  assert.equal(landedCost, 7100);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "st1");
  assert.equal(plan.updates[0].newTotalValue, 57100);
  assert.equal(plan.updates[0].newUnitCost, 571); // 57,100 / 100
});

test("still applies when the GRN unit cost did not resolve (receivedValue 0)", () => {
  const invoice = {
    freight_cost: 7100,
    grn_references: [{ grn_number: "GRN-7000", grn_quantity: 0, unit_cost: 0 }],
  };
  const grnNoPrice = { ...grn, unit_price: 0, quantity_received: 0 };
  const { plan, reason } = diagnoseFreightToStock({ invoice, grns: [grnNoPrice], stockLevels: [stock] });
  assert.equal(reason, null);
  assert.equal(plan.basis, "quantity");
  assert.equal(plan.updates[0].newTotalValue, 57100);
});

test("reports stock_not_matched when the bin does not line up", () => {
  const invoice = { freight_cost: 7100, grn_references: [{ grn_number: "GRN-7000" }] };
  const binnedGrn = { ...grn, storage_bin: "A-1" };
  const { reason, rows } = diagnoseFreightToStock({ invoice, grns: [binnedGrn], stockLevels: [stock] });
  assert.equal(reason, "stock_not_matched");
  assert.equal(rows[0].grnFound, true);
  assert.equal(rows[0].stockMatched, false);
});

test("reports no_grn_linked when the invoice has freight but no references", () => {
  const invoice = { freight_cost: 7100, grn_references: [] };
  const { reason } = diagnoseFreightToStock({ invoice, grns: [grn], stockLevels: [stock] });
  assert.equal(reason, "no_grn_linked");
});

test("reports no_freight when there is nothing to capitalise", () => {
  const invoice = { freight_cost: 0, other_charges: 0, grn_references: [{ grn_number: "GRN-7000" }] };
  const { reason } = diagnoseFreightToStock({ invoice, grns: [grn], stockLevels: [stock] });
  assert.equal(reason, "no_freight");
});

test("reports all_stranded when the matched stock has been fully issued", () => {
  const invoice = {
    freight_cost: 7100,
    grn_references: [{ grn_number: "GRN-7000", grn_quantity: 100, unit_cost: 500 }],
  };
  const emptyStock = { ...stock, quantity: 0, total_value: 0 };
  const { reason, plan } = diagnoseFreightToStock({ invoice, grns: [grn], stockLevels: [emptyStock] });
  assert.equal(reason, "all_stranded");
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.strandedAmount, 7100);
});

// ── assessFreightGlLeg ──────────────────────────────────────────────────────
const GL = { inventory: "1200", freight_accrual: "2130" };

test("detects freight missing from the Inventory GL (the 7931 journal) and clears it to post", () => {
  // 7931's actual journal: Dr GRNI / Cr Trade Payables only — no freight anywhere.
  const invoice = { vendor_invoice_number: "7931", freight_cost: 2000, other_charges: 0 };
  const journalEntries = [{ journal_number: "JE-46", reference_type: "vendor_invoice", reference_id: "7931", status: "posted" }];
  const journalLines = [
    { journal_number: "JE-46", account_code: "2110", debit: 1800100, credit: 0 },
    { journal_number: "JE-46", account_code: "2100", debit: 0, credit: 1800100 },
  ];
  const a = assessFreightGlLeg({ invoice, journalEntries, journalLines, gl: GL });
  assert.equal(a.landedCost, 2000);
  assert.equal(a.inventoryDebit, 0);
  assert.equal(a.freightAccrualCredit, 0);
  assert.equal(a.glGap, 2000);
  assert.equal(a.canAutoPost, true);
});

test("does not offer to post when the freight is already in the Inventory GL", () => {
  const invoice = { vendor_invoice_number: "8000", freight_cost: 2000 };
  const journalEntries = [{ journal_number: "JE-50", reference_type: "vendor_invoice", reference_id: "8000", status: "posted" }];
  const journalLines = [
    { journal_number: "JE-50", account_code: "1200", debit: 2000, credit: 0 },
    { journal_number: "JE-50", account_code: "2130", debit: 0, credit: 2000 },
  ];
  const a = assessFreightGlLeg({ invoice, journalEntries, journalLines, gl: GL });
  assert.equal(a.glGap, 0);
  assert.equal(a.canAutoPost, false);
});

test("refuses to auto-post when the freight accrual was already credited (avoid double liability)", () => {
  const invoice = { vendor_invoice_number: "8001", freight_cost: 2000 };
  const journalEntries = [{ journal_number: "JE-51", reference_type: "vendor_invoice", reference_id: "8001", status: "posted" }];
  const journalLines = [
    { journal_number: "JE-51", account_code: "2130", debit: 0, credit: 2000 }, // accrual credited, but Inventory never debited
  ];
  const a = assessFreightGlLeg({ invoice, journalEntries, journalLines, gl: GL });
  assert.equal(a.glGap, 2000);
  assert.equal(a.freightAccrualCredit, 2000);
  assert.equal(a.canAutoPost, false);
});

test("ignores reversed/other invoices' lines when assessing", () => {
  const invoice = { vendor_invoice_number: "7931", freight_cost: 2000 };
  const journalEntries = [
    { journal_number: "JE-46", reference_type: "vendor_invoice", reference_id: "7931", status: "posted" },
    { journal_number: "JE-99", reference_type: "vendor_invoice", reference_id: "9999", status: "posted" }, // other invoice
  ];
  const journalLines = [
    { journal_number: "JE-46", account_code: "2110", debit: 1800100, credit: 0 },
    { journal_number: "JE-99", account_code: "1200", debit: 5000, credit: 0 }, // must NOT count
  ];
  const a = assessFreightGlLeg({ invoice, journalEntries, journalLines, gl: GL });
  assert.equal(a.inventoryDebit, 0);
  assert.equal(a.glGap, 2000);
});

test("parses grn_references that arrive as a JSON string", () => {
  const invoice = {
    freight_cost: 7100,
    grn_references: JSON.stringify([{ grn_number: "GRN-7000", grn_quantity: 100, unit_cost: 500 }]),
  };
  const { plan, reason } = diagnoseFreightToStock({ invoice, grns: [grn], stockLevels: [stock] });
  assert.equal(reason, null);
  assert.equal(plan.updates.length, 1);
});
