/**
 * Maps each page path name to the subscription module that gates it.
 * null = always accessible regardless of plan.
 * "All modules" in plan.modules grants access to everything.
 */
export const PAGE_MODULE_MAP = {
  // Sales
  Sales: "Sales",
  POS: "Sales",
  CRM: "Sales",

  // Inventory
  Inventory: "Inventory",
  Quality: "Inventory",
  CoilManagement: "Inventory",

  // Finance
  Finance: "Finance",
  Costing: "Finance",
  ChartOfAccounts: "Finance",
  JournalEntry: "Finance",
  AccountLedger: "Finance",
  TreasuryManagement: "Finance",
  FinancialReports: "Finance",
  FixedAssets: "Finance",
  AssetLifecycle: "Finance",
  AssetScanner: "Finance",
  AssetVerification: "Finance",
  DepreciationReports: "Finance",
  BudgetManagement: "Finance",
  ZakatManagement: "Finance",

  // Purchasing / Supply Chain
  Purchasing: "Purchasing",
  SupplyChain: "Purchasing",
  DemandPlanning: "Purchasing",

  // HR
  HR: "HR",
  HRReports: "HR",

  // Projects
  Projects: "Projects",

  // ZATCA / Compliance
  ZATCA: "ZATCA",
  ComplianceReports: "ZATCA",

  // Reports (Professional+)
  Reports: "Reports",
  SalesReports: "Reports",
  InventoryReports: "Reports",
  ManufacturingReports: "Reports",
  QualityMaintenanceReports: "Reports",
  ITSecurityReports: "Reports",

  // Production / Maintenance — enterprise only
  Production: "Production",
  Maintenance: "Maintenance",

  // Always accessible — null means no module gate
  Dashboard: null,
  Analytics: null,
  KPIDashboard: null,
  AIAssistant: null,
  AdminCenter: null,
  MasterDataManagement: null,
  Approvals: null,
  ApprovalWorkflows: null,
  Notifications: null,
  OwnerDashboard: null,
  Integrations: null,
};

/**
 * Check whether a given module name is included in the plan's modules array.
 * Enterprise plans contain "All modules" which grants universal access.
 */
export function hasModule(planModules, moduleName) {
  if (!moduleName) return true;
  if (!Array.isArray(planModules) || planModules.length === 0) return false;
  if (planModules.some((m) => m === "All modules")) return true;
  return planModules.some((m) => m.toLowerCase() === moduleName.toLowerCase());
}

/**
 * Returns the module name that gates a given page path, or null if always accessible.
 */
export function getModuleForPage(pageName) {
  if (pageName in PAGE_MODULE_MAP) return PAGE_MODULE_MAP[pageName];
  return null; // unknown pages are accessible by default
}

/**
 * Module display names and descriptions shown on the locked-module screen.
 */
export const MODULE_INFO = {
  Sales:      { label: "Sales & Invoicing",   description: "Quotations, sales orders, invoices, POS, and ZATCA invoice flow." },
  Inventory:  { label: "Inventory",           description: "Stock levels, movements, transfers, cycle counts, and valuation." },
  Finance:    { label: "Finance",             description: "AR, AP, journal entries, payments, fixed assets, and reports." },
  Purchasing: { label: "Purchasing & Supply Chain", description: "Requisitions, RFQs, purchase orders, GRN, and vendor invoices." },
  HR:         { label: "HR & Payroll",        description: "Employees, payroll, leave, loans, and HR reports." },
  Projects:   { label: "Projects",            description: "Project planning, expenses, milestones, and timesheets." },
  ZATCA:      { label: "ZATCA Compliance",    description: "Phase 1 QR readiness, Phase 2 setup, and submission logs." },
  Reports:    { label: "Advanced Reports",    description: "Sales, inventory, HR, and compliance analytics reports." },
  Production: { label: "Production",          description: "Manufacturing orders, BOM, routing, and production reporting." },
  Maintenance:{ label: "Maintenance",         description: "Preventive maintenance, work orders, and asset uptime tracking." },
};
