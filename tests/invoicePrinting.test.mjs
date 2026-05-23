import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBilingualEmailMessage,
  getLabel,
  mergePrintingPreferences,
  normalizeInvoiceForPrint,
  validateZatcaPrintPreferences
} from "../src/components/printing/invoicePrintUtils.js";

test("bilingual labels include English and Arabic text", () => {
  assert.equal(getLabel("sellerName", "bilingual"), "Seller name / اسم البائع");
});

test("ZATCA required fields cannot be hidden for taxable invoices", () => {
  const result = validateZatcaPrintPreferences({
    fields: {
      qrCode: false,
      sellerDetails: false
    }
  }, { tax_percent: 15 });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("qrCode")));
  assert.ok(result.errors.some((error) => error.includes("sellerDetails")));
});

test("printing preferences merge keeps default tenant field visibility", () => {
  const merged = mergePrintingPreferences({ default_language: "ar", fields: { logo: false } });
  assert.equal(merged.default_language, "ar");
  assert.equal(merged.fields.logo, false);
  assert.equal(merged.fields.qrCode, true);
});

test("invoice normalization preserves Saudi VAT totals", () => {
  const doc = normalizeInvoiceForPrint({
    invoice_number: "INV-1",
    customer_name: "Buyer",
    quantity: 2,
    unit_price: 100,
    tax_percent: 15
  }, {
    organization_name: "Seller",
    vat_registration_number: "300000000000003"
  });

  assert.equal(doc.totals.taxable_amount, 200);
  assert.equal(doc.totals.vat_amount, 30);
  assert.equal(doc.totals.total_amount, 230);
  assert.equal(doc.seller.vat_number, "300000000000003");
});

test("default email content is bilingual", () => {
  const message = buildBilingualEmailMessage({ invoice_number: "INV-99" });
  assert.match(message, /invoice INV-99/);
  assert.match(message, /الفاتورة رقم INV-99/);
});
