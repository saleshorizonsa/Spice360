import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Edit, FolderTree, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "@/components/utils/OrganizationContext";

const fmt = (value) => `LKR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Standard Sri Lanka CoA â€” tuple order: [code, name, name_ar, type, subtype, parent, is_header, normal_balance]
const seededAccounts = [
  // â”€â”€ 1000 ASSETS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ["1000", "Assets",                              "", "asset",     "",                 "",     true,  "debit"],
  ["1010", "Cash & Bank",                         "", "asset",     "cash",             "1000", false, "debit"],
  ["1015", "Bank â€” LKR Operating Account",        "", "asset",     "cash",             "1000", false, "debit"],
  ["1020", "Petty Cash",                          "", "asset",     "cash",             "1000", false, "debit"],
  ["1100", "Trade Receivables",                   "", "asset",     "receivables",      "1000", false, "debit"],
  ["1110", "Other Receivables",                   "", "asset",     "receivables",      "1000", false, "debit"],
  ["1120", "Advances to Suppliers",               "", "asset",     "receivables",      "1000", false, "debit"],
  ["1200", "Inventory â€” Raw Materials",           "", "asset",     "inventory",        "1000", false, "debit"],
  ["1201", "Inventory â€” Raw Cinnamon Bark",       "", "asset",     "inventory",        "1200", false, "debit"],
  ["1210", "Inventory â€” WIP",                     "", "asset",     "inventory",        "1000", false, "debit"],
  ["1211", "Inventory â€” WIP Cinnamon Processing", "", "asset",     "inventory",        "1210", false, "debit"],
  ["1220", "Inventory â€” Finished Goods",          "", "asset",     "inventory",        "1000", false, "debit"],
  ["1221", "Inventory â€” Finished Cinnamon Goods", "", "asset",     "inventory",        "1220", false, "debit"],
  ["1300", "Prepaid Expenses",                    "", "asset",     "prepaid",          "1000", false, "debit"],
  ["1400", "Fixed Assets â€” Property, Plant & Equipment", "", "asset", "fixed_asset",  "1000", false, "debit"],
  ["1410", "Accumulated Depreciation",            "", "asset",     "fixed_asset",      "1000", false, "credit"],
  ["1500", "Assets Under Construction",           "", "asset",     "auc",              "1000", false, "debit"],
  // â”€â”€ 2000 LIABILITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ["2000", "Liabilities",                         "", "liability", "",                 "",     true,  "credit"],
  ["2030", "Employee Loan Recoveries Payable",    "", "liability", "payroll",          "2000", false, "credit"],
  ["2040", "Other Employee Deductions Payable",   "", "liability", "payroll",          "2000", false, "credit"],
  ["2100", "Trade Payables",                      "", "liability", "payables",         "2000", false, "credit"],
  ["2110", "Accrued Expenses",                    "", "liability", "accruals",         "2000", false, "credit"],
  ["2200", "VAT Payable â€” Output",                "", "liability", "vat",              "2000", false, "credit"],
  ["2210", "VAT Recoverable â€” Input",             "", "asset",     "vat",              "1000", false, "debit"],
  ["2250", "SSCL Payable",                        "", "liability", "tax",              "2000", false, "credit"],
  ["2260", "Corporate Income Tax Payable",        "", "liability", "tax",              "2000", false, "credit"],
  ["2300", "Customer Advances",                   "", "liability", "advances",         "2000", false, "credit"],
  ["2310", "APIT / WHT Payable â€” IRD",            "", "liability", "payroll",          "2000", false, "credit"],
  ["2400", "EPF Payable â€” Total",                 "", "liability", "payroll",          "2000", false, "credit"],
  ["2410", "Salaries Payable",                    "", "liability", "payroll",          "2000", false, "credit"],
  ["2420", "EPF Payable â€” Employee Portion",      "", "liability", "payroll",          "2000", false, "credit"],
  ["2430", "ETF Payable",                         "", "liability", "payroll",          "2000", false, "credit"],
  ["2500", "Long-Term Loans",                     "", "liability", "loans",            "2000", false, "credit"],
  // â”€â”€ 3000 EQUITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ["3000", "Equity",                              "", "equity",    "",                 "",     true,  "credit"],
  ["3001", "Share Capital",                       "", "equity",    "capital",          "3000", false, "credit"],
  ["3100", "Retained Earnings",                   "", "equity",    "retained_earnings","3000", false, "credit"],
  ["3200", "Current Year Profit / Loss",          "", "equity",    "current_year_profit","3000",false,"credit"],
  // â”€â”€ 4000 REVENUE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ["4000", "Revenue",                             "", "revenue",   "",                 "",     true,  "credit"],
  ["4001", "Sales Revenue â€” General",             "", "revenue",   "sales",            "4000", false, "credit"],
  ["4002", "Cinnamon Export Sales",               "", "revenue",   "sales",            "4000", false, "credit"],
  ["4003", "Cinnamon Domestic Sales",             "", "revenue",   "sales",            "4000", false, "credit"],
  ["4010", "Service Revenue",                     "", "revenue",   "services",         "4000", false, "credit"],
  ["4020", "Other Income",                        "", "revenue",   "other_income",     "4000", false, "credit"],
  // â”€â”€ 5000 EXPENSES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ["5000", "Expenses",                                    "", "expense", "",                    "",     true,  "debit"],
  ["5001", "Cost of Goods Sold â€” General",                "", "expense", "cost_of_goods_sold",  "5000", false, "debit"],
  ["5002", "COGS â€” Cinnamon Processing",                  "", "expense", "cost_of_goods_sold",  "5000", false, "debit"],
  ["5100", "Salaries & Wages",                            "", "expense", "payroll",             "5000", false, "debit"],
  ["5110", "Processing Labor â€” Cinnamon",                 "", "expense", "payroll",             "5000", false, "debit"],
  ["5120", "Raw Material Purchases â€” Cinnamon Bark",      "", "expense", "operating_expense",   "5000", false, "debit"],
  ["5210", "EPF Employer Contribution",                   "", "expense", "payroll",             "5000", false, "debit"],
  ["5220", "ETF Employer Contribution",                   "", "expense", "payroll",             "5000", false, "debit"],
  ["5300", "Rent Expense",                                "", "expense", "rent",                "5000", false, "debit"],
  ["5400", "Utilities",                                   "", "expense", "utilities",           "5000", false, "debit"],
  ["5410", "Drying & Curing Costs",                       "", "expense", "utilities",           "5000", false, "debit"],
  ["5500", "Depreciation Expense",                        "", "expense", "depreciation",        "5000", false, "debit"],
  ["5600", "VAT Expense (irrecoverable)",                 "", "expense", "vat",                 "5000", false, "debit"],
  ["5700", "Administrative Expenses",                     "", "expense", "operating_expense",   "5000", false, "debit"],
  ["5800", "Selling & Export Costs",                      "", "expense", "operating_expense",   "5000", false, "debit"],
  ["5900", "Gross Payment / WHT Expense",                 "", "expense", "other_expense",       "5000", false, "debit"],
];

// Idempotent: fetches existing codes for the org and skips any that already exist.
export async function seedChartOfAccounts(orgId) {
  const existing = await matrixSales.entities.ChartOfAccounts.filter({ organization_id: orgId });
  const existingCodes = new Set((existing || []).map((a) => a.account_code));

  const toInsert = seededAccounts.filter(([code]) => !existingCodes.has(code));

  await Promise.all(
    toInsert.map(([account_code, account_name, , account_type, account_subtype, parent_account, is_header, normal_balance]) =>
      matrixSales.entities.ChartOfAccounts.create({
        account_code,
        account_name,
        account_type,
        account_subtype,
        parent_account,
        is_header,
        normal_balance,
        is_active: true,
        allow_direct_posting: !is_header,
        cost_center_required: false,
        opening_balance: 0,
        currency: "LKR",
        organization_id: orgId,
      })
    )
  );

  return { inserted: toInsert.length, skipped: existingCodes.size };
}

const GL_MAPPING_DEFAULTS = {
  ar_receivables:     "1100",
  sales_revenue:      "4001",
  vat_output:         "2200",
  cogs_general:       "5001",
  vat_input:          "2210",
  trade_payables:     "2100",
  salaries_expense:   "5100",
  epf_employer_exp:   "5210",
  etf_employer_exp:   "5220",
  salaries_payable:   "2410",
  epf_payable:        "2420",
  etf_payable:        "2430",
  apit_payable:       "2310",
  cash_bank:          "1010",
  depreciation_exp:   "5500",
  accum_depreciation: "1410",
  wht_expense:        "5900",
  wht_net_payable:    "2100",
};

export async function seedGLAccountMapping(orgId) {
  const existing = await matrixSales.entities.GLAccountMapping.filter({ organization_id: orgId });
  if (existing && existing.length > 0) return { inserted: 0, skipped: 1 };
  await matrixSales.entities.GLAccountMapping.create({ ...GL_MAPPING_DEFAULTS, organization_id: orgId });
  return { inserted: 1, skipped: 0 };
}

function AccountForm({ account, accounts, orgId, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(account || {
    account_code: "",
    account_name: "",
    account_type: "asset",
    account_subtype: "",
    parent_account: "",
    is_header: false,
    normal_balance: "debit",
    is_active: true,
    allow_direct_posting: true,
    cost_center_required: false,
    opening_balance: 0,
    currency: "LKR",
    organization_id: orgId
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => account?.id
      ? matrixSales.entities.ChartOfAccounts.update(account.id, payload)
      : matrixSales.entities.ChartOfAccounts.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", orgId] });
      toast({ title: "Success", description: "Account saved successfully." });
      onClose();
    },
    onError: (error) => toast({ title: "Unable to save account", description: error.message, variant: "destructive" })
  });

  const update = (field, value) => setForm((prev) => ({
    ...prev,
    [field]: value,
    ...(field === "is_header" && value ? { allow_direct_posting: false } : {})
  }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate({ ...form, organization_id: orgId }); }}>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Account Code *</Label><Input value={form.account_code} onChange={(e) => update("account_code", e.target.value)} required /></div>
            <div><Label>Account Name *</Label><Input value={form.account_name} onChange={(e) => update("account_name", e.target.value)} required /></div>
            <div>
              <Label>Account Type *</Label>
              <Select value={form.account_type} onValueChange={(value) => update("account_type", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["asset", "liability", "equity", "revenue", "expense"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Subtype</Label><Input value={form.account_subtype || ""} onChange={(e) => update("account_subtype", e.target.value)} /></div>
            <div>
              <Label>Parent Account</Label>
              <Select value={form.parent_account || "NONE"} onValueChange={(value) => update("parent_account", value === "NONE" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {accounts.filter((item) => item.account_code !== form.account_code).map((item) => (
                    <SelectItem key={item.id || item.account_code} value={item.account_code}>{item.account_code} - {item.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Normal Balance</Label>
              <Select value={form.normal_balance} onValueChange={(value) => update("normal_balance", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Opening Balance</Label><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => update("opening_balance", Number(e.target.value || 0))} /></div>
            <div><Label>Currency</Label><Input value={form.currency || "LKR"} onChange={(e) => update("currency", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["is_header", "Header account"],
              ["is_active", "Active"],
              ["allow_direct_posting", "Allow direct posting"],
              ["cost_center_required", "Cost center required"]
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 rounded-md border p-3">
                <Switch checked={Boolean(form[field])} onCheckedChange={(value) => update(field, value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Account"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ChartOfAccounts() {
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const orgId = currentOrg?.id;

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const rows = await matrixSales.entities.ChartOfAccounts.filter({ organization_id: orgId });
      if (!rows.length) {
        await seedChartOfAccounts(orgId);
        return matrixSales.entities.ChartOfAccounts.filter({ organization_id: orgId });
      }
      return rows;
    },
    initialData: []
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["journalLines", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.JournalLine.filter({ organization_id: orgId }),
    initialData: []
  });

  const balances = useMemo(() => {
    const map = new Map();
    lines.forEach((line) => {
      const current = map.get(line.account_code) || { debit: 0, credit: 0 };
      current.debit += Number(line.debit || 0);
      current.credit += Number(line.credit || 0);
      map.set(line.account_code, current);
    });
    return map;
  }, [lines]);

  const depthFor = (account, lookup, depth = 0) => {
    if (!account.parent_account || depth > 8) return depth;
    const parent = lookup.get(account.parent_account);
    return parent ? depthFor(parent, lookup, depth + 1) : depth;
  };

  const rows = useMemo(() => {
    const lookup = new Map(accounts.map((account) => [account.account_code, account]));
    return [...accounts].sort((a, b) => a.account_code.localeCompare(b.account_code)).map((account) => {
      const movement = balances.get(account.account_code) || { debit: 0, credit: 0 };
      const movementBalance = account.normal_balance === "credit"
        ? movement.credit - movement.debit
        : movement.debit - movement.credit;
      return {
        ...account,
        depth: depthFor(account, lookup),
        current_balance: Number(account.opening_balance || 0) + movementBalance
      };
    });
  }, [accounts, balances]);

  const seedMutation = useMutation({
    mutationFn: () => seedChartOfAccounts(orgId),
    onSuccess: ({ inserted, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ["accounts", orgId] });
      toast({
        title: "Chart of accounts seeded",
        description: `${inserted} account${inserted !== 1 ? "s" : ""} inserted, ${skipped} already existed.`,
      });
    },
    onError: (error) => {
      toast({ title: "Seed failed", description: error.message, variant: "destructive" });
    },
  });

  const glSeedMutation = useMutation({
    mutationFn: () => seedGLAccountMapping(orgId),
    onSuccess: ({ inserted, skipped }) => {
      toast({
        title: "GL account mapping seeded",
        description: inserted ? "Default GL mapping created." : "GL mapping already exists â€” skipped.",
      });
    },
    onError: (error) => {
      toast({ title: "GL mapping seed failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-slate-600">Manage posting accounts, headers, opening balances, and ledger access.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={!orgId || seedMutation.isPending}>
            <FolderTree className="mr-2 h-4 w-4" />
            Seed Sri Lanka CoA
          </Button>
          <Button variant="outline" onClick={() => glSeedMutation.mutate()} disabled={!orgId || glSeedMutation.isPending}>
            <FolderTree className="mr-2 h-4 w-4" />
            Seed GL Mapping
          </Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Normal</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center">Loading accounts...</TableCell></TableRow>
                ) : rows.map((account) => (
                  <TableRow key={`${account.id || account.account_code}`}>
                    <TableCell className={account.is_header ? "font-bold" : "font-mono"}>{account.account_code}</TableCell>
                    <TableCell className={account.is_header ? "font-bold" : ""} style={{ paddingInlineStart: `${account.depth * 16 + 16}px` }}>
                      {account.account_name}
                      {account.is_header && <Badge className="ml-2" variant="outline">Header</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{account.account_type}</Badge></TableCell>
                    <TableCell className="capitalize">{account.normal_balance}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(account.current_balance)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/AccountLedger?account=${encodeURIComponent(account.account_code)}`)}>
                          <Search className="mr-2 h-4 w-4" />
                          Ledger
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(account); setShowForm(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showForm && <AccountForm account={editing} accounts={accounts} orgId={orgId} onClose={() => setShowForm(false)} />}
    </div>
  );
}
