import { appParams } from '@/lib/app-params';
import { supabase } from '@/lib/supabaseClient';
import { isMatrixSalesAdminEmail, isMatrixSalesPlatformOwner } from '@/lib/adminAccess';
import { getSubscriptionPlan } from '@/lib/subscriptionPlans';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

let baseClientPromise;

const getBaseClient = async () => {
  if (!baseClientPromise) {
    baseClientPromise = import('@base44/sdk').then(({ createClient }) => createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl
    }));
  }

  return baseClientPromise;
};

const tableNameForEntity = (entityName) =>
  entityName
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();

const metadataColumns = new Set([
  'id',
  'base44_id',
  'tenant_id',
  'organization_id',
  'organization_key',
  'status',
  'created_by',
  'updated_by',
  'source',
  'created_at',
  'updated_at'
]);

const organizationScopedEntityExclusions = new Set([
  'Organization',
  'SubscriptionPlan'
]);

const shouldScopeEntityToOrganization = (entityName) =>
  !organizationScopedEntityExclusions.has(entityName);

const systemEntityNames = new Set([
  'AuditTrail',
  'DocumentNumberSeries',
  'Notification'
]);

const auditableEntityNames = new Set([
  'AccountsPayable',
  'AccountsReceivable',
  'ApprovalMatrix',
  'ApprovalRequest',
  'AssetAllocation',
  'AssetDisposal',
  'AssetMaintenance',
  'AssetVerificationTask',
  'BankAccount',
  'Budget',
  'CAPA',
  'CertificateOfAnalysis',
  'Coil',
  'CoilSlitting',
  'Customer',
  'CycleCount',
  'Delivery',
  'Employee',
  'FixedAsset',
  'GoodsReceiptNote',
  'InspectionLot',
  'Invoice',
  'JournalEntry',
  'LeaveRequest',
  'Material',
  'Payment',
  'PeriodClose',
  'Plant',
  'Product',
  'ProductionOrder',
  'Project',
  'PurchaseOrder',
  'PurchaseRequisition',
  'Quotation',
  'RFQ',
  'Role',
  'SalesOrder',
  'SalesReturn',
  'ServiceContract',
  'ServiceOrder',
  'StockMovement',
  'StockTransferOrder',
  'StorageLocation',
  'User',
  'Vendor',
  'VendorInvoice',
  'WorkOrder',
  'ZATCASubmissionLog'
]);

const periodControlledEntityConfig = {
  AccountsPayable: { module: 'finance', dateFields: ['invoice_date', 'posting_date', 'document_date', 'due_date'] },
  AccountsReceivable: { module: 'finance', dateFields: ['invoice_date', 'posting_date', 'document_date', 'due_date'] },
  Budget: { module: 'finance', dateFields: ['period_start', 'budget_date', 'posting_date', 'document_date'] },
  CashFlowForecast: { module: 'finance', dateFields: ['forecast_date', 'period_start', 'document_date'] },
  FixedAsset: { module: 'finance', dateFields: ['acquisition_date', 'capitalization_date', 'posting_date'] },
  FinancialTransaction: { module: 'finance', dateFields: ['transaction_date', 'posting_date', 'document_date'] },
  Invoice: { module: 'sales', dateFields: ['invoice_date', 'posting_date', 'document_date'] },
  JournalEntry: { module: 'finance', dateFields: ['posting_date', 'document_date', 'entry_date'] },
  Payment: { module: 'finance', dateFields: ['payment_date', 'posting_date', 'document_date'] },
  VendorInvoice: { module: 'purchasing', dateFields: ['invoice_date', 'posting_date', 'document_date'] },
  Delivery: { module: 'sales', dateFields: ['delivery_date', 'posting_date', 'document_date'] },
  GoodsReceiptNote: { module: 'purchasing', dateFields: ['receipt_date', 'posting_date', 'grn_date', 'document_date'] },
  PurchaseOrder: { module: 'purchasing', dateFields: ['order_date', 'posting_date', 'document_date'] },
  PurchaseRequisition: { module: 'purchasing', dateFields: ['request_date', 'requisition_date', 'document_date'] },
  Quotation: { module: 'sales', dateFields: ['quotation_date', 'document_date'] },
  RFQ: { module: 'purchasing', dateFields: ['rfq_date', 'document_date'] },
  SalesOrder: { module: 'sales', dateFields: ['order_date', 'posting_date', 'document_date'] },
  SalesReturn: { module: 'sales', dateFields: ['return_date', 'posting_date', 'document_date'] },
  StockMovement: { module: 'inventory', dateFields: ['movement_date', 'posting_date', 'document_date'] },
  StockTransferOrder: { module: 'inventory', dateFields: ['transfer_date', 'posting_date', 'document_date'] },
  CycleCount: { module: 'inventory', dateFields: ['count_date', 'posting_date', 'document_date'] },
  ProductionOrder: { module: 'operations', dateFields: ['planned_start_date', 'start_date', 'posting_date', 'document_date'] },
  WorkOrder: { module: 'operations', dateFields: ['scheduled_date', 'completion_date', 'posting_date', 'document_date'] },
  Payroll: { module: 'hr', dateFields: ['payroll_date', 'period_start', 'posting_date', 'document_date'] },
  GOSIContribution: { module: 'hr', dateFields: ['contribution_date', 'period_start', 'posting_date'] },
  LeaveRequest: { module: 'hr', dateFields: ['start_date', 'request_date', 'document_date'] },
  LoanAdvance: { module: 'hr', dateFields: ['request_date', 'posting_date', 'document_date'] },
  ProjectExpense: { module: 'projects', dateFields: ['expense_date', 'posting_date', 'document_date'] },
  ProjectInvoice: { module: 'projects', dateFields: ['invoice_date', 'posting_date', 'document_date'] },
  Timesheet: { module: 'projects', dateFields: ['timesheet_date', 'week_start', 'posting_date'] },
  VATReturn: { module: 'compliance', dateFields: ['period_start', 'filing_date', 'document_date'] },
  ZATCASubmissionLog: { module: 'compliance', dateFields: ['submission_date', 'invoice_date', 'document_date'] },
  ZakatComputation: { module: 'compliance', dateFields: ['period_start', 'computation_date'] }
};

