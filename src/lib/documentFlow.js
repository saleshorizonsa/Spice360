/**
 * Document flow — trace the full transaction chain a document belongs to, both
 * upstream (what it came from) and downstream (what followed), across purchasing,
 * sales, finance and production.
 *
 * The links already exist in the data as reference fields; this follows them.
 * Pure and dependency-free so it can be unit tested — the React component just
 * loads the datasets and hands them in.
 */

// Per entity: the field carrying its own number, a label, its module and the
// stage order within that module's chain. Date/status fields are resolved
// leniently at read time.
export const DOC_META = {
  PurchaseRequisition: { numberField: 'pr_number',              label: 'Purchase Requisition', short: 'PR',  module: 'purchasing', stage: 1 },
  RFQ:                 { numberField: 'rfq_number',             label: 'Request for Quotation',short: 'RFQ', module: 'purchasing', stage: 2 },
  PurchaseOrder:       { numberField: 'po_number',              label: 'Purchase Order',       short: 'PO',  module: 'purchasing', stage: 3 },
  GoodsReceiptNote:    { numberField: 'grn_number',             label: 'Goods Receipt Note',   short: 'GRN', module: 'purchasing', stage: 4 },
  VendorInvoice:       { numberField: 'vendor_invoice_number',  label: 'Vendor Invoice',       short: 'VINV',module: 'purchasing', stage: 5 },
  AccountsPayable:     { numberField: 'ap_number',              label: 'Accounts Payable',     short: 'AP',  module: 'finance',    stage: 6 },

  Quotation:           { numberField: 'quotation_number',       label: 'Quotation',            short: 'QT',  module: 'sales',      stage: 1 },
  SalesOrder:          { numberField: 'order_number',           label: 'Sales Order',          short: 'SO',  module: 'sales',      stage: 2 },
  Delivery:            { numberField: 'delivery_number',        label: 'Delivery / PGI',       short: 'DN',  module: 'sales',      stage: 3 },
  Invoice:             { numberField: 'invoice_number',         label: 'Sales Invoice',        short: 'INV', module: 'sales',      stage: 4 },
  AccountsReceivable:  { numberField: 'invoice_number',         label: 'Accounts Receivable',  short: 'AR',  module: 'finance',    stage: 5 },

  Payment:             { numberField: 'payment_number',         label: 'Payment',              short: 'PAY', module: 'finance',    stage: 9 },
  JournalEntry:        { numberField: 'journal_number',         label: 'Journal Entry',        short: 'JE',  module: 'finance',    stage: 10 },
  ProductionOrder:     { numberField: 'order_number',           label: 'Production Order',     short: 'PRD', module: 'production', stage: 1 },
};

// Directed parent→child links. `field` is the CHILD field that points back at the
// parent's number; `[]` in a field path means "an array of objects, match any".
const EDGES = [
  { parent: 'PurchaseRequisition', child: 'RFQ',              field: 'pr_reference' },
  { parent: 'RFQ',                 child: 'PurchaseOrder',    field: 'rfq_reference' },
  { parent: 'PurchaseRequisition', child: 'PurchaseOrder',    field: 'pr_reference' },
  { parent: 'PurchaseOrder',       child: 'GoodsReceiptNote', field: 'po_number' },
  { parent: 'GoodsReceiptNote',    child: 'VendorInvoice',    field: 'grn_references[].grn_number' },
  { parent: 'PurchaseOrder',       child: 'VendorInvoice',    field: 'po_number' },
  { parent: 'VendorInvoice',       child: 'AccountsPayable',  field: 'vendor_invoice_number' },

  { parent: 'Quotation',           child: 'SalesOrder',       field: 'quotation_reference' },
  { parent: 'SalesOrder',          child: 'Delivery',         field: 'sales_order_number' },
  { parent: 'SalesOrder',          child: 'Invoice',          field: 'sales_order_number' },
  { parent: 'Delivery',            child: 'Invoice',          field: 'delivery_references[].delivery_number' },
  { parent: 'Invoice',             child: 'AccountsReceivable',field: 'invoice_number' },
];

const clean = (value) => String(value ?? '').trim();

const numberOf = (type, record) => clean(record?.[DOC_META[type]?.numberField]);

/** All values a child record holds in `fieldPath` (scalar or array-of-objects). */
const childRefValues = (record, fieldPath) => {
  const arrayMatch = fieldPath.match(/^(.+)\[\]\.(.+)$/);
  if (arrayMatch) {
    const [, arrayField, subField] = arrayMatch;
    let arr = record?.[arrayField];
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => clean(item?.[subField])).filter(Boolean);
  }
  // A scalar field may itself hold a comma-joined list (backward-compat).
  return clean(record?.[fieldPath]).split(',').map((s) => s.trim()).filter(Boolean);
};

