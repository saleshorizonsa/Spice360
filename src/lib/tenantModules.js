export const businessTypes = [
  { value: "it_services", label: "IT Services" },
  { value: "consulting", label: "Consulting" },
  { value: "trading", label: "Trading" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" }
];

export const moduleCatalog = [
  { key: "crm", label: "CRM", description: "Customers, contacts, opportunities, and account activity." },
  { key: "sales", label: "Quotations", description: "Service quotations, approvals, and quote conversion." },
  { key: "contracts", label: "Contracts", description: "Service contracts, SLA terms, and lifecycle tracking." },
  { key: "recurring_billing", label: "Recurring Billing", description: "Monthly, annual, and contract-linked invoice schedules." },
  { key: "finance", label: "Finance", description: "Invoices, payments, receivables, and accounting controls." },
  { key: "zatca", label: "ZATCA", description: "Saudi VAT, QR, PDF, bilingual invoice, and Phase 2 readiness." },
  { key: "reports", label: "Reports", description: "MRR, ARR, renewals, collections, VAT, and service KPIs." },
  { key: "helpdesk", label: "Helpdesk", description: "Support tickets, SLA follow-up, and customer service workflows." },
  { key: "customer_portal", label: "Customer Portal", description: "Customer invoice, quote, contract, payment, and ticket access." },
  { key: "whatsapp", label: "WhatsApp", description: "Invoice, quotation, payment reminder, and renewal sharing." },
  { key: "approvals", label: "Approvals", description: "Lightweight approvals for quotes, invoices, and setup changes." },
  { key: "admin", label: "Admin", description: "Tenant setup, roles, users, numbering, and preferences." },
  { key: "inventory", label: "Inventory", description: "Optional stock, warehouse, and material controls." },
  { key: "purchasing", label: "Purchasing", description: "Optional purchasing and vendor procurement workflows." },
  { key: "supply_chain", label: "Supply Chain", description: "Optional logistics, demand, and supply chain workflows." },
  { key: "manufacturing", label: "Manufacturing", description: "Optional production and factory planning workflows." },
  { key: "projects", label: "Projects", description: "Optional project delivery and task tracking." },
  { key: "hr", label: "HR", description: "Optional employee and payroll operations." },
  { key: "assets", label: "Assets", description: "Optional fixed asset and lifecycle management." },
  { key: "pos", label: "POS", description: "Optional point-of-sale workflows." },
  { key: "ai", label: "AI Assistant", description: "Optional assistant and automation workspace." }
];

export const serviceBusinessModules = {
  crm: true,
  sales: true,
  contracts: true,
  recurring_billing: true,
  finance: true,
  zatca: true,
  reports: true,
  helpdesk: true,
  customer_portal: true,
  whatsapp: true,
  approvals: true,
  admin: true,
  inventory: false,
  purchasing: false,
  supply_chain: false,
  manufacturing: false,
  projects: false,
  hr: false,
  assets: false,
  pos: false,
  ai: true
};

export const moduleDefaultsByBusinessType = {
  it_services: serviceBusinessModules,
  consulting: {
    ...serviceBusinessModules,
    helpdesk: false,
    customer_portal: true,
    projects: true
  },
  trading: {
    ...serviceBusinessModules,
    contracts: false,
    recurring_billing: false,
    helpdesk: false,
    customer_portal: false,
    inventory: true,
    purchasing: true,
    supply_chain: true,
    pos: false
  },
  retail: {
    ...serviceBusinessModules,
    contracts: false,
    recurring_billing: false,
    helpdesk: false,
    inventory: true,
    purchasing: true,
    pos: true
  },
  manufacturing: {
    ...serviceBusinessModules,
    contracts: false,
    recurring_billing: false,
    helpdesk: false,
    inventory: true,
    purchasing: true,
    supply_chain: true,
    manufacturing: true,
    projects: true,
    hr: true,
    assets: true
  }
};

export const modulePageMap = {
  Dashboard: ["crm", "finance", "contracts", "recurring_billing", "zatca", "reports"],
  CRM: ["crm"],
  Sales: ["sales", "contracts", "recurring_billing"],
  SalesReports: ["reports", "sales"],
  Finance: ["finance"],
  FinancialReports: ["reports", "finance"],
  ZATCA: ["zatca"],
  ZakatManagement: ["zatca"],
  ComplianceReports: ["zatca", "reports"],
  Reports: ["reports"],
  KPIDashboard: ["reports"],
  Analytics: ["reports"],
  Approvals: ["approvals"],
  ApprovalWorkflows: ["approvals"],
  AdminCenter: ["admin"],
  MasterDataManagement: ["admin", "crm", "finance"],
  Inventory: ["inventory"],
  InventoryReports: ["inventory", "reports"],
  Purchasing: ["purchasing"],
  SupplyChain: ["supply_chain"],
  DemandPlanning: ["supply_chain"],
  Quality: ["inventory", "manufacturing"],
  QualityMaintenanceReports: ["inventory", "manufacturing", "reports"],
  Production: ["manufacturing"],
  ManufacturingReports: ["manufacturing", "reports"],
  Costing: ["manufacturing", "finance"],
  Projects: ["projects"],
  HR: ["hr"],
  HRReports: ["hr", "reports"],
  FixedAssets: ["assets", "finance"],
  AssetLifecycle: ["assets"],
  AssetScanner: ["assets"],
  AssetVerification: ["assets"],
  DepreciationReports: ["assets", "finance"],
  POS: ["pos"],
  AIAssistant: ["ai"],
  Notifications: ["crm", "finance", "contracts", "reports"],
  MobileMenu: ["crm", "finance", "contracts", "reports"],
  OwnerDashboard: ["admin"],
  Integrations: ["admin"],
  BudgetManagement: ["finance"],
  TreasuryManagement: ["finance"],
  ITSecurityReports: ["reports"],
  CoilManagement: ["inventory", "manufacturing"]
};

const normalizeModuleObject = (modules) => {
  if (Array.isArray(modules)) {
    return moduleCatalog.reduce((acc, item) => {
      acc[item.key] = modules.includes(item.key);
      return acc;
    }, {});
  }

  if (modules && typeof modules === "object") {
    return moduleCatalog.reduce((acc, item) => {
      acc[item.key] = Boolean(modules[item.key]);
      return acc;
    }, {});
  }

  return null;
};

export const getDefaultModulesForBusinessType = (businessType = "it_services") => ({
  ...serviceBusinessModules,
  ...(moduleDefaultsByBusinessType[businessType] || moduleDefaultsByBusinessType.it_services)
});

export const getEnabledModulesForOrganization = (organization = null) => {
  const configured = normalizeModuleObject(organization?.tenant_modules || organization?.module_config);
  if (configured) return configured;

  if (organization?.business_type && organization?.enabled_modules) {
    const legacyModules = normalizeModuleObject(organization.enabled_modules);
    if (legacyModules) return legacyModules;
  }

  return getDefaultModulesForBusinessType(organization?.business_type || "it_services");
};

export const getEnabledModuleKeys = (modules) =>
  Object.entries(modules || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);

export const isModuleEnabled = (modules, moduleKey) => Boolean(modules?.[moduleKey]);

export const isPageEnabledForModules = (pageName, modules, isPlatformOwner = false) => {
  if (isPlatformOwner) return true;
  const requiredModules = modulePageMap[pageName];
  if (!requiredModules) return true;
  return requiredModules.some((moduleKey) => isModuleEnabled(modules, moduleKey));
};

export const filterItemsByModules = (items, modules, isPlatformOwner = false) =>
  (items || []).filter((item) => isPageEnabledForModules(item.path, modules, isPlatformOwner));

export const getBusinessTypeLabel = (businessType) =>
  businessTypes.find((item) => item.value === businessType)?.label || "IT Services";