const lockedRecordStatusValues = new Set([
  'posted',
  'closed',
  'cleared',
  'reported',
  'paid',
  'completed',
  'pgi_completed',
  'reversed',
  'cancelled',
  'submitted_to_zatca',
  'locked'
]);

const lockedStatusFields = [
  'status',
  'posting_status',
  'payment_status',
  'zatca_status',
  'filing_status',
  'submission_status',
  'period_status'
];

const documentNumberConfig = {
  Quotation: { type: 'quotation', fields: ['quotation_number'] },
  SalesOrder: { type: 'sales_order', fields: ['order_number', 'sales_order_number'] },
  Delivery: { type: 'delivery', fields: ['delivery_number'] },
  Invoice: { type: 'invoice', fields: ['invoice_number'] },
  SalesReturn: { type: 'sales_return', fields: ['return_number'] },
  ServiceContract: { type: 'service_contract', fields: ['contract_number'] },
  ServiceOrder: { type: 'service_order', fields: ['service_order_number'] },
  PurchaseRequisition: { type: 'purchase_requisition', fields: ['requisition_number', 'pr_number'] },
  RFQ: { type: 'rfq', fields: ['rfq_number'] },
  PurchaseOrder: { type: 'purchase_order', fields: ['po_number', 'purchase_order_number'] },
  GoodsReceiptNote: { type: 'grn', fields: ['grn_number', 'receipt_number'] },
  VendorInvoice: { type: 'vendor_invoice', fields: ['vendor_invoice_number'] },
  StockMovement: { type: 'stock_movement', fields: ['movement_number'] },
  StockTransferOrder: { type: 'stock_transfer', fields: ['sto_number'] },
  CycleCount: { type: 'cycle_count', fields: ['count_number'] },
  JournalEntry: { type: 'journal_entry', fields: ['journal_number'] },
  Payment: { type: 'payment', fields: ['payment_number'] },
  ProductionOrder: { type: 'production_order', fields: ['production_order_number'] },
  WorkOrder: { type: 'work_order', fields: ['work_order_number'] },
  Project: { type: 'project', fields: ['project_number'] },
  ProjectExpense: { type: 'expense', fields: ['expense_number'] },
  InspectionLot: { type: 'inspection_lot', fields: ['inspection_lot_number'] },
  NonConformance: { type: 'non_conformance', fields: ['nc_number'] },
  CertificateOfAnalysis: { type: 'coa', fields: ['coa_number'] },
  CAPA: { type: 'capa', fields: ['capa_number'] }
};

const documentPrefixMap = {
  quotation: 'QT',
  sales_order: 'SO',
  delivery: 'DN',
  invoice: 'INV',
  sales_return: 'SR',
  service_order: 'SVC',
  service_contract: 'CTR',
  purchase_requisition: 'PR',
  rfq: 'RFQ',
  purchase_order: 'PO',
  grn: 'GRN',
  vendor_invoice: 'VINV',
  stock_movement: 'SM',
  stock_transfer: 'STO',
  cycle_count: 'CC',
  journal_entry: 'JE',
  payment: 'PAY',
  production_order: 'PRD',
  work_order: 'WO',
  project: 'PRJ',
  expense: 'EXP',
  inspection_lot: 'IL',
  non_conformance: 'NC',
  coa: 'COA',
  capa: 'CAPA'
};

