const amount = (value) => Number(value || 0);

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const debitNormalTypes = new Set(['asset', 'expense', 'cost_of_sales', 'cost of sales', 'other_expense', 'other expense']);
const creditNormalTypes = new Set(['liability', 'equity', 'revenue', 'income', 'other_income', 'other income']);

export const statementCategoryLabels = {
  revenue: 'Revenue',
  cost_of_sales: 'Cost of Sales / Services',
  operating_expense: 'Operating Expenses',
  other_income: 'Other Income',
  other_expense: 'Other Expenses',
  current_asset: 'Current Assets',
  non_current_asset: 'Non-current Assets',
  current_liability: 'Current Liabilities',
  non_current_liability: 'Non-current Liabilities',
  equity: 'Equity',
  retained_earnings: 'Retained Earnings'
};

export const normalizeAccountType = (account = {}) => {
  const raw = normalizeText(account.account_type || account.type || account.financial_statement_category);
  const subtype = normalizeText(account.account_subtype || account.subtype || account.financial_statement_category);

  if (raw.includes('liabil')) return 'liability';
  if (raw.includes('equity') || raw.includes('capital')) return 'equity';
  if (raw.includes('revenue') || raw === 'income' || raw.includes('sales')) return 'revenue';
  if (raw.includes('cost') || subtype.includes('cost_of_goods') || subtype.includes('cost of goods')) return 'cost_of_sales';
  if (raw.includes('other income') || subtype.includes('other_revenue') || subtype.includes('other income')) return 'other_income';
  if (raw.includes('other expense') || subtype.includes('other_expense') || subtype.includes('other expense')) return 'other_expense';
  if (raw.includes('expense')) return 'expense';
  return 'asset';
};

export const inferStatementCategory = (account = {}) => {
  const explicit = normalizeText(account.financial_statement_category || account.statement_category || account.report_category);
  if (explicit) return explicit.replace(/\s+/g, '_');

  const accountType = normalizeAccountType(account);
  const subtype = normalizeText(account.account_subtype || account.subtype || account.account_group);
  const name = normalizeText(account.account_name);

  if (accountType === 'revenue') return subtype.includes('other') ? 'other_income' : 'revenue';
  if (accountType === 'cost_of_sales') return 'cost_of_sales';
  if (accountType === 'expense') return subtype.includes('other') ? 'other_expense' : 'operating_expense';
  if (accountType === 'other_income') return 'other_income';
  if (accountType === 'other_expense') return 'other_expense';
  if (accountType === 'liability') return subtype.includes('long') || subtype.includes('non') ? 'non_current_liability' : 'current_liability';
  if (accountType === 'equity') {
    if (name.includes('retained')) return 'retained_earnings';
    return 'equity';
  }
  if (subtype.includes('fixed') || subtype.includes('non') || subtype.includes('long')) return 'non_current_asset';
  return 'current_asset';
};

export const normalBalanceForAccount = (account = {}) => {
  const explicit = normalizeText(account.normal_balance);
  if (explicit === 'debit' || explicit === 'credit') return explicit;
  const type = normalizeAccountType(account);
  return debitNormalTypes.has(type) ? 'debit' : 'credit';
};

const isPostedLedgerEntry = (entry = {}) => {
  const status = normalizeText(entry.status || entry.posting_status);
  return !status || ['posted', 'approved', 'cleared', 'paid', 'open'].includes(status);
};

const entryDate = (entry = {}) =>
  entry.posting_date ||
  entry.je_date ||
  entry.entry_date ||
  entry.transaction_date ||
  entry.document_date ||
  entry.created_at ||
  '';

const documentNumber = (entry = {}) =>
  entry.journal_number ||
  entry.je_number ||
  entry.document_number ||
  entry.reference_number ||
  entry.reference ||
  entry.id ||
  '';

