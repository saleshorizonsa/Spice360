import assert from "node:assert/strict";
import test from "node:test";
import {
  filterItemsByModules,
  getDefaultModulesForBusinessType,
  getEnabledModuleKeys,
  getEnabledModulesForOrganization,
  isPageEnabledForModules
} from "../src/lib/tenantModules.js";

test("IT services default modules prioritize recurring billing and service workflows", () => {
  const modules = getDefaultModulesForBusinessType("it_services");

  assert.equal(modules.crm, true);
  assert.equal(modules.contracts, true);
  assert.equal(modules.recurring_billing, true);
  assert.equal(modules.zatca, true);
  assert.equal(modules.helpdesk, true);
  assert.equal(modules.customer_portal, true);
  assert.equal(modules.whatsapp, true);
  assert.equal(modules.inventory, false);
  assert.equal(modules.manufacturing, false);
  assert.equal(modules.supply_chain, false);
});

test("tenant organization module config overrides business type defaults", () => {
  const modules = getEnabledModulesForOrganization({
    business_type: "it_services",
    tenant_modules: {
      crm: true,
      finance: true,
      manufacturing: true,
      recurring_billing: false
    }
  });

  assert.equal(modules.manufacturing, true);
  assert.equal(modules.recurring_billing, false);
});

test("legacy tenants without explicit module config default to IT services focus", () => {
  const modules = getEnabledModulesForOrganization({
    enabled_modules: ["sales", "finance", "inventory", "manufacturing"]
  });

  assert.equal(modules.recurring_billing, true);
  assert.equal(modules.inventory, false);
  assert.equal(modules.manufacturing, false);
});

test("route gating hides disabled heavy ERP pages but keeps service billing pages", () => {
  const modules = getDefaultModulesForBusinessType("it_services");

  assert.equal(isPageEnabledForModules("Sales", modules), true);
  assert.equal(isPageEnabledForModules("ZATCA", modules), true);
  assert.equal(isPageEnabledForModules("Inventory", modules), false);
  assert.equal(isPageEnabledForModules("Production", modules), false);
  assert.equal(isPageEnabledForModules("DemandPlanning", modules), false);
});

test("menu filtering removes disabled modules for non-owner users", () => {
  const modules = getDefaultModulesForBusinessType("it_services");
  const items = [
    { path: "Dashboard" },
    { path: "Sales" },
    { path: "Inventory" },
    { path: "Production" },
    { path: "AdminCenter" }
  ];

  const filtered = filterItemsByModules(items, modules, false).map((item) => item.path);
  assert.deepEqual(filtered, ["Dashboard", "Sales", "AdminCenter"]);
});

test("platform owner can access all module pages", () => {
  const modules = getDefaultModulesForBusinessType("it_services");

  assert.equal(isPageEnabledForModules("Production", modules, true), true);
  assert.equal(isPageEnabledForModules("Inventory", modules, true), true);
  assert.ok(getEnabledModuleKeys(modules).includes("recurring_billing"));
});