const getDocumentNumberFromRecord = (entityName, record = {}) => {
  const configuredFields = documentNumberConfig[entityName]?.fields || [];
  const fallbackFields = [
    'document_number',
    'number',
    'reference_number',
    'invoice_number',
    'order_number',
    'po_number',
    'journal_number',
    'payment_number',
    'asset_number',
    'employee_number',
    'customer_code',
    'vendor_code',
    'material_code',
    'product_code'
  ];

  const field = [...configuredFields, ...fallbackFields].find((key) => record?.[key]);
  return field ? record[field] : record?.id;
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getPeriodKey = (value) => {
  const date = normalizeDateOnly(value);
  return date ? date.slice(0, 7) : null;
};

const getPeriodPostingDate = (entityName, record = {}) => {
  const config = periodControlledEntityConfig[entityName];
  if (!config) return null;
  const field = config.dateFields.find((key) => record?.[key]);
  return field ? normalizeDateOnly(record[field]) : null;
};

const isRecordStatusLocked = (record = {}) =>
  lockedStatusFields.some((field) => {
    const value = String(record?.[field] || '').toLowerCase();
    return lockedRecordStatusValues.has(value);
  });

const getLockedStatusLabel = (record = {}) => {
  const field = lockedStatusFields.find((key) =>
    lockedRecordStatusValues.has(String(record?.[key] || '').toLowerCase())
  );
  return field ? `${field}: ${record[field]}` : 'locked status';
};

const isDateInPeriod = (postingDate, period = {}) => {
  const date = normalizeDateOnly(postingDate);
  const start = normalizeDateOnly(period.period_start);
  const end = normalizeDateOnly(period.period_end);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
};

const findClosedSupabasePeriod = async ({ client, entityName, record = {}, organizationId = null }) => {
  const config = periodControlledEntityConfig[entityName];
  if (!config) return null;

  const postingDate = getPeriodPostingDate(entityName, record);
  if (!postingDate) return null;

  try {
    let query = client
      .from('period_close')
      .select('*')
      .eq('record->>status', 'closed');

    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01' || /period_close/i.test(error.message || '')) {
        console.warn('Period close table is not available yet; skipping closed-period check.');
        return null;
      }
      throw error;
    }

    const periodKey = getPeriodKey(postingDate);
    return normalizeList(data)
      .map(normalizeRow)
      .find((period) => {
        const moduleMatches = !period.module || period.module === 'all' || period.module === config.module;
        const keyMatches = !period.period_key || period.period_key === periodKey;
        return moduleMatches && keyMatches && isDateInPeriod(postingDate, period);
      }) || null;
  } catch (error) {
    console.warn('Period close check skipped:', error);
    return null;
  }
};

const assertSupabaseRecordCanMutate = async ({
  client,
  entityName,
  action,
  existingRecord = null,
  nextRecord = null,
  organizationId = null
}) => {
  if (entityName === 'PeriodClose') return;

  if ((action === 'update' || action === 'delete') && existingRecord && isRecordStatusLocked(existingRecord)) {
    throw new Error(`This ${tableNameForEntity(entityName).replace(/_/g, ' ')} has ${getLockedStatusLabel(existingRecord)} and cannot be changed. Reverse or reopen it through the approved process.`);
  }

  const checkRecord = nextRecord || existingRecord;
  const closedPeriod = await findClosedSupabasePeriod({
    client,
    entityName,
    record: checkRecord,
    organizationId
  });

  if (closedPeriod) {
    const postingDate = getPeriodPostingDate(entityName, checkRecord);
    throw new Error(`Posting date ${postingDate} is inside closed period ${closedPeriod.period_key || closedPeriod.period_name || closedPeriod.id}. Reopen the period in Admin Center before changing this record.`);
  }
};

const getActiveTenantSubscription = async (client, organizationId) => {
  if (!organizationId) return null;

  try {
    const { data, error } = await client
      .from('subscription')
      .select('*')
      .eq('organization_id', organizationId)
      .in('record->>status', ['trialing', 'active'])
      .limit(1);

    if (error) {
      if (error.code === '42P01' || /subscription/i.test(error.message || '')) return null;
      throw error;
    }

    return normalizeList(data).map(normalizeRow)[0] || null;
  } catch (error) {
    console.warn('Subscription check skipped:', error);
    return null;
  }
};

const assertSubscriptionAllowsCreate = async ({ client, entityName, organizationId, user }) => {
  if (!organizationId || user?.is_platform_owner || user?.role === 'owner' || entityName === 'Subscription') return;

  const subscription = await getActiveTenantSubscription(client, organizationId);
  if (!subscription) return;

  const status = String(subscription.status || '').toLowerCase();
  if (['past_due', 'cancelled', 'expired'].includes(status)) {
    throw new Error(`Subscription is ${status}. Update billing before using paid features.`);
  }

  const plan = getSubscriptionPlan(subscription.plan);
  const limits = subscription.limits || plan?.limits || {};

  if (entityName === 'Invoice' && limits.invoices_per_month) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const { data, error } = await client
      .from('invoice')
      .select('id, record')
      .eq('organization_id', organizationId);

    if (error) throw error;
    const invoiceCount = normalizeList(data)
      .map(normalizeRow)
      .filter((invoice) => String(invoice.invoice_date || invoice.created_at || '').slice(0, 7) === monthKey)
      .length;

    if (invoiceCount >= Number(limits.invoices_per_month)) {
      throw new Error(`Invoice limit reached for the ${subscription.plan_name || plan?.name || 'current'} plan.`);
    }
  }

  if (entityName === 'User' && limits.users) {
    const { data, error } = await client
      .from('user')
      .select('id')
      .eq('organization_id', organizationId);

    if (error) throw error;
    if (normalizeList(data).length >= Number(limits.users)) {
      throw new Error(`User limit reached for the ${subscription.plan_name || plan?.name || 'current'} plan.`);
    }
  }
};

const shouldAutoNumberRecord = (entityName, record = {}) => {
  const config = documentNumberConfig[entityName];
  return config && !config.fields.some((field) => record?.[field]);
};

