/**
 * Detect and repair finalised sales invoices that are not fully reflected in the
 * books. An invoice should produce THREE things; historically only the first was
 * always written, so the GL and the financial statements silently understated AR:
 *
 *   1. an AccountsReceivable subledger record        → Finance → AR tab
 *   2. Dr Receivables / Cr Revenue / Cr VAT journal  → Trial Balance / Balance Sheet
 *   3. Dr COGS / Cr Inventory (when not delivered)   → P&L cost of sales
 *
 * These helpers find what's missing per invoice and build the journals, matching
 * exactly what InvoiceForm posts on a fresh invoice — so a backfill and a live save
 * produce identical entries. Presence is judged from the ACTUAL posted journals, not
 * a flag, so re-running never double-posts.
 */

import { isFinalisedInvoice, buildArRecordFromInvoice } from './arFromInvoice.js';

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// A journal counts as on the ledger if posted or reversed (a reversed entry's lines
// still stand as history; its mirror cancels it) — never a draft.
const POSTED = new Set(['posted', 'reversed']);
const hitLedger = (entry) => POSTED.has(String(entry?.status || '').toLowerCase());

/** Is there already a posted journal of `refType` for this invoice number? */
export const hasInvoiceJournal = (journalEntries = [], refType, invoiceNumber) => {
  const inv = String(invoiceNumber || '');
  return journalEntries.some((e) =>
    hitLedger(e) && String(e.reference_type) === refType && String(e.reference_id) === inv);
};

const hasDeliveryRefs = (invoice = {}) => {
  const r = invoice.delivery_references;
  if (Array.isArray(r)) return r.length > 0;
  if (typeof r === 'string' && r) {
    try { return JSON.parse(r).length > 0; } catch { return false; }
  }
  return false;
};

/**
 * What is missing for one invoice. Returns null for invoices that are not receivable
 * (draft/cancelled/void). COGS is only relevant when the invoice carries a physical
 * product and no Delivery already issued the goods (a Delivery posts COGS itself).
 */
export const assessInvoiceReflection = (invoice = {}, arRecords = [], journalEntries = []) => {
  if (!isFinalisedInvoice(invoice)) return null;
  const invNo = String(invoice.invoice_number || '');
  const hasAr = arRecords.some((ar) => String(ar.invoice_number || '') === invNo);
  const needsArGl = !hasInvoiceJournal(journalEntries, 'sales_invoice', invNo);
  const needsCogs = !!invoice.product_code
    && !hasDeliveryRefs(invoice)
    && !hasInvoiceJournal(journalEntries, 'sales_invoice_cogs', invNo);
  return {
    invoice,
    invoice_number: invNo,
    customer_name: invoice.customer_name || '',
    invoice_date: invoice.invoice_date || '',
    status: invoice.status || '',
    total_amount: num(invoice.total_amount),
    needsAr: !hasAr,
    needsArGl,
    needsCogs,
  };
};

/** Finalised invoices missing their AR record, GL journal, or COGS. */
export const findUnreflectedInvoices = (invoices = [], arRecords = [], journalEntries = []) =>
  invoices
    .map((inv) => assessInvoiceReflection(inv, arRecords, journalEntries))
    .filter(Boolean)
    .filter((r) => r.needsAr || r.needsArGl || r.needsCogs);

/** Dr Receivables / Cr Revenue / Cr VAT — identical to InvoiceForm's entry. */
export const buildSalesInvoiceGlLines = (invoice = {}, gl = {}) => [
  { account_code: gl.ar_receivables, account_name: 'Trade Receivables', debit: num(invoice.total_amount), credit: 0 },
  { account_code: gl.sales_revenue,  account_name: 'Sales Revenue',     debit: 0, credit: num(invoice.subtotal) },
  { account_code: gl.vat_output,     account_name: 'VAT Payable',       debit: 0, credit: num(invoice.tax_amount || invoice.vat_amount || 0) },
].filter((l) => Number(l.debit || l.credit || 0) > 0);

/** Dr COGS / Cr Inventory at the given unit cost. Empty when the amount is zero. */
export const buildCogsGlLines = (invoice = {}, unitCost = 0, gl = {}) => {
  const amount = Math.round(num(unitCost) * num(invoice.quantity) * 100) / 100;
  if (amount <= 0) return [];
  return [
    { account_code: gl.cogs_general, account_name: 'Cost of Goods Sold', debit: amount, credit: 0, description: `${invoice.product_name || invoice.product_code} × ${num(invoice.quantity)}` },
    { account_code: gl.inventory,    account_name: 'Inventory',          debit: 0, credit: amount, description: `Goods issue: ${invoice.invoice_number}` },
  ];
};

export { buildArRecordFromInvoice };
