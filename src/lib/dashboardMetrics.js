/**
 * Dashboard figures, computed from the records that postings actually update.
 *
 * Several cards were wrong in ways that looked like "not updating": counts taken
 * over only the newest 10 or 20 records, draft invoices counted as revenue, and
 * cash / stock read from stored fields that almost no posting ever writes. Pure and
 * dependency-light so every rule here is unit tested.
 */

import { isFinalisedInvoice } from './arFromInvoice.js';
import { isCashBankAccount } from './vendorPayment.js';

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const list = (value) => (Array.isArray(value) ? value : []);

const dateOnly = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

/**
 * Orders still awaiting processing — over every order. The card used to count only
 * the 10 newest, so it could never exceed 10 and missed anything older.
 */
export const pendingSalesOrderCount = (orders) =>
  list(orders).filter((o) => o?.status === 'pending_approval' || o?.status === 'draft').length;

/**
 * Scheduled items whose scheduled date has passed. The maintenance card used to take
 * the 20 newest by maintenance_date and then judge overdue by scheduled_date — so
 * the oldest, most overdue jobs were exactly the ones that fell off the list.
 */
export const overdueScheduledCount = (items, today = new Date()) => {
  const cutoff = dateOnly(today);
  return list(items).filter(
    (item) => item?.status === 'scheduled' && item?.scheduled_date && dateOnly(item.scheduled_date) < cutoff
  ).length;
};

/**
 * Issued invoices dated on or after `fromDate`. The old revenue test was
 * `status === "submitted" || payment_status !== "draft"` — payment status is never
 * "draft", so it was always true and draft invoices were counted as revenue.
 */
export const revenueInvoices = (invoices, fromDate) =>
  list(invoices).filter((inv) => isFinalisedInvoice(inv) && dateOnly(inv.invoice_date) >= fromDate);

/** Issued invoices still waiting on payment — drafts are not owed yet. */
export const unpaidInvoiceCount = (invoices) =>
  list(invoices).filter(
    (inv) => isFinalisedInvoice(inv) && (inv.payment_status === 'unpaid' || inv.payment_status === 'overdue')
  ).length;

/**
 * Cash position straight from the ledger: each cash/bank account's opening balance
 * plus its posted movements.
 *
 * The card used to read BankAccount.current_balance, a stored figure only two forms
 * ever wrote — customer receipts, vendor payments, POS sales and journal entries all
 * posted to the GL without touching it, so the card never moved.
 *
 * Lines belonging to a DRAFT journal are skipped, because the Journal Entry page
 * writes lines when it saves a draft. Reversed entries are kept: their mirror entry
 * nets them out. Balances are taken debit-positive, so an overdraft reduces cash.
 */
export const cashPositionFromLedger = ({ accounts = [], lines = [], entries = [] } = {}) => {
  const draftJournals = new Set(
    list(entries)
      .filter((entry) => String(entry?.status ?? '').trim().toLowerCase() === 'draft')
      .map((entry) => String(entry.journal_number))
  );

  // One row per account code, so a duplicated chart row is not counted twice.
  const seen = new Set();
  const cashAccounts = list(accounts).filter((account) => {
    if (!isCashBankAccount(account)) return false;
    const code = String(account.account_code ?? '').trim();
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });

  const movements = new Map(
    cashAccounts.map((account) => [String(account.account_code).trim(), { debit: 0, credit: 0 }])
  );
  for (const line of list(lines)) {
    const movement = movements.get(String(line?.account_code ?? '').trim());
    if (!movement || draftJournals.has(String(line.journal_number))) continue;
    movement.debit += num(line.debit);
    movement.credit += num(line.credit);
  }

  let total = 0;
  for (const account of cashAccounts) {
    const { debit, credit } = movements.get(String(account.account_code).trim());
    const opening = num(account.opening_balance);
    // The opening balance is stored in the account's normal direction, exactly as
    // the Chart of Accounts displays it.
    total += account.normal_balance === 'credit'
      ? -(opening + (credit - debit))
      : opening + (debit - credit);
  }

  return { total, accountCount: cashAccounts.length };
};

/**
 * Active materials at or below their reorder point, judged on stock actually on
 * hand (summed across warehouses), most critical first.
 *
 * This used to read Material.current_stock, which nothing but the material master
 * form writes — goods receipts, deliveries and returns all update StockLevel — so
 * the alert never reflected a single stock movement.
 */
export const lowStockMaterials = ({ materials = [], stockLevels = [] } = {}) => {
  const onHand = new Map();
  for (const level of list(stockLevels)) {
    const code = String(level?.material_code ?? '').trim();
    if (!code) continue;
    onHand.set(code, (onHand.get(code) || 0) + num(level.quantity));
  }

  return list(materials)
    .filter((m) => m?.status === 'active' && num(m.reorder_point) > 0)
    .map((m) => ({ ...m, on_hand: onHand.get(String(m.material_code ?? '').trim()) || 0 }))
    .filter((m) => m.on_hand <= num(m.reorder_point))
    .sort((a, b) => a.on_hand / num(a.reorder_point) - b.on_hand / num(b.reorder_point));
};
