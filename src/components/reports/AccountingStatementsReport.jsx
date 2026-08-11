import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { dateToFiscalPeriod } from "@/components/utils/fiscalPeriod";
import { exportRowsToCsv } from "@/lib/financialStatements";

const fmt = (value) => `LKR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
// April-March fiscal year: start of the fiscal year that contains today
const fiscalYearStart = () => {
  const { fyStart } = dateToFiscalPeriod(new Date().toISOString().slice(0, 10));
  return `${fyStart}-04-01`;
};

const balanceFor = (account, debit, credit) =>
  account.normal_balance === "credit" ? credit - debit : debit - credit;

export default function AccountingStatementsReport({ initialTab = "trial_balance" }) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [fromDate, setFromDate] = useState(fiscalYearStart());
  const [toDate, setToDate] = useState(today());
  const [asOfDate, setAsOfDate] = useState(today());

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.ChartOfAccounts.filter({ organization_id: orgId }),
    initialData: []
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["journalLines", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.JournalLine.filter({ organization_id: orgId }),
    initialData: []
  });

  const { data: journals = [] } = useQuery({
    queryKey: ["journalEntries", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.JournalEntry.filter({ organization_id: orgId }),
    initialData: []
  });

  // Include both posted AND reversed: a reversed JE's Dr/Cr are permanent accounting
  // movements. Excluding reversed entries leaves the original side of a reversal pair
  // out of all three reports (trial balance, P&L, balance sheet).
  const journalMap = useMemo(() => new Map(
    journals
      .filter((journal) => journal.status === "posted" || journal.status === "reversed")
      .map((journal) => [journal.journal_number, journal])
  ), [journals]);

  const postedLines = useMemo(() => lines
    .map((line) => ({ ...line, journal: journalMap.get(line.journal_number) }))
    .filter((line) => line.journal), [lines, journalMap]);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.account_code, account])), [accounts]);

  const trialRows = useMemo(() => {
    const rows = new Map();
    postedLines
      .filter((line) => line.journal.entry_date <= `${period}-31`)
      .forEach((line) => {
        const account = accountMap.get(line.account_code);
        if (!account) return;
        const row = rows.get(line.account_code) || { account, debit: 0, credit: 0 };
        row.debit += Number(line.debit || 0);
        row.credit += Number(line.credit || 0);
        rows.set(line.account_code, row);
      });
    return [...rows.values()].map((row) => ({ ...row, balance: balanceFor(row.account, row.debit, row.credit) }));
  }, [postedLines, accountMap, period]);

  const plRows = useMemo(() => {
    const rows = new Map();
    postedLines
      .filter((line) => line.journal.entry_date >= fromDate && line.journal.entry_date <= toDate)
      .forEach((line) => {
        const account = accountMap.get(line.account_code);
        if (!account || !["revenue", "expense"].includes(account.account_type)) return;
        const row = rows.get(line.account_code) || { account, debit: 0, credit: 0 };
        row.debit += Number(line.debit || 0);
        row.credit += Number(line.credit || 0);
        rows.set(line.account_code, row);
      });
    return [...rows.values()].map((row) => ({ ...row, balance: balanceFor(row.account, row.debit, row.credit) }));
  }, [postedLines, accountMap, fromDate, toDate]);

  const bsRows = useMemo(() => {
    const rows = new Map();
    accounts.filter((account) => ["asset", "liability", "equity"].includes(account.account_type)).forEach((account) => {
      rows.set(account.account_code, { account, debit: 0, credit: 0 });
    });
    postedLines
      .filter((line) => line.journal.entry_date <= asOfDate)
      .forEach((line) => {
        const account = accountMap.get(line.account_code);
        if (!account || !rows.has(account.account_code)) return;
        const row = rows.get(account.account_code);
        row.debit += Number(line.debit || 0);
        row.credit += Number(line.credit || 0);
      });
    return [...rows.values()].map((row) => ({
      ...row,
      balance: Number(row.account.opening_balance || 0) + balanceFor(row.account, row.debit, row.credit)
    }));
  }, [accounts, postedLines, accountMap, asOfDate]);

  const totalDebit = trialRows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = trialRows.reduce((sum, row) => sum + row.credit, 0);
  const revenue = plRows.filter((row) => row.account.account_type === "revenue").reduce((sum, row) => sum + row.balance, 0);
  const expenses = plRows.filter((row) => row.account.account_type === "expense").reduce((sum, row) => sum + row.balance, 0);
  const netIncome = revenue - expenses;

  // bsAllTimeNetIncome: ALL revenue/expense from inception to asOfDate.
  // Must match bsRows which also sums all-time journal lines - using fiscal-year-only
  // would leave prior-year P&L entries unaccounted, causing a permanent imbalance.
  // bsFiscalNetIncome is the current-year figure shown at the bottom for reference.
  const { bsAllTimeNetIncome, bsFiscalNetIncome } = useMemo(() => {
    const fyStart = `${dateToFiscalPeriod(asOfDate).fyStart}-04-01`;
    let allRev = 0, allExp = 0, fyRev = 0, fyExp = 0;
    postedLines
      .filter((line) => line.journal.entry_date <= asOfDate)
      .forEach((line) => {
        const account = accountMap.get(line.account_code);
        if (!account) return;
        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);
        if (account.account_type === "revenue") {
          allRev += cr - dr;
          if (line.journal.entry_date >= fyStart) fyRev += cr - dr;
        }
        if (account.account_type === "expense") {
          allExp += dr - cr;
          if (line.journal.entry_date >= fyStart) fyExp += dr - cr;
        }
      });
    return { bsAllTimeNetIncome: allRev - allExp, bsFiscalNetIncome: fyRev - fyExp };
  }, [postedLines, accountMap, asOfDate]);

  const assets = bsRows.filter((row) => row.account.account_type === "asset").reduce((sum, row) => sum + row.balance, 0);
  const liabilities = bsRows.filter((row) => row.account.account_type === "liability").reduce((sum, row) => sum + row.balance, 0);
  const equity = bsRows.filter((row) => row.account.account_type === "equity").reduce((sum, row) => sum + row.balance, 0);
  const bsDifference = assets - (liabilities + equity + bsAllTimeNetIncome);

  // Build the export for whichever statement tab is showing. Reuses exportRowsToCsv;
  // written as an .xls (CSV Excel opens natively) with an org/title/period header.
  const num2 = (v) => Number(v || 0).toFixed(2);
  const buildExport = () => {
    if (activeTab === "profit_loss") {
      const cols = [
        { header: "Account Code", value: (r) => r.account.account_code },
        { header: "Account Name", value: (r) => r.account.account_name },
        { header: "Type", value: (r) => r.account.account_type || "" },
        { header: "Amount", value: (r) => num2(r.balance) },
      ];
      const rows = [
        ...plRows,
        { account: { account_code: "", account_name: "Total Revenue" }, balance: revenue },
        { account: { account_code: "", account_name: "Total Expenses" }, balance: expenses },
        { account: { account_code: "", account_name: "Net Income" }, balance: netIncome },
      ];
      return { title: "Profit and Loss", subtitle: `${fromDate} to ${toDate}`, tag: `${fromDate}_${toDate}`, csv: exportRowsToCsv(rows, cols) };
    }
    if (activeTab === "balance_sheet") {
      const cols = [
        { header: "Account Code", value: (r) => r.account.account_code },
        { header: "Account Name", value: (r) => r.account.account_name },
        { header: "Type", value: (r) => r.account.account_type || "" },
        { header: "Balance", value: (r) => num2(r.balance) },
      ];
      const rows = [
        ...bsRows.filter((r) => Math.abs(r.balance) > 0.01),
        { account: { account_code: "", account_name: "Total Assets" }, balance: assets },
        { account: { account_code: "", account_name: "Total Liabilities" }, balance: liabilities },
        { account: { account_code: "", account_name: "Total Equity" }, balance: equity },
        { account: { account_code: "", account_name: "Retained Earnings (net income to date)" }, balance: bsAllTimeNetIncome },
      ];
      return { title: "Balance Sheet", subtitle: `As of ${asOfDate}`, tag: asOfDate, csv: exportRowsToCsv(rows, cols) };
    }
    const cols = [
      { header: "Account Code", value: (r) => r.account.account_code },
      { header: "Account Name", value: (r) => r.account.account_name },
      { header: "Debit", value: (r) => num2(r.debit) },
      { header: "Credit", value: (r) => num2(r.credit) },
      { header: "Net Balance", value: (r) => num2(r.balance) },
    ];
    const rows = [
      ...trialRows,
      { account: { account_code: "", account_name: "TOTAL" }, debit: totalDebit, credit: totalCredit, balance: totalDebit - totalCredit },
    ];
    return { title: "Trial Balance", subtitle: `Period ${period}`, tag: period, csv: exportRowsToCsv(rows, cols) };
  };

  const downloadActive = () => {
    const { title, subtitle, tag, csv } = buildExport();
    const org = currentOrg?.organization_name || currentOrg?.trade_name || "";
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const heading = [org, title, subtitle].filter(Boolean).map(esc).join("\n");
    const content = "﻿" + heading + "\n\n" + csv + "\n"; // BOM so Excel reads UTF-8
    const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-${tag}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ledger Financial Statements</CardTitle>
        <Button variant="outline" size="sm" className="gap-2" onClick={downloadActive}>
          <Download className="w-4 h-4" /> Download Excel
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="profit_loss">Profit & Loss</TabsTrigger>
            <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
          </TabsList>

          <TabsContent value="trial_balance" className="space-y-4">
            <div className="max-w-xs"><Label>Period</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Net Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {trialRows.map((row) => (
                    <TableRow key={row.account.account_code}>
                      <TableCell>{row.account.account_code} - {row.account.account_name}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(row.debit)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(row.credit)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-100 font-bold"><TableCell>Total</TableCell><TableCell className="text-right">{fmt(totalDebit)}</TableCell><TableCell className="text-right">{fmt(totalCredit)}</TableCell><TableCell className="text-right">{fmt(totalDebit - totalCredit)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="profit_loss" className="space-y-4">
            <div className="grid max-w-xl grid-cols-2 gap-3"><div><Label>From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div><div><Label>To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div></div>
            {[
              { type: "revenue", label: "Revenue", totalLabel: "Total Revenue", totalValue: revenue, colorClass: "bg-emerald-50 text-emerald-800" },
              { type: "expense", label: "Expenses", totalLabel: "Total Expenses", totalValue: expenses, colorClass: "bg-red-50 text-red-800" },
            ].map(({ type, label, totalLabel, totalValue, colorClass }) => {
              const rows = plRows.filter((row) => row.account.account_type === type);
              return (
                <div key={type} className="overflow-hidden rounded-md border">
                  <div className="bg-slate-50 px-4 py-2 font-semibold">{label}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right w-20">% of Rev</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-slate-400 py-4">No {label.toLowerCase()} accounts with activity in this period</TableCell></TableRow>
                      )}
                      {rows.map((row) => (
                        <TableRow key={row.account.account_code}>
                          <TableCell>{row.account.account_code} - {row.account.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell>
                          <TableCell className="text-right text-slate-500 text-sm">{revenue ? `${((row.balance / revenue) * 100).toFixed(1)}%` : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className={`flex justify-between px-4 py-2 font-semibold text-sm ${colorClass}`}>
                    <span>{totalLabel}</span>
                    <span className="font-mono">{fmt(totalValue)}</span>
                  </div>
                </div>
              );
            })}
            <div className={`rounded-md p-4 text-xl font-bold ${netIncome >= 0 ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
              {netIncome >= 0 ? "Net Profit" : "Net Loss"}: {fmt(Math.abs(netIncome))}
              <span className="ml-3 text-base font-normal">({revenue ? `${((netIncome / revenue) * 100).toFixed(1)}% of revenue` : "no revenue"})</span>
            </div>
          </TabsContent>

          <TabsContent value="balance_sheet" className="space-y-4">
            <div className="max-w-xs"><Label>As of Date</Label><Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} /></div>
            {Math.abs(bsDifference) > 0.01 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Balance sheet is out of balance by {fmt(Math.abs(bsDifference))} - check for entries posted to wrong account type
                </AlertDescription>
              </Alert>
            )}
            {["asset", "liability", "equity"].map((type) => (
              <div key={type} className="overflow-hidden rounded-md border">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2 font-semibold capitalize"><span>{type}</span><Badge>{fmt(bsRows.filter((row) => row.account.account_type === type).reduce((sum, row) => sum + row.balance, 0))}</Badge></div>
                <Table><TableBody>{bsRows.filter((row) => row.account.account_type === type && Math.abs(row.balance) > 0.01).map((row) => <TableRow key={row.account.account_code}><TableCell>{row.account.account_code} - {row.account.account_name}</TableCell><TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell></TableRow>)}</TableBody></Table>
              </div>
            ))}
            <div className="rounded-md bg-blue-50 p-4 font-bold">
              Current Fiscal Year Net Income: {fmt(bsFiscalNetIncome)}
              {Math.abs(bsAllTimeNetIncome - bsFiscalNetIncome) > 0.01 && (
                <span className="ml-4 text-sm font-normal text-slate-600">
                  (All-time retained: {fmt(bsAllTimeNetIncome - bsFiscalNetIncome)})
                </span>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
