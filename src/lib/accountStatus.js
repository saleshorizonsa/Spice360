/**
 * Which Chart of Accounts records may be posted to.
 *
 * Kept dependency-free (no React, no client) so it can be unit tested and reused
 * by both the account hooks and the reporting code.
 *
 * Why this exists: `status` is a metadata column, so querying with
 * `.filter({ status: 'active' })` becomes a strict SQL `eq('status','active')`
 * against a generated column. An account saved as "Active", or with the status
 * left blank, matched nothing — it silently vanished from every account dropdown
 * ("No results found") while still being listed on the Chart of Accounts page.
 *
 * So: list the accounts, and exclude only the ones *explicitly* disabled. An
 * account with no status is treated as usable, which is how the trial balance
 * already reasons about it (it skips only `status === 'inactive'`).
 */
export const DISABLED_ACCOUNT_STATUSES = new Set([
  'inactive',
  'archived',
  'closed',
  'blocked',
  'disabled',
]);

export const isPostableAccount = (account = {}) => {
  const status = String(account?.status ?? '').trim().toLowerCase();
  if (!status) return true; // an unset status must never hide the account
  return !DISABLED_ACCOUNT_STATUSES.has(status);
};