export const normalizeLedgerEntries = (journalEntries = []) => {
  const lines = [];

  journalEntries.forEach((entry) => {
    if (!isPostedLedgerEntry(entry)) return;
    const date = entryDate(entry);
    const common = {
      id: entry.id,
      journal_id: entry.journal_id || entry.id,
      transaction_date: date,
      reference_number: documentNumber(entry),
      source_document: entry.source_document || entry.source_document_type || entry.je_type || 'Journal Entry',
      description: entry.description || entry.notes || '',
      cost_center: entry.cost_center || entry.cost_center_code || '',
      project_code: entry.project_code || entry.project_id || '',
      branch_code: entry.branch_code || entry.plant_code || '',
      currency: entry.currency || 'SAR',
      tenant_id: entry.tenant_id || entry.organization_id
    };

    if (Array.isArray(entry.lines)) {
      entry.lines.forEach((line, index) => {
        lines.push({
          ...common,
          line_id: line.id || `${entry.id || documentNumber(entry)}-${index}`,
          account_code: line.account_code,
          account_name: line.account_name,
          debit: amount(line.debit_amount ?? line.debit),
          credit: amount(line.credit_amount ?? line.credit)
        });
      });
      return;
    }

    if (entry.account_code || entry.debit_amount || entry.credit_amount) {
      lines.push({
        ...common,
        line_id: entry.id || documentNumber(entry),
        account_code: entry.account_code,
        account_name: entry.account_name,
        debit: amount(entry.debit_amount ?? entry.debit),
        credit: amount(entry.credit_amount ?? entry.credit)
      });
      return;
    }

    if (entry.debit_account_code || entry.credit_account_code) {
      if (entry.debit_account_code) {
        lines.push({
          ...common,
          line_id: `${entry.id || documentNumber(entry)}-debit`,
          account_code: entry.debit_account_code,
          account_name: entry.debit_account_name,
          debit: amount(entry.amount),
          credit: 0
        });
      }
      if (entry.credit_account_code) {
        lines.push({
          ...common,
          line_id: `${entry.id || documentNumber(entry)}-credit`,
          account_code: entry.credit_account_code,
          account_name: entry.credit_account_name,
          debit: 0,
          credit: amount(entry.amount)
        });
      }
    }
  });

  return lines.filter((line) => line.account_code && (line.debit || line.credit));
};

const accountMapFrom = (accounts = []) =>
  new Map(accounts.map((account) => [String(account.account_code || ''), account]));

const matchesAccountFilters = (account = {}, filters = {}) => {
  if (filters.currency && filters.currency !== 'ALL' && account.currency && account.currency !== filters.currency) return false;
  if (filters.tenantId && filters.tenantId !== 'ALL') {
    const accountTenantId = account.tenant_id || account.organization_id;
    if (accountTenantId && accountTenantId !== filters.tenantId) return false;
  }
  return true;
};

