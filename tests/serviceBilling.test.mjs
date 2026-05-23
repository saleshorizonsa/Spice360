import test from "node:test";
import assert from "node:assert/strict";
import {
  buildServiceInvoiceFromContract,
  calculateNextBillingDate,
  calculateServiceBusinessKpis,
  generateRecurringInvoices,
  isMissingRecurringBillingRunTableError,
  shouldGenerateInvoiceForContract
} from "../src/lib/serviceBilling.js";

const baseContract = {
  id: "contract-1",
  tenant_id: "tenant-a",
  organization_id: "tenant-a",
  contract_number: "CTR-1001",
  customer_code: "CUST-01",
  customer_name: "Acme Saudi LLC",
  customer_email: "billing@acme.test",
  customer_vat_number: "300000000000003",
  customer_address: "Riyadh",
  service_type: "managed_services",
  billing_cycle: "monthly",
  start_date: "2026-05-01",
  next_billing_date: "2026-05-01",
  payment_terms: "net_30",
  vat_rate: 15,
  invoice_type: "standard_tax_invoice",
  preferred_language: "bilingual",
  preferred_delivery_method: "email",
  auto_send_invoice: true,
  status: "active",
  service_lines: [
    {
      service_description: "Monthly IT Support Services",
      quantity: 1,
      unit: "month",
      unit_price: 1000,
      vat_rate: 15
    },
    {
      service_description: "Microsoft 365 Administration",
      quantity: 2,
      unit: "hour",
      unit_price: 150,
      vat_rate: 15
    }
  ]
};

test("service contract creates a standard tax invoice without inventory dependency", () => {
  const invoice = buildServiceInvoiceFromContract(baseContract, "2026-05-01");

  assert.equal(invoice.tenant_id, "tenant-a");
  assert.equal(invoice.organization_id, "tenant-a");
  assert.equal(invoice.invoice_mode, "service");
  assert.equal(invoice.invoice_category, "service");
  assert.equal(invoice.invoice_type, "standard_tax_invoice");
  assert.equal(invoice.product_code, "CTR-1001");
  assert.equal(invoice.product_name, "Monthly IT Support Services");
  assert.equal(invoice.service_lines.length, 2);
  assert.equal(invoice.subtotal, 1300);
  assert.equal(invoice.tax_amount, 195);
  assert.equal(invoice.total_amount, 1495);
  assert.equal(invoice.auto_send_invoice, true);
});

test("billing cycles calculate next billing dates", () => {
  assert.equal(calculateNextBillingDate({ ...baseContract, billing_cycle: "monthly" }, "2026-05-31"), "2026-06-30");
  assert.equal(calculateNextBillingDate({ ...baseContract, billing_cycle: "quarterly" }, "2026-05-01"), "2026-08-01");
  assert.equal(calculateNextBillingDate({ ...baseContract, billing_cycle: "annual" }, "2026-05-01"), "2027-05-01");
  assert.equal(calculateNextBillingDate({ ...baseContract, billing_cycle: "custom", custom_billing_months: 2 }, "2026-05-01"), "2026-07-01");
});

test("due recurring generation skips paused, future, and duplicate invoices", () => {
  assert.equal(shouldGenerateInvoiceForContract(baseContract, "2026-05-08", []), true);
  assert.equal(shouldGenerateInvoiceForContract({ ...baseContract, status: "paused" }, "2026-05-08", []), false);
  assert.equal(shouldGenerateInvoiceForContract({ ...baseContract, next_billing_date: "2026-06-01" }, "2026-05-08", []), false);
  assert.equal(
    shouldGenerateInvoiceForContract(baseContract, "2026-05-08", [
      { service_contract_id: "contract-1", invoice_date: "2026-05-01", invoice_mode: "service" }
    ]),
    false
  );
});

test("recurring generation creates tenant-scoped invoice and advances the contract", async () => {
  const updates = [];
  const generated = await generateRecurringInvoices({
    contracts: [baseContract],
    existingInvoices: [],
    asOfDate: "2026-05-08",
    createInvoice: async (invoice) => ({ ...invoice, id: "invoice-1", invoice_number: "INV-1" }),
    updateContract: async (contract, payload) => updates.push({ contract, payload })
  });

  assert.equal(generated.length, 1);
  assert.equal(generated[0].tenant_id, "tenant-a");
  assert.equal(generated[0].service_contract_id, "contract-1");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].payload.last_billing_date, "2026-05-01");
  assert.equal(updates[0].payload.next_billing_date, "2026-06-01");
});

test("service KPIs calculate MRR, ARR, renewals, and overdue invoices", () => {
  const kpis = calculateServiceBusinessKpis(
    [
      baseContract,
      { ...baseContract, id: "contract-2", billing_cycle: "quarterly", monthly_amount: 3000, end_date: "2026-05-20" },
      { ...baseContract, id: "contract-3", status: "inactive", monthly_amount: 9999 }
    ],
    [
      { invoice_mode: "service", payment_status: "unpaid", due_date: "2026-05-01" },
      { invoice_mode: "service", payment_status: "paid", due_date: "2026-05-01" }
    ],
    "2026-05-08"
  );

  assert.equal(kpis.monthlyRecurringRevenue, 1000);
  assert.equal(kpis.annualRecurringRevenue, 12000);
  assert.equal(kpis.activeContracts, 2);
  assert.equal(kpis.upcomingRenewals, 1);
  assert.equal(kpis.overdueInvoices, 1);
  assert.equal(kpis.serviceInvoices, 2);
});

test("missing recurring billing run table errors are detected as non-blocking logs", () => {
  assert.equal(isMissingRecurringBillingRunTableError({
    code: "PGRST205",
    message: "Could not find the table 'public.recurring_billing_run' in the schema cache"
  }), true);
  assert.equal(isMissingRecurringBillingRunTableError({
    code: "42P01",
    message: "relation public.recurring_billing_run does not exist"
  }), true);
  assert.equal(isMissingRecurringBillingRunTableError(new Error("Network failed")), false);
});