const getAuditChanges = (beforeData = {}, afterData = {}) => {
  const fieldsChanged = [];
  const changes = { before: {}, after: {} };
  const skippedFields = new Set(['id', 'created_at', 'updated_at', 'created_date', 'updated_date']);
  const keys = new Set([...Object.keys(beforeData || {}), ...Object.keys(afterData || {})]);

  keys.forEach((key) => {
    if (skippedFields.has(key)) return;
    const beforeValue = beforeData?.[key];
    const afterValue = afterData?.[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      fieldsChanged.push(key);
      changes.before[key] = beforeValue;
      changes.after[key] = afterValue;
    }
  });

  return {
    fieldsChanged,
    changes: fieldsChanged.length ? changes : null
  };
};

const getSelectedOrganizationId = () => {
  if (typeof window === 'undefined') return null;
  const selectedId = window.localStorage.getItem('selected_organization_id');
  return selectedId && selectedId !== 'null' && selectedId !== 'undefined' ? selectedId : null;
};

const getSelectedTenantId = () => getSelectedOrganizationId();

const notifyOrganizationsChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('matrixsales:organizations-changed'));
};

const assertUniqueMaterialCode = async ({ client, tableName, record = {}, organizationId = null, currentId = null }) => {
  const materialCode = String(record.material_code || '').trim().toUpperCase();
  if (!materialCode) return;

  let query = client
    .from(tableName)
    .select('id')
    .eq('record->>material_code', materialCode);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;

  const duplicate = normalizeList(data).find((row) => row.id !== currentId);
  if (duplicate) {
    throw new Error(`Material code ${materialCode} already exists for this tenant.`);
  }
};

const normalizeTenantUserRecord = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    ...(row.record || {}),
    tenant_id: row.tenant_id ?? row.organization_id ?? row.record?.tenant_id,
    organization_id: row.organization_id ?? row.tenant_id ?? row.record?.organization_id
  };
};

const getTenantUserProfileForAuthUser = async (client, authUser) => {
  if (!authUser?.email) return null;

  try {
    const selectedOrganizationId = getSelectedOrganizationId();
    let query = client
      .from('user')
      .select('*')
      .eq('record->>email', authUser.email);

    if (selectedOrganizationId) {
      query = query.or(`organization_id.eq.${selectedOrganizationId},tenant_id.eq.${selectedOrganizationId}`);
    }

    const { data, error } = await query.limit(1);
    if (error) throw error;
    if (data?.[0]) return normalizeTenantUserRecord(data[0]);

    const fallback = await client
      .from('user')
      .select('*')
      .eq('record->>email', authUser.email)
      .limit(1);

    if (fallback.error) throw fallback.error;
    return normalizeTenantUserRecord(fallback.data?.[0]);
  } catch (error) {
    console.warn('Unable to load tenant user profile:', error.message || error);
    return null;
  }
};

const normalizeRow = (row) => ({
  ...(row?.record || {}),
  id: row?.id,
  base44_id: row?.base44_id,
  tenant_id: row?.tenant_id ?? row?.organization_id ?? row?.record?.tenant_id,
  organization_id: row?.organization_id,
  organization_key: row?.organization_key,
  status: row?.record?.status ?? row?.status,
  created_by: row?.created_by,
  updated_by: row?.updated_by,
  source: row?.source,
  created_at: row?.created_at,
  updated_at: row?.updated_at
});

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

const sortRecords = (records, sort) => {
  if (!sort) return records;

  const sortFields = String(sort)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  if (sortFields.length === 0) return records;

  return [...records].sort((left, right) => {
    for (const field of sortFields) {
      const descending = field.startsWith('-');
      const key = descending ? field.slice(1) : field;
      const leftValue = left?.[key] ?? '';
      const rightValue = right?.[key] ?? '';

      if (leftValue < rightValue) return descending ? 1 : -1;
      if (leftValue > rightValue) return descending ? -1 : 1;
    }

    return 0;
  });
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
};

const getCurrentSupabaseUser = async () => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error('Authentication required');

  const tenantUser = await getTenantUserProfileForAuthUser(client, data.user);
  const assignedRoles = tenantUser?.assigned_roles || [];
  const tenantRole = tenantUser?.role;
  const isTenantAdmin =
    tenantRole === 'admin' ||
    tenantRole === 'owner' ||
    assignedRoles.includes('TENANT_ADMIN');
  const configuredRole = isMatrixSalesAdminEmail(
    data.user.email,
    import.meta.env.VITE_MATRIXSALES_ADMIN_EMAILS || ''
  ) ? (isMatrixSalesPlatformOwner(data.user.email) ? 'owner' : 'admin') : null;
  const effectiveRole = configuredRole || (isTenantAdmin ? 'admin' : tenantRole || 'user');

  return {
    id: data.user.id,
    email: data.user.email,
    email_verified: Boolean(data.user.email_confirmed_at || data.user.confirmed_at),
    full_name: data.user.user_metadata?.full_name || data.user.email,
    role: effectiveRole,
    tenant_role: tenantRole || null,
    tenant_user_id: tenantUser?.id || null,
    tenant_id: tenantUser?.tenant_id || null,
    organization_id: tenantUser?.organization_id || null,
    is_platform_owner: isMatrixSalesPlatformOwner(data.user.email),
    assigned_roles: assignedRoles
  };
};

