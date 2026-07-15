import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCogsGrniCorrection,
  buildCorrectionJournalLines,
  CORRECTION_REF_TYPE,
} from '../src/lib/cogsGrniCorrection.js';

const gl = { cogs_general: '5001', grni: '2110', inventory: '1200', trade_payables: '2100' };

// Mirrors the real situation: 4 old invoices left 680,100 wrongly in COGS and
// 680,100 uncleared in GRNI. Newer invoices correctly debited 254,800 of GRNI.
const scenario = () => {
  const journalEntries = [
    { journal_number: 'JE-P1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1', entry_date: '2026-01-01' },
    { journal_number: 'JE-P2', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-2', entry_date: '2026-01-02' },
    { journal_number: 'JE-G1', status: 'posted', reference_type: 'grn',            reference_id: 'GRN-1', entry_date: '2026-01-01' },
    { journal_number: 'JE-G2', status: 'posted', reference_type: 'grn',            reference_id: 'GRN-2', entry_date: '2026-01-02' },
    { journal_number: 'JE-NEW', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-9', entry_date: '2026-06-01' },
  ];
  const journalLines = [
    // Two old buggy invoices: Dr COGS
    { journal_number: 'JE-P1', account_code: '5001', debit: 400000, credit: 0 },
    { journal_number: 'JE-P2', account_code: '5001', debit: 280100, credit: 0 },
    // Their GRNs credited GRNI, never cleared
    { journal_number: 'JE-G1', account_code: '2110', debit: 0, credit: 400000 },
    { journal_number: 'JE-G2', account_code: '2110', debit: 0, credit: 280100 },
    // Newer correct invoices already debited GRNI 254,800 (and its GRN credited it)
    { journal_number: 'JE-NEW', account_code: '2110', debit: 254800, credit: 0 },
    { journal_number: 'JE-GX',  account_code: '2110', debit: 0, credit: 254800 },
  ];
  return { journalEntries, journalLines };
};

test('computes the exact correction and confirms COGS reconciles with GRNI', () => {
  const { journalEntries, journalLines } = scenario();
  const r = computeCogsGrniCorrection({ journalEntries, journalLines, gl });

  assert.equal(r.grossCogs, 680100);
  assert.equal(r.remainingCogs, 680100);
  assert.equal(r.grniUncleared, 680100);  // 934,900 credited − 254,800 debited
  assert.equal(r.amount, 680100);
  assert.ok(r.reconciles);                 // the two figures match to the cent
  assert.ok(r.ready);
});

test('the correction entry is Dr GRNI / Cr COGS and balances', () => {
  const lines = buildCorrectionJournalLines({ amount: 680100, gl, description: 'reclass' });
  const grni = lines.find((l) => l.account_code === '2110');
  const cogs = lines.find((l) => l.account_code === '5001');
  assert.equal(grni.debit, 680100);
  assert.equal(cogs.credit, 680100);
  const debits = lines.reduce((s, l) => s + l.debit, 0);
  const credits = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debits, credits);
});

// ── Idempotency: once posted, there is nothing left to do ────────────────────
test('after the correction is posted, re-running finds nothing', () => {
  const { journalEntries, journalLines } = scenario();
  // Simulate the posted correction: a CORRECTION_REF_TYPE journal, Dr GRNI / Cr COGS.
  journalEntries.push({ journal_number: 'JE-FIX', status: 'posted', reference_type: CORRECTION_REF_TYPE, reference_id: 'COGS-GRNI-RECLASS', entry_date: '2026-07-15' });
  journalLines.push({ journal_number: 'JE-FIX', account_code: '2110', debit: 680100, credit: 0 });
  journalLines.push({ journal_number: 'JE-FIX', account_code: '5001', debit: 0, credit: 680100 });

  const r = computeCogsGrniCorrection({ journalEntries, journalLines, gl });
  assert.equal(r.alreadyCorrected, 680100);
  assert.equal(r.remainingCogs, 0);
  assert.equal(r.grniUncleared, 0);
  assert.equal(r.ready, false);
  assert.match(r.reason, /already been reclassified/i);
});

test('a partial prior correction leaves only the remainder', () => {
  const { journalEntries, journalLines } = scenario();
  journalEntries.push({ journal_number: 'JE-FIX1', status: 'posted', reference_type: CORRECTION_REF_TYPE, reference_id: 'x', entry_date: '2026-07-10' });
  journalLines.push({ journal_number: 'JE-FIX1', account_code: '2110', debit: 200000, credit: 0 });
  journalLines.push({ journal_number: 'JE-FIX1', account_code: '5001', debit: 0, credit: 200000 });

  const r = computeCogsGrniCorrection({ journalEntries, journalLines, gl });
  assert.equal(r.remainingCogs, 480100);
  assert.equal(r.grniUncleared, 480100);
  assert.equal(r.amount, 480100);
  assert.ok(r.ready);
});

// ── Safety guards ────────────────────────────────────────────────────────────
test('refuses to clear more GRNI than exists', () => {
  const journalEntries = [
    { journal_number: 'JE-P1', status: 'posted', reference_type: 'vendor_invoice', reference_id: 'VI-1' },
  ];
  const journalLines = [
    { journal_number: 'JE-P1', account_code: '5001', debit: 500000, credit: 0 }, // big wrong COGS
    { journal_number: 'JE-G1', account_code: '2110', debit: 0, credit: 100000 }, // only 100k in GRNI
  ];
  const r = computeCogsGrniCorrection({ journalEntries, journalLines, gl });
  assert.equal(r.remainingCogs, 500000);
  assert.equal(r.grniUncleared, 100000);
  assert.equal(r.withinGrni, false);
  assert.equal(r.ready, false);
  assert.match(r.reason, /needs manual review/i);
});

test('a reversed purchase journal is not counted', () => {
  const journalEntries = [
    { journal_number: 'JE-P1', status: 'reversed', reference_type: 'vendor_invoice', reference_id: 'VI-1' },
  ];
  const journalLines = [{ journal_number: 'JE-P1', account_code: '5001', debit: 500000, credit: 0 }];
  const r = computeCogsGrniCorrection({ journalEntries, journalLines, gl });
  assert.equal(r.grossCogs, 0);
  assert.equal(r.ready, false);
});

test('does nothing without a GL mapping', () => {
  const r = computeCogsGrniCorrection({ journalEntries: [], journalLines: [], gl: {} });
  assert.equal(r.ready, false);
  assert.match(r.reason, /mapping is incomplete/i);
});
