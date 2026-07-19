import { normalizeAccountType } from './financialStatements.js';

/**
 * Suggest a GL Account Mapping by matching each posting role against the real
 * Chart of Accounts, by account name and account type.
 *
 * The mapping screen used to pre-fill every role with a hard-coded guess
 * (trade_payables -> "2100", inventory -> "1200", …). Those codes are generic and
 * frequently mean something else entirely in a real chart — which is how vendor
 * invoices ended up posting to Accrued Expenses. This matches against the
 * accounts that actually exist instead of guessing.
 *
 * Deliberately conservative: a role is only suggested when a keyword genuinely
 * matches and the account type is compatible. No match means no suggestion —
 * an empty field the user must fill is far safer than a confident wrong one.
 */

// Keywords are ordered most-specific first; an earlier keyword scores higher, so
// "trade payables" beats a loose "payable" hit. `types` constrains the match to
// compatible account types (as classified by normalizeAccountType).
const ROLE_RULES = {
  ar_receivables:     { types: ['asset'],                      keywords: ['trade receivable', 'accounts receivable', 'account receivable', 'trade debtor', 'receivable', 'debtor'] },
  inventory:          { types: ['asset'],                      keywords: ['inventory', 'stock on hand', 'stock'] },
  cash_bank:          { types: ['asset'],                      keywords: ['cash at bank', 'cash and bank', 'cash & bank', 'bank', 'cash'] },
  vat_input:          { types: ['asset', 'liability'],         keywords: ['vat input', 'input vat', 'vat recoverable', 'vat receivable'] },
  accum_depreciation: { types: ['asset'],                      keywords: ['accumulated depreciation', 'accum depreciation', 'accumulated dep'] },
  fixed_asset_cost:   { types: ['asset'],                      keywords: ['property, plant', 'property plant', 'fixed asset', 'plant and equipment'] },

  trade_payables:     { types: ['liability'],                  keywords: ['trade payable', 'accounts payable', 'account payable', 'trade creditor', 'payable', 'creditor'] },
  grni:               { types: ['liability'],                  keywords: ['goods received not invoiced', 'grni', 'goods received'] },
  freight_accrual:    { types: ['liability'],                  keywords: ['freight accrual', 'freight payable', 'carriage payable', 'freight clearing'] },
  vat_output:         { types: ['liability'],                  keywords: ['vat output', 'output vat', 'vat payable'] },
  salaries_payable:   { types: ['liability'],                  keywords: ['salaries payable', 'salary payable', 'wages payable'] },
  epf_payable:        { types: ['liability'],                  keywords: ['epf payable', 'epf'] },
  etf_payable:        { types: ['liability'],                  keywords: ['etf payable', 'etf'] },
  apit_payable:       { types: ['liability'],                  keywords: ['apit payable', 'apit', 'paye payable', 'paye'] },
  wht_net_payable:    { types: ['liability'],                  keywords: ['wht payable', 'withholding tax payable', 'withholding payable'] },
  accrued_mfg_costs:  { types: ['liability'],                  keywords: ['accrued manufacturing', 'accrued production', 'accrued processing'] },

  sales_revenue:      { types: ['revenue'],                    keywords: ['sales revenue', 'revenue from', 'sales', 'revenue', 'turnover'] },
  gain_on_disposal:   { types: ['revenue', 'other_income'],    keywords: ['gain on disposal', 'gain on sale', 'profit on disposal'] },

  cogs_general:       { types: ['cost_of_sales', 'expense'],   keywords: ['cost of goods sold', 'cost of sales', 'cogs'] },
  salaries_expense:   { types: ['expense'],                    keywords: ['salaries expense', 'salaries and wages', 'salaries', 'wages', 'payroll expense'] },
  epf_employer_exp:   { types: ['expense'],                    keywords: ['epf employer', 'epf expense', 'epf contribution', 'epf'] },
  etf_employer_exp:   { types: ['expense'],                    keywords: ['etf employer', 'etf expense', 'etf contribution', 'etf'] },
  depreciation_exp:   { types: ['expense'],                    keywords: ['depreciation expense', 'depreciation'] },
  wht_expense:        { types: ['expense'],                    keywords: ['withholding tax expense', 'withholding tax', 'wht expense'] },
  loss_on_disposal:   { types: ['expense', 'other_expense'],   keywords: ['loss on disposal', 'loss on sale'] },
};

const clean = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Score how well an account fits a role. Higher is better; 0 means no match.
 * Keyword position drives the score, so a more specific keyword always wins over
 * a looser one ("trade payables" > "payable").
 */
const scoreAccount = (account, rule) => {
  const name = clean(account.account_name);
  if (!name) return 0;

  const type = normalizeAccountType(account);
  if (rule.types.length && !rule.types.includes(type)) return 0;

  const index = rule.keywords.findIndex((keyword) => name.includes(keyword));
  if (index === -1) return 0;

  // Earlier keyword => more specific => higher score.
  let score = (rule.keywords.length - index) * 10;

  // Prefer a name that *is* the term over one that merely contains it, so
  // "Trade Payables" outranks "Trade Payables - Intercompany".
  const keyword = rule.keywords[index];
  if (name === keyword) score += 5;
  if (name.startsWith(keyword)) score += 2;

  // Never map to a header/parent account — you cannot post to it.
  if (account.is_header) return 0;

  return score;
};

/**
 * Suggest an account code for every role we can confidently match.
 * Returns { [role]: account_code } containing only confident matches.
 */
export const suggestGlMapping = (accounts = []) => {
  const postable = accounts.filter((a) => a && a.account_code && !a.is_header);
  const suggestions = {};

  for (const [role, rule] of Object.entries(ROLE_RULES)) {
    let best = null;
    let bestScore = 0;

    for (const account of postable) {
      const score = scoreAccount(account, rule);
      if (score > bestScore) {
        bestScore = score;
        best = account;
      }
    }

    if (best) suggestions[role] = String(best.account_code);
  }

  return suggestions;
};

/**
 * Roles whose currently-mapped code does not exist in the Chart of Accounts.
 * These post to an account that isn't there — silently, until someone reads the
 * ledger. Surfaced in the UI so they cannot be saved unnoticed.
 */
export const findUnknownMappings = (mapping = {}, accounts = []) => {
  const known = new Set(accounts.map((a) => String(a.account_code)));
  return Object.entries(mapping)
    .filter(([, code]) => code && !known.has(String(code)))
    .map(([role, code]) => ({ role, code: String(code) }));
};

export { ROLE_RULES };
