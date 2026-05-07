import { appParams } from '@/lib/app-params';
import { supabase } from '@/lib/supabaseClient';
import { isMatrixSalesAdminEmail } from '@/lib/adminAccess';

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
  'User',
  'Role',
  'AuditTrail',
  'IntegrationConfig',
  'IntegrationLog',
  'DocumentNumberSeries'
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

const documentNumberConfig = {
  Quotation: { type: 'quotation', fields: ['quotation_number'] },
  SalesOrder: { type: 'sales_order', fields: ['order_number', 'sales_order_number'] },
  Delivery: { type: 'delivery', fields: ['delivery_number'] },
  Invoice: { type: 'invoice', fields: ['invoice_number'] },
  SalesReturn: { type: 'sales_return', fields: ['return_number'] },
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

const notifyOrganizationsChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('matrixsales:organizations-changed'));
};

const normalizeRow = (row) => ({
  ...(row?.record || {}),
  id: row?.id,
  base44_id: row?.base44_id,
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

  return {
    id: data.user.id,
    email: data.user.email,
    full_name: data.user.user_metadata?.full_name || data.user.email,
    role: isMatrixSalesAdminEmail(
      data.user.email,
      import.meta.env.VITE_MATRIXSALES_ADMIN_EMAILS || ''
    ) ? 'admin' : 'user',
    assigned_roles: []
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
    const hasOrganizationFilter = Object.prototype.hasOwnProperty.call(filters || {}, 'organization_id');

    if (isOrganizationScoped && selectedOrganizationId && !hasOrganizationFilter) {
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

    const rows = sortRecords(normalizeList(data).map(normalizeRow), sort);
    return limit ? rows.slice(0, limit) : rows;
  };

  return {
    list: (sort, limit) => listRows({}, sort, limit),
    filter: (filters = {}, sort, limit) => listRows(filters, sort, limit),
    create: async (data = {}) => {
      const client = requireSupabase();
      const selectedOrganizationId = getSelectedOrganizationId();
      const organizationId = data.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);
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

      const payload = {
        base44_id: record.base44_id || record.base44Id || null,
        organization_id: organizationId,
        organization_key: record.organization_key || null,
        record: {
          ...record,
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
      const selectedOrganizationId = getSelectedOrganizationId();
      const payload = records.map((record) => {
        const organizationId = record.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);
        return {
          base44_id: record.base44_id || record.base44Id || null,
          organization_id: organizationId,
          organization_key: record.organization_key || null,
          record: {
            ...record,
            ...(organizationId ? { organization_id: organizationId } : {})
          }
        };
      });

      const { data, error } = await client
        .from(tableName)
        .insert(payload)
        .select('*');

      if (error) throw error;
      return normalizeList(data).map(normalizeRow);
    },
    update: async (id, data = {}) => {
      const client = requireSupabase();
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
          : {})
      };
      const organizationId = data?.organization_id || existing?.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);

      const { data: row, error } = await client
        .from(tableName)
        .update({
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
      }
    },
    InvokeLLM: async () => {
      throw new Error('AI integrations are not configured for this Supabase deployment.');
    }
  },
  agents: {
    listConversations: async () => [],
    createConversation: async () => null,
    addMessage: async () => null,
    subscribeToConversation: () => () => {}
  }
};

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

export const matrixSales = appId ? baseMatrixSales : supabaseMatrixSales;
