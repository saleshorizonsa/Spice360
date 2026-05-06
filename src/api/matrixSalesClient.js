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
    create: async (data) => {
      const client = requireSupabase();
      const selectedOrganizationId = getSelectedOrganizationId();
      const organizationId = data.organization_id || (isOrganizationScoped ? selectedOrganizationId : null);
      const payload = {
        base44_id: data.base44_id || data.base44Id || null,
        organization_id: organizationId,
        organization_key: data.organization_key || null,
        record: {
          ...(data || {}),
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
      return normalizeRow(row);
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
    update: async (id, data) => {
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
      return normalizeRow(row);
    },
    delete: async (id) => {
      const client = requireSupabase();
      const { error } = await client.from(tableName).delete().eq('id', id);
      if (error) throw error;
      if (entityName === 'Organization') notifyOrganizationsChanged();
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
