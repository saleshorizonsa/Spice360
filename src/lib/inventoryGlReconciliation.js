import { positionKey } from './stockRevaluation.js';

/**
 * Reconcile the inventory subledger (sum of StockLevel.total_value) against the
 * Inventory GL account balance, and attribute the difference.
 *
 * The two are maintained by different code paths and drift for real reasons:
 *
 *   - Opening balances loaded straight into StockLevel with no journal entry
 *     behind them (stock > GL).
 *   - Cycle-count adjustments and transfers update StockLevel but post no GL
 *     entry (stock moves, GL does not).
 *   - Inbound freight from vendor invoices posted before per-unit freight
 *     capitalisation went in: the freight hit the Inventory GL but not the
 *     per-unit stock cost (GL > stock).
 *   - GRNs posted before the GL mapping was set updated stock but silently
 *     skipped their GL entry (stock > GL).
 *
 * This is read-only. It reports the gap and its sources so it can be understood
 * and corrected deliberately, rather than guessed at.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Did this entry actually hit the ledger?
 *
 * Both 'posted' and 'reversed' did. reverseJournalEntry() creates a MIRROR entry
 * (debits and credits swapped) and marks the original 'reversed' — the mirror is
 * what cancels it, and the original's lines still stand as ledger history.
 *
 * Counting only 'posted' excluded the reversed original while still counting its
 * mirror, so every reversal was subtracted TWICE and the account balance was
 * understated by the reversed amount. Only never-posted drafts are excluded.
 */
const hitTheLedger = (entry) => ['posted', 'reversed'].includes(String(entry?.status || '').toLowerCase());

const REFERENCE_LABELS = {
  grn: 'Goods receipts (GRN)',
  vendor_invoice: 'Vendor invoices (freight capitalised)',
  invoice: 'Sales (goods issued)',
  delivery: 'Deliveries (goods issued)',
  production: 'Production output',
  production_order: 'Production output',
  process_step: 'Processing (WIP)',
  reversal: 'Reversals',
  cogs_grni_correction: 'COGS/GRNI correction',
  adjustment: 'Manual adjustments',
};

export const reconcileInventoryToGl = ({
  stockLevels = [],
  journalEntries = [],
  journalLines = [],
  movements = [],
  gl = {},
} = {}) => {
  const inventoryAccount = gl.inventory;
  if (!inventoryAccount) {
    return { ready: false, reason: 'Inventory account is not mapped.' };
  }

  // ── Subledger: what the stock records say inventory is worth ──
  const stockBookValue = round(stockLevels.reduce((sum, s) => sum + num(s.total_value), 0));

  // ── GL: net movement on the Inventory account (posted entries only) ──
  const entryByJournal = new Map(
    journalEntries.filter(hitTheLedger).map((e) => [String(e.journal_number), e])
  );

  const bySourceMap = new Map();
  let glBalance = 0;

  for (const line of journalLines) {
    if (String(line.account_code) !== String(inventoryAccount)) continue;
    const entry = entryByJournal.get(String(line.journal_number));
    if (!entry) continue; // line belongs to an unposted/reversed entry

    const net = round(num(line.debit) - num(line.credit));
    glBalance = round(glBalance + net);

    const refType = entry.reference_type || 'other';
    bySourceMap.set(refType, round((bySourceMap.get(refType) || 0) + net));
  }

  const bySource = [...bySourceMap.entries()]
    .map(([reference_type, net]) => ({
      reference_type,
      label: REFERENCE_LABELS[reference_type] || reference_type,
      net,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  // ── Opening balances: stock positions with no movement history ──
  const movedKeys = new Set();
  for (const m of movements) {
    if (m.to_warehouse) movedKeys.add(`${m.material_code ?? ''}|${m.to_warehouse}|${m.to_bin ?? ''}|${m.batch_number ?? ''}`);
    if (m.from_warehouse) movedKeys.add(`${m.material_code ?? ''}|${m.from_warehouse}|${m.from_bin ?? ''}|${m.batch_number ?? ''}`);
  }
  const openingPositions = stockLevels.filter((s) => !movedKeys.has(positionKey(s)) && num(s.total_value) !== 0);
  const openingBalanceValue = round(openingPositions.reduce((sum, s) => sum + num(s.total_value), 0));

  const difference = round(stockBookValue - glBalance);

  return {
    ready: true,
    stockBookValue,
    glBalance,
    difference,
    reconciled: Math.abs(difference) < 0.01,
    bySource,
    openingBalanceValue,
    openingCount: openingPositions.length,
  };
};