const getCurrentSupabaseUserSafe = async () => {
  try {
    return await getCurrentSupabaseUser();
  } catch {
    return {
      id: null,
      email: 'system@horizon.local',
      full_name: 'System',
      role: 'system'
    };
  }
};

const getNextSupabaseDocumentNumber = async (entityName, record = {}) => {
  const config = documentNumberConfig[entityName];
  if (!config) return null;

  const client = requireSupabase();
  const documentType = config.type;
  const branchCode = record.branch_code || record.plant_code || record.organization_key || 'ALL';
  const fiscalYear = new Date().getFullYear().toString().slice(-2);
  const prefix = documentPrefixMap[documentType] || 'DOC';

  const { data: existingSeries, error: readError } = await client
    .from('document_number_series')
    .select('*')
    .eq('record->>document_type', documentType)
    .eq('record->>branch_code', branchCode)
    .eq('record->>fiscal_year', fiscalYear)
    .eq('record->>status', 'active')
    .limit(1);

  if (readError) throw readError;

  let seriesRow = normalizeList(existingSeries)[0];
  let series = normalizeRow(seriesRow);

  if (!seriesRow) {
    const payload = {
      record: {
        series_id: `${prefix}-${branchCode}-${fiscalYear}`,
        document_type: documentType,
        prefix,
        branch_code: branchCode,
        fiscal_year: fiscalYear,
        current_number: 0,
        starting_number: 1,
        number_width: 6,
        format_pattern: '{PREFIX}-{BR}-{FY}-{NNNNNN}',
        status: 'active',
        auto_generate: true
      }
    };

    const { data: createdSeries, error: createError } = await client
      .from('document_number_series')
      .insert(payload)
      .select('*')
      .single();

    if (createError) throw createError;
    seriesRow = createdSeries;
    series = normalizeRow(createdSeries);
  }

  const nextNumber = (Number(series.current_number) || 0) + 1;
  const paddedNumber = String(nextNumber).padStart(Number(series.number_width) || 6, '0');
  const documentNumber = `${series.prefix || prefix}-${series.branch_code || branchCode}-${series.fiscal_year || fiscalYear}-${paddedNumber}`;

  const { error: updateError } = await client
    .from('document_number_series')
    .update({
      record: {
        ...(seriesRow.record || {}),
        current_number: nextNumber,
        last_generated_number: documentNumber,
        last_generated_date: new Date().toISOString()
      }
    })
    .eq('id', seriesRow.id);

  if (updateError) throw updateError;
  return documentNumber;
};

const logSupabaseAuditTrail = async ({
  entityName,
  entityId,
  actionType,
  beforeData = null,
  afterData = null,
  organizationId = null
}) => {
  if (systemEntityNames.has(entityName) || !auditableEntityNames.has(entityName)) return;

  try {
    const client = requireSupabase();
    const user = await getCurrentSupabaseUserSafe();
    const { fieldsChanged, changes } = actionType === 'update'
      ? getAuditChanges(beforeData, afterData)
      : { fieldsChanged: [], changes: null };

    const entityType = tableNameForEntity(entityName);
    const documentNumber = getDocumentNumberFromRecord(entityName, afterData || beforeData || {});
    const changeSummary = actionType === 'update'
      ? (fieldsChanged.length ? `Updated ${fieldsChanged.length} field(s): ${fieldsChanged.join(', ')}` : 'Updated record')
      : `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}d ${entityType.replace(/_/g, ' ')}`;

    await client.from('audit_trail').insert({
      tenant_id: organizationId,
      organization_id: organizationId,
      record: {
        audit_id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        entity_type: entityType,
        entity_id: entityId,
        document_number: documentNumber || entityId,
        action_type: actionType,
        action_timestamp: new Date().toISOString(),
        user_email: user.email,
        user_name: user.full_name || user.email,
        user_role: user.role || 'user',
        changes,
        fields_changed: fieldsChanged,
        change_summary: changeSummary,
        severity: actionType === 'delete' ? 'warning' : 'info',
        is_system_action: user.role === 'system'
      }
    });
  } catch (error) {
    console.error('Audit trail write failed:', error);
  }
};

