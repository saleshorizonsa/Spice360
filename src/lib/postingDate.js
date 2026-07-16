/**
 * Choose a sensible default posting date.
 *
 * Tools that default to "today" break for anyone whose current calendar month sits
 * outside their open fiscal year. On an April–March year, a correction run in July
 * 2026 defaulted to 2026-07 — a period in the NEXT fiscal year that was never open —
 * so posting failed with "Accounting period 2026-07 is not open" before the user got
 * a chance to pick a valid date.
 *
 * Prefer today when today's period is open; otherwise fall back to the last day of
 * the most recent open period. With no period data at all, return today unchanged
 * and let the server remain the authority.
 */

/** Last calendar day of a 'YYYY-MM' period, as 'YYYY-MM-DD'. */
export const lastDayOfPeriod = (period) => {
  const [year, month] = String(period || '').split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return '';
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
};

/**
 * @param {object} args
 * @param {string[]} args.openPeriods  open periods as 'YYYY-MM'
 * @param {string}   args.today        'YYYY-MM-DD'
 * @returns {string} 'YYYY-MM-DD'
 */
export const pickPostingDate = ({ openPeriods = [], today = '' } = {}) => {
  const valid = openPeriods.filter(Boolean);
  if (!valid.length) return today; // no period data — do not second-guess the server

  if (valid.includes(String(today).slice(0, 7))) return today;

  const latest = [...valid].sort().at(-1);
  return lastDayOfPeriod(latest) || today;
};
