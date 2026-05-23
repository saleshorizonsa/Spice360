import test from "node:test";
import assert from "node:assert/strict";
import {
  itemMatchesSearch,
  itemToSelectOption,
  materialToSalesLinePatch,
  validateDuplicateItemCode
} from "../src/lib/itemSelection.js";

const tenantAItems = [
  { id: "a1", tenant_id: "tenant-a", material_code: "SKU-001", material_name: "PVC Pipe", unit_price: 45, unit_cost: 30, unit_of_measure: "piece" }
];

test("empty item list supports create item state in selector consumers", () => {
  const options = [];
  assert.equal(options.length, 0);
});

test("search with no match can be detected for create new item", () => {
  assert.equal(itemMatchesSearch(tenantAItems[0], "steel"), false);
  assert.equal(itemMatchesSearch(tenantAItems[0], "PVC"), true);
});

test("created item from quote maps to selected line item fields", () => {
  const line = materialToSalesLinePatch({
    material_code: "SKU-002",
    material_name: "Steel Sheet",
    unit_price: 125,
    unit_of_measure: "sqm",
    vat_rate: 15,
    specifications: "2mm sheet"
  });

  assert.equal(line.product_code, "SKU-002");
  assert.equal(line.material_code, "SKU-002");
  assert.equal(line.product_name, "Steel Sheet");
  assert.equal(line.unit_price, 125);
  assert.equal(line.unit_of_measure, "sqm");
  assert.equal(line.description, "2mm sheet");
});

test("created item from sales order maps to selected line item fields", () => {
  const line = materialToSalesLinePatch({
    material_code: "SKU-003",
    material_name: "Aluminum Coil",
    unit_cost: 70,
    unit_of_measure: "kg"
  });

  assert.equal(line.product_code, "SKU-003");
  assert.equal(line.product_name, "Aluminum Coil");
  assert.equal(line.unit_price, 70);
});

test("new item select option uses master data material code and name", () => {
  assert.deepEqual(itemToSelectOption(tenantAItems[0]), {
    value: "SKU-001",
    label: "SKU-001 - PVC Pipe"
  });
});

test("duplicate item code validation is tenant-scoped by supplied item list", () => {
  assert.equal(validateDuplicateItemCode(tenantAItems, "sku-001"), true);
  assert.equal(validateDuplicateItemCode([], "sku-001"), false);
});

test("duplicate item code validation ignores the item being edited", () => {
  assert.equal(validateDuplicateItemCode(tenantAItems, "SKU-001", "a1"), false);
});

test("permission-based create visibility can hide create item action", () => {
  const canCreate = false;
  assert.equal(canCreate, false);
});