const createSupabaseEntity = (entityName) => {
  const tableName = tableNameForEntity(entityName);
  const isOrganizationScoped = shouldScopeEntityToOrganization(entityName);

  const listRows = async (filters = {}, sort, limit) => {
    const client = requireSupabase();
    let query = client.from(tableName).select('*');
    const selectedOrganizationId = getSelectedOrganizationId();
    const selectedTenantId = getSelectedTenantId();
    const currentUser = await getCurrentSupabaseUserSafe();
    if (currentUser?.id && !currentUser.email_verified && entityName !== 'SubscriptionPlan') {
      throw new Error('Email verification is required before accessing tenant data.');
    }
    const isPlatformOwner = currentUser?.is_platform_owner || currentUser?.role === 'owner';
    const hasOrganizationFilter = Object.prototype.hasOwnProperty.call(filters || {}, 'organization_id');
    const hasTenantFilter = Object.prototype.hasOwnProperty.call(filters || {}, 'tenant_id');

    if (isOrganizationScoped && isPlatformOwner && !hasTenantFilter && !hasOrganizationFilter) {
      // Platform owner can inspect all tenants from owner dashboards.
    } else if (isOrganizationScoped && selectedTenantId && !hasTenantFilter && !hasOrganizationFilter) {
      query = query.eq('organization_id', selectedTenantId);
    } else if (isOrganizationScoped && !selectedTenantId && !hasTenantFilter && !hasOrganizationFilter) {
      return [];
    } else if (isOrganizationScoped && selectedOrganizationId && !hasOrganizationFilter) {
      query = query.eq('organization_id', selectedOrganizationId);
    }

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (metadataColumns.has(key)) {
        query = query.eq(key, value);
      } else {
        query = query.eq(`record->>${key}`, String(value));
      }
    });

    const { data, error } = await query;
    if (error) throw error;

    let rows = normalizeList(data).map(normalizeRow);

    if (entityName === 'Organization') {
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.is_platform_owner;
      if (!isAdmin) {
        rows = rows.filter((org) => {
          const allowedEmails = Array.isArray(org.admin_emails) ? org.admin_emails : [];
          const allowedUsers = Array.isArray(org.authorized_user_ids) ? org.authorized_user_ids : [];
          return org.owner_user_id === currentUser.id ||
            org.created_by_user_id === currentUser.id ||
            org.owner_email === currentUser.email ||
            org.created_by_email === currentUser.email ||
            allowedEmails.includes(currentUser.email) ||
            allowedUsers.includes(currentUser.id);
        });
      }
    }

    rows = sortRecords(rows, sort);
    return limit ? rows.slice(0, limit) : rows;
  };

  return {
    list: (sort, limit) => listRows({}, sort, limit),
    filter: (filters = {}, sort, limit) => listRows(filters, sort, limit),
    create: async (data = {}) => {
      const client = requireSupabase();
      const currentUser = await getCurrentSupabaseUserSafe();
      if (currentUser?.id && !currentUser.email_verified && entityName !== 'SubscriptionPlan') {
        throw new Error('Email verification is required before creating tenant data.');
      }
      const selectedOrganizationId = getSelectedOrganizationId();
      const organizationId = data.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);
      if (isOrganizationScoped && !organizationId) {
        throw new Error('Tenant is required. Complete company onboarding or select a company before creating records.');
      }
      const record = { ...(data || {}) };

      if (shouldAutoNumberRecord(entityName, record)) {
        try {
          const documentNumber = await getNextSupabaseDocumentNumber(entityName, record);
          const primaryField = documentNumberConfig[entityName]?.fields?.[0];
          if (documentNumber && primaryField) {
            record[primaryField] = documentNumber;
          }
        } catch (error) {
          console.error(`Document number generation failed for ${entityName}:`, error);
        }
      }

      await assertSupabaseRecordCanMutate({
        client,
        entityName,
        action: 'create',
        nextRecord: record,
        organizationId
      });
      await assertSubscriptionAllowsCreate({
        client,
        entityName,
        organizationId,
        user: currentUser
      });
      if (entityName === 'Material') {
        await assertUniqueMaterialCode({ client, tableName, record, organizationId });
      }

      const payload = {
        base44_id: record.base44_id || record.base44Id || null,
        tenant_id: organizationId,
        organization_id: organizationId,
        organization_key: record.organization_key || null,
        record: {
          ...record,
          ...(organizationId ? { tenant_id: organizationId } : {}),
          ...(organizationId ? { organization_id: organizationId } : {})
        }
      };

      const { data: row, error } = await client
        .from(tableName)
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;
      if (entityName === 'Organization') notifyOrganizationsChanged();
      const normalized = normalizeRow(row);
      await logSupabaseAuditTrail({
        entityName,
        entityId: row.id,
        actionType: 'create',
        afterData: normalized,
        organizationId
      });
      return normalized;
    },
    bulkCreate: async (records = []) => {
      const client = requireSupabase();
      const currentSessionUser = await getCurrentSupabaseUserSafe();
      if (currentSessionUser?.id && !currentSessionUser.email_verified && entityName !== 'SubscriptionPlan') {
        throw new Error('Email verification is required before creating tenant data.');
      }
      const selectedOrganizationId = getSelectedOrganizationId();
      const payload = [];

      for (const record of records) {
        const currentUser = await getCurrentSupabaseUserSafe();
        const organizationId = record.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);
        if (isOrganizationScoped && !organizationId) {
          throw new Error('Tenant is required. Complete company onboarding or select a company before creating records.');
        }
        await assertSupabaseRecordCanMutate({
          client,
          entityName,
          action: 'create',
          nextRecord: record,
          organizationId
        });
        await assertSubscriptionAllowsCreate({
          client,
          entityName,
          organizationId,
          user: currentUser
        });

        payload.push({
          base44_id: record.base44_id || record.base44Id || null,
          tenant_id: organizationId,
          organization_id: organizationId,
          organization_key: record.organization_key || null,
          record: {
            ...record,
            ...(organizationId ? { tenant_id: organizationId } : {}),
            ...(organizationId ? { organization_id: organizationId } : {})
          }
        });
      }

      const { data, error } = await client
        .from(tableName)
        .insert(payload)
        .select('*');

      if (error) throw error;
      return normalizeList(data).map(normalizeRow);
    },
    update: async (id, data = {}) => {
      const client = requireSupabase();
      const currentUser = await getCurrentSupabaseUserSafe();
      if (currentUser?.id && !currentUser.email_verified && entityName !== 'SubscriptionPlan') {
        throw new Error('Email verification is required before updating tenant data.');
      }
      const selectedOrganizationId = getSelectedOrganizationId();
      const { data: existing, error: readError } = await client
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (readError) throw readError;

      const record = {
        ...(existing?.record || {}),
        ...(data || {}),
        ...((data?.organization_id || existing?.organization_id || (isOrganizationScoped ? selectedOrganizationId : null))
          ? { organization_id: data?.organization_id || existing?.organization_id || selectedOrganizationId }
          : {}),
        ...((data?.tenant_id || data?.organization_id || existing?.tenant_id || existing?.organization_id || (isOrganizationScoped ? selectedOrganizationId : null))
          ? { tenant_id: data?.tenant_id || data?.organization_id || existing?.tenant_id || existing?.organization_id || selectedOrganizationId }
          : {})
      };
      const organizationId = data?.organization_id || existing?.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);
      const tenantId = data?.tenant_id || data?.organization_id || existing?.tenant_id || existing?.organization_id || (entityName === 'Organization' ? id : organizationId);
      if (isOrganizationScoped && !organizationId) {
        throw new Error('Tenant is required. Select a company before updating records.');
      }

      await assertSupabaseRecordCanMutate({
        client,
        entityName,
        action: 'update',
        existingRecord: normalizeRow(existing),
        nextRecord: record,
        organizationId
      });
      if (entityName === 'Material') {
        await assertUniqueMaterialCode({ client, tableName, record, organizationId, currentId: id });
      }

      const { data: row, error } = await client
        .from(tableName)
        .update({
          tenant_id: tenantId,
          organization_id: organizationId,
          organization_key: data?.organization_key ?? existing?.organization_key ?? null,
          record
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      if (entityName === 'Organization') notifyOrganizationsChanged();
      const normalized = normalizeRow(row);
      await logSupabaseAuditTrail({
        entityName,
        entityId: id,
        actionType: 'update',
        beforeData: normalizeRow(existing),
        afterData: normalized,
        organizationId
      });
      return normalized;
    },
    delete: async (id) => {
      const client = requireSupabase();
      const currentUser = await getCurrentSupabaseUserSafe();
      if (currentUser?.id && !currentUser.email_verified && entityName !== 'SubscriptionPlan') {
        throw new Error('Email verification is required before deleting tenant data.');
      }
      let existing = null;
      try {
        const { data } = await client
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();
        existing = data;
      } catch {
        existing = null;
      }
      await assertSupabaseRecordCanMutate({
        client,
        entityName,
        action: 'delete',
        existingRecord: existing ? normalizeRow(existing) : null,
        organizationId: existing?.organization_id || null
      });
      const { error } = await client.from(tableName).delete().eq('id', id);
      if (error) throw error;
      if (entityName === 'Organization') notifyOrganizationsChanged();
      await logSupabaseAuditTrail({
        entityName,
        entityId: id,
        actionType: 'delete',
        beforeData: existing ? normalizeRow(existing) : { id },
        organizationId: existing?.organization_id || null
      });
      return { id };
    }
  };
};

