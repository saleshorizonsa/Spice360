import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/components/utils/usePermissions";
import {
  buildBalanceSheet,
  buildManagementSummary,
  buildPeriodComparison,
  buildProfitAndLoss,
  buildTrialBalance,
  exportRowsToCsv,
  statementCategoryLabels
} from "@/lib/financialStatements";

const currency = (value) =>
  `SAR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

const currentYearStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const previousPeriod = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10)
  };
};

const downloadText = (filename, content, type = "text/csv;charset=utf-8") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const printReport = ({ title, subtitle, rows }) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const bodyRows = rows.map((row) => `
    <tr>
      <td>${row.label}</td>
      <td style="text-align:right">${currency(row.amount)}</td>
    </tr>
  `).join("");
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111827; }
          h1 { margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { border: 1px solid #d1d5db; padding: 10px; }
          th { background: #f3f4f6; text-align: left; }
          .footer { margin-top: 28px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <table>
          <thead><tr><th>Line</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="footer">Generated on ${new Date().toLocaleString()}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

const queryOptions = { initialData: [] };

function StatementSection({ title, rows, totalLabel, total, onDrillDown, invert = false }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">{title}</div>
      <Table>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-sm text-slate-500">No ledger activity</TableCell>
              <TableCell />
            </TableRow>
          ) : rows.map((row) => (
            <TableRow key={row.account_code} className="cursor-pointer hover:bg-slate-50" onClick={() => onDrillDown(row)}>
              <TableCell>
                <div className="font-medium">{row.account_name}</div>
                <div className="text-xs text-slate-500">{row.account_code}</div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {currency(invert ? -row.balance : row.balance)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-slate-100 font-bold">
            <TableCell>{totalLabel}</TableCell>
            <TableCell className="text-right font-mono">{currency(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-900",
    green: "bg-emerald-50 text-emerald-900",
    blue: "bg-blue-50 text-blue-900",
    amber: "bg-amber-50 text-amber-900",
    red: "bg-red-50 text-red-900"
  }[tone];

  return (
    <div className={`rounded-md p-4 ${toneClass}`}>
      <div className="text-sm opacity-75">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function DrillDownDialog({ row, onClose }) {
  const transactions = row?.transactions || [];
  let running = 0;

  return (
    <Dialog open={!!row} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row?.account_code} - {row?.account_name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">No ledger transactions for this line.</TableCell>
                </TableRow>
              ) : transactions.map((line) => {
                running += Number(line.debit || 0) - Number(line.credit || 0);
                return (
                  <TableRow key={line.line_id}>
                    <TableCell>{line.transaction_date}</TableCell>
                    <TableCell>{line.reference_number}</TableCell>
                    <TableCell>{line.source_document}</TableCell>
                    <TableCell>{line.description || "-"}</TableCell>
                    <TableCell className="text-right font-mono">{line.debit ? currency(line.debit) : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{line.credit ? currency(line.credit) : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{currency(running)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FinancialStatementsReport({ initialTab = "profit_loss" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [startDate, setStartDate] = useState(currentYearStart());
  const [endDate, setEndDate] = useState(today());
  const [asOfDate, setAsOfDate] = useState(today());
  const [branch, setBranch] = useState("ALL");
  const [costCenter, setCostCenter] = useState("ALL");
  const [project, setProject] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const [comparisonMode, setComparisonMode] = useState("monthly");
  const [selectedLine, setSelectedLine] = useState(null);
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();

  const { data: accounts = [], isLoading: loadingAccounts, error: accountsError } = useQuery({
    queryKey: ["chartOfAccounts"],
    queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
    ...queryOptions
  });
  const { data: journalEntries = [], isLoading: loadingJournals, error: journalsError } = useQuery({
    queryKey: ["journalEntries"],
    queryFn: () => matrixSales.entities.JournalEntry.list("-posting_date"),
    ...queryOptions
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => matrixSales.entities.Budget.list("-fiscal_period"),
    ...queryOptions
  });
  const { data: arRecords = [] } = useQuery({
    queryKey: ["ar"],
    queryFn: () => matrixSales.entities.AccountsReceivable.list("-invoice_date"),
    ...queryOptions
  });
  const { data: apRecords = [] } = useQuery({
    queryKey: ["ap"],
    queryFn: () => matrixSales.entities.AccountsPayable.list("-invoice_date"),
    ...queryOptions
  });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: () => matrixSales.entities.BankAccount.list(),
    ...queryOptions
  });

  const filters = { branch, costCenter, project, currency: currencyFilter };
  const previous = previousPeriod(startDate, endDate);

  const profitAndLoss = useMemo(() => buildProfitAndLoss({
    accounts,
    journalEntries,
    startDate,
    endDate,
    comparisonStartDate: previous.startDate,
    comparisonEndDate: previous.endDate,
    budgets,
    filters
  }), [accounts, journalEntries, startDate, endDate, budgets, branch, costCenter, project, currencyFilter]);

  const balanceSheet = useMemo(() => buildBalanceSheet({
    accounts,
    journalEntries,
    asOfDate,
    filters
  }), [accounts, journalEntries, asOfDate, branch, costCenter, project, currencyFilter]);

  const trialBalance = useMemo(() => buildTrialBalance({
    accounts,
    journalEntries,
    asOfDate,
    filters
  }), [accounts, journalEntries, asOfDate, branch, costCenter, project, currencyFilter]);

  const managementSummary = useMemo(() => buildManagementSummary({
    profitAndLoss,
    balanceSheet,
    arRecords,
    apRecords,
    bankAccounts
  }), [profitAndLoss, balanceSheet, arRecords, apRecords, bankAccounts]);

  const periodComparison = useMemo(() => buildPeriodComparison({
    accounts,
    journalEntries,
    startDate,
    endDate,
    mode: comparisonMode,
    filters
  }), [accounts, journalEntries, startDate, endDate, comparisonMode, branch, costCenter, project, currencyFilter]);

  const loading = loadingAccounts || loadingJournals;
  const error = accountsError || journalsError;
  const warnings = [...profitAndLoss.warnings, ...balanceSheet.warnings]
    .filter((warning, index, all) => all.findIndex((item) => item.message === warning.message) === index);

  const branchOptions = useMemo(() => ["ALL", ...new Set(trialBalance.lines.map((line) => line.branch_code).filter(Boolean))], [trialBalance.lines]);
  const costCenterOptions = useMemo(() => ["ALL", ...new Set(trialBalance.lines.map((line) => line.cost_center).filter(Boolean))], [trialBalance.lines]);
  const projectOptions = useMemo(() => ["ALL", ...new Set(trialBalance.lines.map((line) => line.project_code).filter(Boolean))], [trialBalance.lines]);
  const currencyOptions = useMemo(() => ["ALL", ...new Set(trialBalance.lines.map((line) => line.currency).filter(Boolean))], [trialBalance.lines]);

  const exportStatement = (format) => {
    if (!canExport) return;
    const isBalanceSheet = activeTab === "balance_sheet";
    const rows = isBalanceSheet
      ? [
        ...balanceSheet.rows.map((row) => ({ label: `${row.account_code} ${row.account_name}`, amount: row.balance })),
        { label: "Total Assets", amount: balanceSheet.totals.totalAssets },
        { label: "Total Liabilities and Equity", amount: balanceSheet.totals.totalLiabilitiesAndEquity }
      ]
      : [
        ...profitAndLoss.rows.map((row) => ({ label: `${row.account_code} ${row.account_name}`, amount: row.balance })),
        { label: "Gross Profit", amount: profitAndLoss.totals.grossProfit },
        { label: "Net Profit / Loss", amount: profitAndLoss.totals.netProfit }
      ];
    const title = isBalanceSheet ? "Balance Sheet" : "Profit and Loss Statement";
    const subtitle = isBalanceSheet ? `As of ${asOfDate}` : `${startDate} to ${endDate}`;

    if (format === "pdf") {
      printReport({ title, subtitle, rows });
      return;
    }

    const csv = exportRowsToCsv(rows, [
      { header: "Line", value: "label" },
      { header: "Amount", value: "amount" }
    ]);
    downloadText(`${title.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.${format === "excel" ? "xls" : "csv"}`, csv);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">Loading financial statements...</CardContent>
      </Card>
    );
  }

  const canView = isAdmin || hasPermission("finance.financial_statements", "view");
  const canExport = isAdmin || hasPermission("finance.financial_statements", "export");
  const canDrillDown = isAdmin || hasPermission("finance.financial_statements", "drill_down");

  if (permissionsLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">Checking financial statement permissions...</CardContent>
      </Card>
    );
  }

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>You do not have permission to view financial statements.</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error.message || "Unable to load financial statement data."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Financial Statements</CardTitle>
              <p className="mt-1 text-sm text-slate-600">Ledger-based reports for management, audit, zakat, and close review.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportStatement("pdf")} disabled={!canExport}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportStatement("excel")} disabled={!canExport}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportStatement("csv")} disabled={!canExport}>
                <FileText className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div>
              <Label>As-of Date</Label>
              <Input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </div>
            <div>
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{branchOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cost Center</Label>
              <Select value={costCenter} onValueChange={setCostCenter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{costCenterOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{currencyOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <Label>Project</Label>
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{projectOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comparison</Label>
              <Select value={comparisonMode} onValueChange={setComparisonMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold">Review required before relying on these statements.</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {warnings.slice(0, 5).map((warning) => <li key={warning.message}>{warning.message}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Revenue" value={currency(profitAndLoss.totals.revenue)} tone="green" />
        <SummaryCard label="Gross Margin" value={percent(managementSummary.grossMarginPercent)} tone="blue" />
        <SummaryCard label="Net Profit / Loss" value={currency(profitAndLoss.totals.netProfit)} tone={profitAndLoss.totals.netProfit >= 0 ? "green" : "red"} />
        <SummaryCard label="Cash Position" value={currency(managementSummary.cashPosition)} tone="slate" />
        <SummaryCard label="Revenue Growth" value={percent(managementSummary.revenueGrowthPercent)} tone="blue" />
        <SummaryCard label="Expense Ratio" value={percent(managementSummary.expenseRatioPercent)} tone="amber" />
        <SummaryCard label="Receivables" value={currency(managementSummary.receivables)} tone="slate" />
        <SummaryCard label="Payables" value={currency(managementSummary.payables)} tone="slate" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profit_loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="general_ledger">General Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="profit_loss" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatementSection title={statementCategoryLabels.revenue} rows={profitAndLoss.sections.revenue} totalLabel="Total Revenue" total={profitAndLoss.totals.revenue} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <StatementSection title={statementCategoryLabels.cost_of_sales} rows={profitAndLoss.sections.costOfSales} totalLabel="Total Cost of Sales" total={profitAndLoss.totals.costOfSales} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <StatementSection title={statementCategoryLabels.operating_expense} rows={profitAndLoss.sections.operatingExpenses} totalLabel="Total Operating Expenses" total={profitAndLoss.totals.operatingExpenses} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <div className="space-y-4">
              <StatementSection title={statementCategoryLabels.other_income} rows={profitAndLoss.sections.otherIncome} totalLabel="Total Other Income" total={profitAndLoss.totals.otherIncome} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
              <StatementSection title={statementCategoryLabels.other_expense} rows={profitAndLoss.sections.otherExpenses} totalLabel="Total Other Expenses" total={profitAndLoss.totals.otherExpenses} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            </div>
          </div>
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <SummaryCard label="Gross Profit" value={currency(profitAndLoss.totals.grossProfit)} tone="blue" />
              <SummaryCard label="Net Profit / Loss" value={currency(profitAndLoss.totals.netProfit)} tone={profitAndLoss.totals.netProfit >= 0 ? "green" : "red"} />
              <SummaryCard label="Budget Variance" value={profitAndLoss.totals.budget ? currency(profitAndLoss.totals.budgetVariance) : "No budget"} tone="amber" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base capitalize">{comparisonMode} Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Gross Profit</TableHead>
                      <TableHead className="text-right">Net Profit / Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodComparison.map((period) => (
                      <TableRow key={`${period.startDate}-${period.endDate}`}>
                        <TableCell>{period.label}</TableCell>
                        <TableCell className="text-right font-mono">{currency(period.revenue)}</TableCell>
                        <TableCell className="text-right font-mono">{currency(period.grossProfit)}</TableCell>
                        <TableCell className="text-right font-mono">{currency(period.netProfit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance_sheet" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatementSection title={statementCategoryLabels.current_asset} rows={balanceSheet.sections.currentAssets} totalLabel="Total Current Assets" total={balanceSheet.totals.currentAssets} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <StatementSection title={statementCategoryLabels.non_current_asset} rows={balanceSheet.sections.nonCurrentAssets} totalLabel="Total Non-current Assets" total={balanceSheet.totals.nonCurrentAssets} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <StatementSection title={statementCategoryLabels.current_liability} rows={balanceSheet.sections.currentLiabilities} totalLabel="Total Current Liabilities" total={balanceSheet.totals.currentLiabilities} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <StatementSection title={statementCategoryLabels.non_current_liability} rows={balanceSheet.sections.nonCurrentLiabilities} totalLabel="Total Non-current Liabilities" total={balanceSheet.totals.nonCurrentLiabilities} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
            <StatementSection title={statementCategoryLabels.equity} rows={balanceSheet.sections.equity} totalLabel="Total Equity" total={balanceSheet.totals.equity} onDrillDown={canDrillDown ? setSelectedLine : () => {}} />
          </div>
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <SummaryCard label="Total Assets" value={currency(balanceSheet.totals.totalAssets)} tone="blue" />
              <SummaryCard label="Liabilities + Equity" value={currency(balanceSheet.totals.totalLiabilitiesAndEquity)} tone="slate" />
              <SummaryCard label="Balance Difference" value={currency(balanceSheet.totals.balanceDifference)} tone={Math.abs(balanceSheet.totals.balanceDifference) < 0.01 ? "green" : "red"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial_balance">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.rows.map((row) => (
                      <TableRow key={row.account_code} className={canDrillDown ? "cursor-pointer hover:bg-slate-50" : ""} onClick={() => canDrillDown && setSelectedLine(row)}>
                        <TableCell>
                          <div className="font-medium">{row.account_code} - {row.account_name}</div>
                          <div className="text-xs text-slate-500">{statementCategoryLabels[row.statement_category] || row.statement_category}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{row.account_type}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{currency(row.debit)}</TableCell>
                        <TableCell className="text-right font-mono">{currency(row.credit)}</TableCell>
                        <TableCell className="text-right font-mono">{currency(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-100 font-bold">
                      <TableCell colSpan={2}>Totals</TableCell>
                      <TableCell className="text-right font-mono">{currency(trialBalance.totalDebit)}</TableCell>
                      <TableCell className="text-right font-mono">{currency(trialBalance.totalCredit)}</TableCell>
                      <TableCell className="text-right font-mono">{currency(trialBalance.difference)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general_ledger">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                General Ledger Detail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[640px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cost Center</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.lines.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">No posted ledger entries found.</TableCell></TableRow>
                    ) : trialBalance.lines.map((line) => (
                      <TableRow key={line.line_id}>
                        <TableCell>{line.transaction_date}</TableCell>
                        <TableCell>{line.reference_number}</TableCell>
                        <TableCell>{line.account_code} - {line.account_name}</TableCell>
                        <TableCell>{line.description || "-"}</TableCell>
                        <TableCell>{line.cost_center || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{line.debit ? currency(line.debit) : "-"}</TableCell>
                        <TableCell className="text-right font-mono">{line.credit ? currency(line.credit) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DrillDownDialog row={selectedLine} onClose={() => setSelectedLine(null)} />
    </div>
  );
}