const nodeKey = (type, number) => `${type}::${number}`;

/**
 * Trace every document connected to a seed, following reference links in both
 * directions. Returns ordered nodes and the edges between them.
 *
 * @param {object} args
 * @param {string} args.seedType    entity type of the starting document
 * @param {string} args.seedNumber  its document number
 * @param {object} args.datasets    { [entityType]: record[] }
 */
export const traceDocumentFlow = ({ seedType, seedNumber, datasets = {} } = {}) => {
  const seed = clean(seedNumber);
  if (!DOC_META[seedType] || !seed) return { nodes: [], edges: [], seedKey: null };

  const records = (type) => (Array.isArray(datasets[type]) ? datasets[type] : []);

  const found = new Map(); // key -> { type, record }
  const edgeSet = new Map(); // "from|to" -> {from, to, via}

  const addNode = (type, record) => {
    const number = numberOf(type, record);
    if (!number) return null;
    const key = nodeKey(type, number);
    if (!found.has(key)) found.set(key, { type, record, number });
    return key;
  };

  const addEdge = (fromKey, toKey, via) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const id = `${fromKey}|${toKey}`;
    if (!edgeSet.has(id)) edgeSet.set(id, { from: fromKey, to: toKey, via });
  };

  // Seed the search.
  const seedRecord = records(seedType).find((r) => numberOf(seedType, r) === seed);
  const seedKey = nodeKey(seedType, seed);
  found.set(seedKey, { type: seedType, record: seedRecord || null, number: seed });

  // Breadth-first over both directions until nothing new appears.
  const queue = [seedKey];
  const visited = new Set();

  while (queue.length) {
    const key = queue.shift();
    if (visited.has(key)) continue;
    visited.add(key);

    const node = found.get(key);
    if (!node) continue;
    const { type, record, number } = node;

    // ── UPSTREAM: this node as a child, find its parents ──
    for (const edge of EDGES.filter((e) => e.child === type)) {
      if (!record) continue;
      const refValues = childRefValues(record, edge.field);
      for (const ref of refValues) {
        const parent = records(edge.parent).find((r) => numberOf(edge.parent, r) === ref);
        const pKey = parent ? addNode(edge.parent, parent) : (ref ? (() => {
          // Parent referenced but not in the dataset — show it as a stub node.
          const k = nodeKey(edge.parent, ref);
          if (!found.has(k)) found.set(k, { type: edge.parent, record: null, number: ref });
          return k;
        })() : null);
        if (pKey) { addEdge(pKey, key, edge.field); queue.push(pKey); }
      }
    }

    // ── DOWNSTREAM: this node as a parent, find its children ──
    for (const edge of EDGES.filter((e) => e.parent === type)) {
      for (const cand of records(edge.child)) {
        if (childRefValues(cand, edge.field).includes(number)) {
          const cKey = addNode(edge.child, cand);
          if (cKey) { addEdge(key, cKey, edge.field); queue.push(cKey); }
        }
      }
    }

    // ── Journal entries posted against this document number ──
    for (const je of records('JournalEntry')) {
      if (clean(je.reference_id) === number) {
        const jKey = addNode('JournalEntry', je);
        if (jKey) addEdge(key, jKey, 'reference_id');
      }
    }

    // ── Payments that reference this document number ──
    for (const pay of records('Payment')) {
      if (clean(pay.reference_number) === number) {
        const payKey = addNode('Payment', pay);
        if (payKey) addEdge(key, payKey, 'reference_number');
      }
    }
  }

  const nodes = [...found.entries()]
    .map(([key, n]) => ({
      key,
      type: n.type,
      number: n.number,
      record: n.record,
      label: DOC_META[n.type]?.label || n.type,
      short: DOC_META[n.type]?.short || n.type,
      module: DOC_META[n.type]?.module || 'other',
      stage: DOC_META[n.type]?.stage ?? 99,
      missing: !n.record,
    }))
    .sort((a, b) => (a.stage - b.stage) || a.type.localeCompare(b.type) || a.number.localeCompare(b.number));

  return { nodes, edges: [...edgeSet.values()], seedKey };
};

/** Which entity types the trace needs loaded for a given seed's module(s). */
export const relatedEntityTypes = () => Object.keys(DOC_META);
