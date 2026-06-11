import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/components/utils/OrganizationContext";

const fmt = (value) => `LKR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

const balanceFor = (account, debit, credit) =>
  account.normal_balance === "credit" ? credit - debit : debit - credit;

export default function AccountingStatementsReport({ initialTab = "trial_balance" }) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [fromDate, setFromDate] = useState(yearStart());
  const [toDate, setToDate] = useState(today());
  const [asOfDate, setAsOfDate] = useState(today());

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.Account.filter({ organization_id: orgId }),
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

  const journalMap = useMemo(() => new Map(journals.filter((journal) => journal.status === "posted").map((journal) => [journal.journal_number, journal])), [journals]);

  const postedLines = useMemo(() => lines
    .map((line) => ({ ...line, journal: journalMap.get(line.journal_number) }))
    .filter((line) => line.journal), [lines, journalMap]);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.account_code, account])), [accounts]);

  const trialRows = useMemo(() => {
    const rows = new Map();
    postedLines
      .filter((line) => line.journal.entry_date?.startsWith(period))
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
  const assets = bsRows.filter((row) => row.account.account_type === "asset").reduce((sum, row) => sum + row.balance, 0);
  const liabilities = bsRows.filter((row) => row.account.account_type === "liability").reduce((sum, row) => sum + row.balance, 0);
  const equity = bsRows.filter((row) => row.account.account_type === "equity").reduce((sum, row) => sum + row.balance, 0);
  const bsDifference = assets - (liabilities + equity + netIncome);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger Financial Statements</CardTitle>
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
            {["revenue", "expense"].map((type) => (
              <div key={type} className="overflow-hidden rounded-md border">
                <div className="bg-slate-50 px-4 py-2 font-semibold capitalize">{type}</div>
                <Table><TableBody>{plRows.filter((row) => row.account.account_type === type).map((row) => <TableRow key={row.account.account_code}><TableCell>{row.account.account_code} - {row.account.account_name}</TableCell><TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell><TableCell className="text-right">{revenue ? `${((row.balance / revenue) * 100).toFixed(1)}%` : "0.0%"}</TableCell></TableRow>)}</TableBody></Table>
              </div>
            ))}
            <div className="rounded-md bg-emerald-50 p-4 text-xl font-bold text-emerald-900">Net Income: {fmt(netIncome)} ({revenue ? ((netIncome / revenue) * 100).toFixed(1) : "0.0"}% of revenue)</div>
          </TabsContent>

          <TabsContent value="balance_sheet" className="space-y-4">
            <div className="max-w-xs"><Label>As of Date</Label><Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} /></div>
            {Math.abs(bsDifference) > 0.01 && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>Balance sheet is out of balance by {fmt(Math.abs(bsDifference))} — check for entries posted to wrong account type</AlertDescription></Alert>}
            {["asset", "liability", "equity"].map((type) => (
              <div key={type} className="overflow-hidden rounded-md border">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2 font-semibold capitalize"><span>{type}</span><Badge>{fmt(bsRows.filter((row) => row.account.account_type === type).reduce((sum, row) => sum + row.balance, 0))}</Badge></div>
                <Table><TableBody>{bsRows.filter((row) => row.account.account_type === type && Math.abs(row.balance) > 0.01).map((row) => <TableRow key={row.account.account_code}><TableCell>{row.account.account_code} - {row.account.account_name}</TableCell><TableCell className="text-right font-mono">{fmt(row.balance)}</TableCell></TableRow>)}</TableBody></Table>
              </div>
            ))}
            <div className="rounded-md bg-blue-50 p-4 font-bold">Current Period Net Income in Equity: {fmt(netIncome)}</div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
