import assert from 'node:assert/strict';
import test from 'node:test';
import { pickPostingDate, lastDayOfPeriod } from '../src/lib/postingDate.js';

// An April–March fiscal year: Apr 2025 – Mar 2026.
const FY_2025_26 = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
];

test('today in July 2026 falls back to the last open period, not today', () => {
  // The reported failure: "Accounting period 2026-07 is not open."
  assert.equal(pickPostingDate({ openPeriods: FY_2025_26, today: '2026-07-16' }), '2026-03-31');
});

test('today is kept when its period is open', () => {
  assert.equal(pickPostingDate({ openPeriods: FY_2025_26, today: '2025-09-10' }), '2025-09-10');
});

test('with no period data, today is returned and the server stays the authority', () => {
  assert.equal(pickPostingDate({ openPeriods: [], today: '2026-07-16' }), '2026-07-16');
});

test('picks the LATEST open period when several are open', () => {
  assert.equal(pickPostingDate({ openPeriods: ['2025-04', '2025-05'], today: '2026-07-16' }), '2025-05-31');
});

test('unsorted period input still resolves the latest', () => {
  assert.equal(pickPostingDate({ openPeriods: ['2026-01', '2025-04', '2025-12'], today: '2026-07-16' }), '2026-01-31');
});

test('lastDayOfPeriod handles month lengths, year ends and leap years', () => {
  assert.equal(lastDayOfPeriod('2026-03'), '2026-03-31');
  assert.equal(lastDayOfPeriod('2025-04'), '2025-04-30');
  assert.equal(lastDayOfPeriod('2025-12'), '2025-12-31');
  assert.equal(lastDayOfPeriod('2024-02'), '2024-02-29'); // leap
  assert.equal(lastDayOfPeriod('2025-02'), '2025-02-28');
});

test('garbage period input does not produce an invalid date', () => {
  assert.equal(lastDayOfPeriod('nonsense'), '');
  assert.equal(pickPostingDate({ openPeriods: ['nonsense'], today: '2026-07-16' }), '2026-07-16');
});