const inDateRange = (date, startDate, endDate) => {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

const matchesFilters = (line, filters = {}) => {
  if (filters.branch && filters.branch !== 'ALL' && line.branch_code !== filters.branch) return false;
  if (filters.costCenter && filters.costCenter !== 'ALL' && line.cost_center !== filters.costCenter) return false;
  if (filters.project && filters.project !== 'ALL' && line.project_code !== filters.project) return false;
  if (filters.currency && filters.currency !== 'ALL' && line.currency !== filters.currency) return false;
  if (filters.tenantId && filters.tenantId !== 'ALL' && line.tenant_id !== filters.tenantId) return false;
  return true;
};

const signedBalance = (account, debit, credit) => {
  const normal = normalBalanceForAccount(account);
  return normal === 'debit' ? debit - credit : credit - debit;
};

const accountName = (account, fallbackCode) => account?.account_name || account?.name || fallbackCode;

export const buildTrialBalance = ({ accounts = [], journalEntries = [], asOfDate, filters = {} }) => {
  const scopedAccounts = accounts.filter((account) => matchesAccountFilters(account, filters));
  const accountMap = accountMapFrom(scopedAccounts);
  const lines = normalizeLedgerEntries(journalEntries).filter((line) =>
    (!asOfDate || line.transaction_date <= asOfDate) && matchesFilters(line, filters)
  );
  const rowsByCode = new Map();
  const warnings = [];

  scopedAccounts.forEach((account) => {
    const code = account.account_code;
    if (!code || account.status === 'inactive') return;
    const opening = amount(account.opening_balance);
    rowsByCode.set(code, {
      account_code: code,
      account_name: accountName(account, code),
      account_type: normalizeAccountType(account),
      statement_category: inferStatementCategory(account),
      normal_balance: normalBalanceForAccount(account),
      opening_balance: opening,
      debit: 0,
      credit: 0,
      balance: opening,
      transactions: []
    });
  });

  lines.forEach((line) => {
    const account = accountMap.get(String(line.account_code));
    if (!account || !matchesAccountFilters(account, filters)) {
      warnings.push({
        type: 'missing_account_mapping',
        message: `Ledger line ${line.reference_number || line.line_id} uses unmapped account ${line.account_code}.`
      });
      return;
    }

    const code = account.account_code;
    if (!rowsByCode.has(code)) {
      rowsByCode.set(code, {
        account_code: code,
        account_name: accountName(account, code),
        account_type: normalizeAccountType(account),
        statement_category: inferStatementCategory(account),
        normal_balance: normalBalanceForAccount(account),
        opening_balance: amount(account.opening_balance),
        debit: 0,
        credit: 0,
        balance: amount(account.opening_balance),
        transactions: []
      });
    }

    const row = rowsByCode.get(code);
    row.debit += line.debit;
    row.credit += line.credit;
    row.transactions.push(line);
  });

  rowsByCode.forEach((row) => {
    row.balance = row.opening_balance + signedBalance(row, row.debit, row.credit);
    if (!row.statement_category) {
      warnings.push({
        type: 'uncategorized_account',
        message: `Account ${row.account_code} has no financial statement category.`
      });
    }
  });

  const rows = [...rowsByCode.values()].sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const difference = totalDebit - totalCredit;

  if (Math.abs(difference) > 0.01) {
    warnings.push({
      type: 'ledger_unbalanced',
      message: `Ledger debits and credits differ by ${Math.abs(difference).toFixed(2)}.`
    });
  }

  return { rows, totalDebit, totalCredit, difference, warnings, lines };
};

const sumRows = (rows) => rows.reduce((sum, row) => sum + row.balance, 0);

const rowsForCategories = (trialRows, categories) =>
  trialRows.filter((row) => categories.includes(row.statement_category) && Math.abs(row.balance) > 0.01);

export const buildProfitAndLoss = ({ accounts = [], journalEntries = [], startDate, endDate, comparisonStartDate, comparisonEndDate, budgets = [], filters = {} }) => {
  const currentTrial = buildTrialBalance({ accounts, journalEntries, asOfDate: endDate, filters });
  const openingTrial = startDate
    ? buildTrialBalance({ accounts, journalEntries, asOfDate: startDate < '0001-01-02' ? startDate : previousDate(startDate), filters })
    : { rows: [] };

  const openingByCode = new Map(openingTrial.rows.map((row) => [row.account_code, row.balance]));
  const plRows = currentTrial.rows
    .filter((row) => ['revenue', 'cost_of_sales', 'operating_expense', 'other_income', 'other_expense'].includes(row.statement_category))
    .map((row) => ({
      ...row,
      balance: row.balance - amount(openingByCode.get(row.account_code)),
      transactions: row.transactions.filter((line) => inDateRange(line.transaction_date, startDate, endDate))
    }))
    .filter((row) => Math.abs(row.balance) > 0.01 || row.transactions.length);

  const budgetByCode = new Map((budgets || []).map((budget) => [budget.account_code, amount(budget.amount || budget.budget_amount)]));
  const sections = {
    revenue: rowsForCategories(plRows, ['revenue']),
    costOfSales: rowsForCategories(plRows, ['cost_of_sales']),
    operatingExpenses: rowsForCategories(plRows, ['operating_expense']),
    otherIncome: rowsForCategories(plRows, ['other_income']),
    otherExpenses: rowsForCategories(plRows, ['other_expense'])
  };

  const totals = {
    revenue: sumRows(sections.revenue),
    costOfSales: sumRows(sections.costOfSales),
    grossProfit: sumRows(sections.revenue) - sumRows(sections.costOfSales),
    operatingExpenses: sumRows(sections.operatingExpenses),
    otherIncome: sumRows(sections.otherIncome),
    otherExpenses: sumRows(sections.otherExpenses)
  };
  totals.netProfit = totals.grossProfit - totals.operatingExpenses + totals.otherIncome - totals.otherExpenses;
  totals.grossMarginPercent = totals.revenue ? (totals.grossProfit / totals.revenue) * 100 : 0;
  totals.netMarginPercent = totals.revenue ? (totals.netProfit / totals.revenue) * 100 : 0;
  totals.budget = [...budgetByCode.values()].reduce((sum, value) => sum + value, 0);
  totals.budgetVariance = totals.budget ? totals.netProfit - totals.budget : 0;

  const comparison = comparisonStartDate && comparisonEndDate
    ? buildProfitAndLoss({ accounts, journalEntries, startDate: comparisonStartDate, endDate: comparisonEndDate, budgets: [], filters })
    : null;

  return {
    sections,
    totals,
    comparison: comparison ? comparison.totals : null,
    warnings: currentTrial.warnings,
    transactions: plRows.flatMap((row) => row.transactions),
    rows: plRows
  };
};

export const buildBalanceSheet = ({ accounts = [], journalEntries = [], asOfDate, previousAsOfDate, filters = {} }) => {
  const trial = buildTrialBalance({ accounts, journalEntries, asOfDate, filters });
  const pl = buildProfitAndLoss({
    accounts,
    journalEntries,
    startDate: `${String(asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 4)}-01-01`,
    endDate: asOfDate,
    filters
  });

  const sections = {
    currentAssets: rowsForCategories(trial.rows, ['current_asset']),
    nonCurrentAssets: rowsForCategories(trial.rows, ['non_current_asset']),
    currentLiabilities: rowsForCategories(trial.rows, ['current_liability']),
    nonCurrentLiabilities: rowsForCategories(trial.rows, ['non_current_liability']),
    equity: rowsForCategories(trial.rows, ['equity', 'retained_earnings'])
  };

  const currentYearProfitRow = {
    account_code: 'CY-PROFIT',
    account_name: 'Current Year Profit / Loss',
    statement_category: 'equity',
    balance: pl.totals.netProfit,
    transactions: pl.transactions
  };

  if (Math.abs(currentYearProfitRow.balance) > 0.01) {
    sections.equity.push(currentYearProfitRow);
  }

  const totals = {
    currentAssets: sumRows(sections.currentAssets),
    nonCurrentAssets: sumRows(sections.nonCurrentAssets),
    totalAssets: 0,
    currentLiabilities: sumRows(sections.currentLiabilities),
    nonCurrentLiabilities: sumRows(sections.nonCurrentLiabilities),
    totalLiabilities: 0,
    equity: sumRows(sections.equity),
    currentYearProfit: pl.totals.netProfit
  };
  totals.totalAssets = totals.currentAssets + totals.nonCurrentAssets;
  totals.totalLiabilities = totals.currentLiabilities + totals.nonCurrentLiabilities;
  totals.totalLiabilitiesAndEquity = totals.totalLiabilities + totals.equity;
  totals.balanceDifference = totals.totalAssets - totals.totalLiabilitiesAndEquity;

  const warnings = [...trial.warnings];
  if (Math.abs(totals.balanceDifference) > 0.01) {
    warnings.push({
      type: 'balance_sheet_unbalanced',
      message: `Balance Sheet is out by ${Math.abs(totals.balanceDifference).toFixed(2)}.`
    });
  }

  const comparison = previousAsOfDate
    ? buildBalanceSheet({ accounts, journalEntries, asOfDate: previousAsOfDate, filters })
    : null;

  return {
    sections,
    totals,
    comparison: comparison ? comparison.totals : null,
    warnings,
    rows: [
      ...sections.currentAssets,
      ...sections.nonCurrentAssets,
      ...sections.currentLiabilities,
      ...sections.nonCurrentLiabilities,
      ...sections.equity
    ]
  };
};

const previousDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const buildManagementSummary = ({ profitAndLoss, balanceSheet, arRecords = [], apRecords = [], bankAccounts = [] }) => {
  const revenue = profitAndLoss?.totals?.revenue || 0;
  const previousRevenue = profitAndLoss?.comparison?.revenue || 0;
  const totalExpenses = (profitAndLoss?.totals?.operatingExpenses || 0) + (profitAndLoss?.totals?.otherExpenses || 0);
  const cashPosition = bankAccounts.reduce((sum, bank) => sum + amount(bank.current_balance || bank.opening_balance), 0);
  const receivables = arRecords.reduce((sum, item) => sum + amount(item.outstanding_amount), 0);
  const payables = apRecords.reduce((sum, item) => sum + amount(item.outstanding_amount), 0);

  return {
    grossMarginPercent: profitAndLoss?.totals?.grossMarginPercent || 0,
    netMarginPercent: profitAndLoss?.totals?.netMarginPercent || 0,
    revenueGrowthPercent: previousRevenue ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0,
    expenseRatioPercent: revenue ? (totalExpenses / revenue) * 100 : 0,
    cashPosition,
    receivables,
    payables,
    balanceDifference: balanceSheet?.totals?.balanceDifference || 0
  };
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const periodEndFor = (start, months, hardEnd) => {
  const end = addMonths(start, months);
  end.setUTCDate(end.getUTCDate() - 1);
  return end > hardEnd ? hardEnd : end;
};

export const buildPeriodComparison = ({ accounts = [], journalEntries = [], startDate, endDate, mode = 'monthly', filters = {} }) => {
  const monthsByMode = { monthly: 1, quarterly: 3, yearly: 12 };
  const stepMonths = monthsByMode[mode] || 1;
  const hardEnd = new Date(`${endDate}T00:00:00Z`);
  const periods = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);

  while (cursor <= hardEnd) {
    const periodStart = cursor.toISOString().slice(0, 10);
    const end = periodEndFor(cursor, stepMonths, hardEnd);
    const periodEnd = end.toISOString().slice(0, 10);
    const report = buildProfitAndLoss({ accounts, journalEntries, startDate: periodStart, endDate: periodEnd, filters });
    periods.push({
      label: mode === 'yearly' ? periodStart.slice(0, 4) : `${periodStart} to ${periodEnd}`,
      startDate: periodStart,
      endDate: periodEnd,
      revenue: report.totals.revenue,
      grossProfit: report.totals.grossProfit,
      netProfit: report.totals.netProfit
    });
    cursor = addMonths(cursor, stepMonths);
  }

  return periods;
};

export const exportRowsToCsv = (rows = [], columns = []) => {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    columns.map((column) => escape(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escape(typeof column.value === 'function' ? column.value(row) : row[column.value])).join(','))
  ].join('\n');
};
