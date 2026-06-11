import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/components/utils/OrganizationContext";

const fmt = (value) => `LKR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AccountLedger() {
  const { currentOrg } = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const orgId = currentOrg?.id;
  const queryAccount = new URLSearchParams(location.search).get("account") || "";
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAccount, setSelectedAccount] = useState(queryAccount);

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

  const journalMap = useMemo(() => new Map(journals.map((journal) => [journal.journal_number, journal])), [journals]);
  const account = accounts.find((item) => item.account_code === selectedAccount);

  const ledgerRows = useMemo(() => {
    if (!account) return [];
    let running = Number(account.opening_balance || 0);
    return lines
      .filter((line) => line.account_code === account.account_code)
      .map((line) => ({ ...line, journal: journalMap.get(line.journal_number) }))
      .filter((line) => {
        const date = line.journal?.entry_date || "";
        return line.journal?.status === "posted" && date >= fromDate && date <= toDate;
      })
      .sort((a, b) => String(a.journal?.entry_date).localeCompare(String(b.journal?.entry_date)) || Number(a.line_number || 0) - Number(b.line_number || 0))
      .map((line) => {
        running += account.normal_balance === "credit"
          ? Number(line.credit || 0) - Number(line.debit || 0)
          : Number(line.debit || 0) - Number(line.credit || 0);
        return { ...line, running_balance: running };
      });
  }, [lines, account, journalMap, fromDate, toDate]);

  const closingBalance = ledgerRows.length ? ledgerRows[ledgerRows.length - 1].running_balance : Number(account?.opening_balance || 0);

  const exportCsv = () => {
    downloadCsv(`account-ledger-${selectedAccount || "all"}-${fromDate}-${toDate}.csv`, [
      ["Date", "Journal Number", "Reference", "Description", "Debit", "Credit", "Running Balance"],
      ["Opening Balance", "", "", "", "", "", Number(account?.opening_balance || 0).toFixed(2)],
      ...ledgerRows.map((line) => [
        line.journal?.entry_date,
        line.journal_number,
        line.journal?.reference_id || line.journal?.reference_type || "",
        line.description || line.journal?.description || "",
        Number(line.debit || 0).toFixed(2),
        Number(line.credit || 0).toFixed(2),
        Number(line.running_balance || 0).toFixed(2)
      ]),
      ["Closing Balance", "", "", "", "", "", Number(closingBalance || 0).toFixed(2)]
    ]);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Account Ledger</h1>
          <p className="text-slate-600">Account-level journal activity with running balance.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!account}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Label>Account</Label>
              <Select value={selectedAccount || ""} onValueChange={(value) => { setSelectedAccount(value); navigate(`/AccountLedger?account=${encodeURIComponent(value)}`, { replace: true }); }}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((item) => !item.is_header).map((item) => (
                    <SelectItem key={item.id || item.account_code} value={item.account_code}>{item.account_code} - {item.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {account && (
            <div className="grid grid-cols-1 gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-4">
              <div><span className="text-sm text-slate-500">Account</span><div className="font-semibold">{account.account_code} - {account.account_name}</div></div>
              <div><span className="text-sm text-slate-500">Type</span><div><Badge>{account.account_type}</Badge></div></div>
              <div><span className="text-sm text-slate-500">Normal Balance</span><div className="capitalize">{account.normal_balance}</div></div>
              <div><span className="text-sm text-slate-500">Opening Balance</span><div className="font-mono">{fmt(account.opening_balance)}</div></div>
            </div>
          )}

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal #</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-slate-50">
                  <TableCell>Opening</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell>Opening Balance</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-mono">{fmt(account?.opening_balance)}</TableCell>
                </TableRow>
                {ledgerRows.map((line) => (
                  <TableRow key={line.id || `${line.journal_number}-${line.line_number}`}>
                    <TableCell>{line.journal?.entry_date}</TableCell>
                    <TableCell>
                      <button className="font-mono text-blue-700 hover:underline" onClick={() => navigate(`/JournalEntry?journal=${encodeURIComponent(line.journal_number)}`)}>
                        {line.journal_number}
                      </button>
                    </TableCell>
                    <TableCell>{line.journal?.reference_id || line.journal?.reference_type || "-"}</TableCell>
                    <TableCell>{line.description || line.journal?.description || "-"}</TableCell>
                    <TableCell className="text-right font-mono">{line.debit ? fmt(line.debit) : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{line.credit ? fmt(line.credit) : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(line.running_balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell>Closing</TableCell>
                  <TableCell colSpan={5}>Closing Balance</TableCell>
                  <TableCell className="text-right font-mono">{fmt(closingBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