const supabaseEntities = new Proxy({}, {
  get: (_target, entityName) => createSupabaseEntity(String(entityName))
});

const supabaseMatrixSales = {
  auth: {
    me: getCurrentSupabaseUser,
    logout: () => supabase?.auth.signOut(),
    redirectToLogin: () => {}
  },
  entities: supabaseEntities,
  appLogs: {
    logUserInApp: async () => {}
  },
  integrations: {
    Core: {
      UploadFile: async () => {
        throw new Error('File uploads are not configured for Supabase storage yet.');
      },
      InvokeLLM: async () => {
        throw new Error('AI integrations are not configured for this deployment.');
      }
    },
    InvokeLLM: async () => {
      throw new Error('AI integrations are not configured for this deployment.');
    }
  },
  agents: {
    listConversations: async () => [],
    createConversation: async () => null,
    addMessage: async () => null,
    subscribeToConversation: () => () => {}
  }
};

// ─── PHP API implementation ──────────────────────────────────────────────────

// If VITE_API_URL is set at build time, use it.
// If Supabase is also not configured, fall back to /api on the current origin
// (covers cases where the env var didn't get baked in by the build pipeline).
const phpApiUrl = import.meta.env.VITE_API_URL ||
  (!import.meta.env.VITE_SUPABASE_URL
    ? (typeof window !== 'undefined' ? window.location.origin + '/api' : null)
    : null);

const getAuthToken = () => localStorage.getItem('auth_token');

const apiFetch = async (path, options = {}) => {
  const token = getAuthToken();
  const res = await fetch(`${phpApiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    throw new Error('Session expired. Please log in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

const createPhpApiEntity = (entityName) => ({
  list: (sort, limit) => {
    const params = new URLSearchParams();
    if (sort)  params.set('sort', sort);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    return apiFetch(`/entities/${entityName}${qs ? '?' + qs : ''}`);
  },
  filter: (filters = {}, sort, limit) =>
    apiFetch(`/entities/${entityName}/filter`, {
      method: 'POST',
      body: JSON.stringify({ filters, sort, limit })
    }),
  create: (data) =>
    apiFetch(`/entities/${entityName}`, { method: 'POST', body: JSON.stringify(data) }),
  bulkCreate: (records) =>
    apiFetch(`/entities/${entityName}/bulk`, { method: 'POST', body: JSON.stringify({ records }) }),
  update: (id, data) =>
    apiFetch(`/entities/${entityName}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) =>
    apiFetch(`/entities/${entityName}/${id}`, { method: 'DELETE' })
});

const phpApiEntities = new Proxy({}, {
  get: (_target, entityName) => createPhpApiEntity(String(entityName))
});

const phpApiMatrixSales = {
  auth: {
    me: () => apiFetch('/auth/me'),
    login: (email, password) =>
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then((data) => {
        if (data.token) localStorage.setItem('auth_token', data.token);
        return data;
      }),
    signup: (email, password, options = {}) =>
      apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, ...options }) }),
    logout: () => { localStorage.removeItem('auth_token'); },
    changePassword: (oldPassword, newPassword) =>
      apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) }),
    updateProfile: (data) =>
      apiFetch('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    acceptInvite: (data) =>
      apiFetch('/auth/accept-invite', { method: 'POST', body: JSON.stringify(data) }).then((res) => {
        if (res.token) localStorage.setItem('auth_token', res.token);
        return res;
      }),
    sendInvite: (data) =>
      apiFetch('/auth/send-invite', { method: 'POST', body: JSON.stringify(data) }),
    resend: (email) =>
      apiFetch('/auth/resend', { method: 'POST', body: JSON.stringify({ email }) }),
    confirmEmail: (token) =>
      apiFetch(`/auth/confirm?token=${encodeURIComponent(token)}`),
    forgotPassword: (email) =>
      apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token, password) =>
      apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    redirectToLogin: () => {}
  },
  entities: phpApiEntities,
  appLogs: { logUserInApp: async () => {} },
  integrations: {
    Core: {
      UploadFile: async () => { throw new Error('File upload not configured for self-hosted deployment.'); },
      InvokeLLM: async () => { throw new Error('AI integrations not configured for self-hosted deployment.'); }
    },
    InvokeLLM: async () => { throw new Error('AI integrations not configured for self-hosted deployment.'); }
  },
  agents: {
    listConversations:     async () => [],
    createConversation:    async () => null,
    addMessage:            async () => null,
    subscribeToConversation: () => () => {}
  },
  publicPlans: () =>
    fetch(`${phpApiUrl}/public/plans`, { headers: { 'Content-Type': 'application/json' } })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : []))
      .catch(() => []),
  owner: {
    listTenants: () => apiFetch('/owner/tenants'),
    updateSubscription: (orgId, data) =>
      apiFetch(`/owner/tenants/${orgId}/subscription`, { method: 'POST', body: JSON.stringify(data) }),
    listTenantUsers: (orgId) => apiFetch(`/owner/tenants/${orgId}/users`)
  }
};

// ─── Base44 implementation ───────────────────────────────────────────────────

const createBaseEntity = (entityName) => ({
  list: async (...args) => normalizeList(await (await getBaseClient()).entities[entityName].list(...args)),
  filter: async (...args) => normalizeList(await (await getBaseClient()).entities[entityName].filter(...args)),
  create: async (...args) => (await getBaseClient()).entities[entityName].create(...args),
  bulkCreate: async (...args) => (await getBaseClient()).entities[entityName].bulkCreate(...args),
  update: async (...args) => (await getBaseClient()).entities[entityName].update(...args),
  delete: async (...args) => (await getBaseClient()).entities[entityName].delete(...args)
});

const baseEntities = new Proxy({}, {
  get: (_target, entityName) => createBaseEntity(String(entityName))
});

const baseMatrixSales = {
  auth: {
    me: async (...args) => (await getBaseClient()).auth.me(...args),
    logout: (...args) => {
      getBaseClient().then((client) => client.auth.logout(...args));
    },
    redirectToLogin: (...args) => {
      getBaseClient().then((client) => client.auth.redirectToLogin(...args));
    }
  },
  entities: baseEntities,
  appLogs: {
    logUserInApp: async (...args) => (await getBaseClient()).appLogs.logUserInApp(...args)
  },
  integrations: new Proxy({}, {
    get: (_target, integrationName) => new Proxy({}, {
      get: (_integrationTarget, methodName) => async (...args) =>
        (await getBaseClient()).integrations[integrationName][methodName](...args)
    })
  }),
  agents: new Proxy({}, {
    get: (_target, methodName) => async (...args) =>
      (await getBaseClient()).agents[methodName](...args)
  })
};

export const matrixSales = phpApiUrl   ? phpApiMatrixSales
  : appId       ? baseMatrixSales
  : supabaseMatrixSales;
