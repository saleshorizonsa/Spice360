import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, RotateCcw, Save, Search, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getNextDocumentNumber } from "@/components/utils/documentNumberGenerator";
import { postJournalEntry, reverseJournalEntry } from "@/components/utils/journalService";
import { useOrganization } from "@/components/utils/OrganizationContext";

const fmt = (value) => `LKR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blankLine = { account_code: "", account_name: "", description: "", debit: 0, credit: 0, cost_center: "", vat_code: "", currency: "LKR" };

function JournalDetail({ journal, lines, onClose }) {
  return (
    <Dialog open={!!journal} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>{journal?.journal_number}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><span className="text-slate-500">Date</span><div className="font-medium">{journal?.entry_date}</div></div>
          <div><span className="text-slate-500">Type</span><div className="font-medium">{journal?.entry_type}</div></div>
          <div><span className="text-slate-500">Status</span><div><Badge>{journal?.status}</Badge></div></div>
          <div><span className="text-slate-500">Period</span><div className="font-medium">{journal?.period}</div></div>
        </div>
        <p className="text-sm text-slate-700">{journal?.description}</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id || line.line_number}>
                  <TableCell>{line.line_number}</TableCell>
                  <TableCell>{line.account_code} - {line.account_name}</TableCell>
                  <TableCell>{line.description || "-"}</TableCell>
                  <TableCell className="text-right font-mono">{line.debit ? fmt(line.debit) : "-"}</TableCell>
                  <TableCell className="text-right font-mono">{line.credit ? fmt(line.credit) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function JournalEntry() {
  const { currentOrg } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = currentOrg?.id;
  const [periodFilter, setPeriodFilter] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detailJournal, setDetailJournal] = useState(null);
  const [detailLines, setDetailLines] = useState([]);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    entry_type: "adjustment",
    description: "",
    reference_type: "",
    reference_id: ""
  });
  const [lines, setLines] = useState([{ ...blankLine }, { ...blankLine }]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.ChartOfAccounts.filter({ organization_id: orgId }),
    initialData: []
  });

  const { data: journals = [] } = useQuery({
    queryKey: ["journalEntries", orgId],
    enabled: !!orgId,
    queryFn: () => matrixSales.entities.JournalEntry.filter({ organization_id: orgId }, "-entry_date"),
    initialData: []
  });

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [lines]);

  const filteredJournals = journals.filter((journal) => {
    if (periodFilter && !journal.period?.startsWith(periodFilter) && !journal.entry_date?.startsWith(periodFilter)) return false;
    if (statusFilter !== "ALL" && journal.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (journal.journal_number || '').toLowerCase().includes(q) ||
        (journal.description || '').toLowerCase().includes(q) ||
        (journal.reference_id || '').toLowerCase().includes(q) ||
        (journal.entry_type || '').toLowerCase().includes(q);
    }
    return true;
  });

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, [field]: value };
      if (field === "account_code") {
        const account = accounts.find((item) => item.account_code === value);
        next.account_name = account?.account_name || "";
      }
      return next;
    }));
  };

  const resetForm = () => {
    setForm({ entry_date: new Date().toISOString().slice(0, 10), entry_type: "adjustment", description: "", reference_type: "", reference_id: "" });
    setLines([{ ...blankLine }, { ...blankLine }]);
  };

  const postMutation = useMutation({
    mutationFn: () => postJournalEntry({
      lines,
      referenceType: form.reference_type,
      referenceId: form.reference_id,
      description: form.description,
      entryDate: form.entry_date,
      entryType: form.entry_type,
      createdBy: "",
      orgId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journalEntries", orgId] });
      queryClient.invalidateQueries({ queryKey: ["journalLines", orgId] });
      toast({ title: "Journal posted", description: "The entry was posted to the ledger." });
      resetForm();
    },
    onError: (error) => toast({ title: "Unable to post journal", description: error.message, variant: "destructive" })
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const journalNumber = await getNextDocumentNumber("JE");
      const entry = await matrixSales.entities.JournalEntry.create({
        journal_number: journalNumber,
        entry_date: form.entry_date,
        entry_type: form.entry_type,
        reference_type: form.reference_type,
        reference_id: form.reference_id,
        description: form.description,
        status: "draft",
        total_debit: totals.totalDebit,
        total_credit: totals.totalCredit,
        period: form.entry_date.slice(0, 7),
        organization_id: orgId
      });
      await Promise.all(lines.map((line, index) => matrixSales.entities.JournalLine.create({
        ...line,
        journal_number: journalNumber,
        line_number: index + 1,
        organization_id: orgId
      })));
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journalEntries", orgId] });
      toast({ title: "Draft saved", description: "Journal entry draft was saved." });
      resetForm();
    }
  });

  const reverseMutation = useMutation({
    mutationFn: (journal) => reverseJournalEntry(journal.journal_number, new Date().toISOString().slice(0, 10), ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journalEntries", orgId] });
      queryClient.invalidateQueries({ queryKey: ["journalLines", orgId] });
      toast({ title: "Journal reversed", description: "A reversal entry was posted." });
    },
    onError: (error) => toast({ title: "Unable to reverse journal", description: error.message, variant: "destructive" })
  });

  const openDetail = async (journal) => {
    setDetailJournal(journal);
    setDetailLines(await matrixSales.entities.JournalLine.filter({ journal_number: journal.journal_number }));
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Journal Entries</h1>
        <p className="text-slate-600">Create manual journals, save drafts, post balanced entries, and reverse posted journals.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Manual Journal Entry</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div><Label>Date</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.entry_type} onValueChange={(value) => setForm({ ...form, entry_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["invoice", "payment", "adjustment", "opening", "reversal", "depreciation", "payroll"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reference Type</Label><Input value={form.reference_type} onChange={(e) => setForm({ ...form, reference_type: e.target.value })} /></div>
            <div><Label>Reference ID</Label><Input value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })} /></div>
            <div className="md:col-span-5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell className="min-w-[280px]">
                      <Select value={line.account_code || ""} onValueChange={(value) => updateLine(index, "account_code", value)}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter((account) => !account.is_header && account.allow_direct_posting !== false).map((account) => (
                            <SelectItem key={account.id || account.account_code} value={account.account_code}>{account.account_code} - {account.account_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-1 text-xs text-slate-500">{line.account_name}</div>
                    </TableCell>
                    <TableCell><Input value={line.description || ""} onChange={(e) => updateLine(index, "description", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={line.debit} onChange={(e) => updateLine(index, "debit", Number(e.target.value || 0))} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={line.credit} onChange={(e) => updateLine(index, "credit", Number(e.target.value || 0))} /></TableCell>
                    <TableCell><Button type="button" variant="ghost" size="icon" disabled={lines.length <= 2} onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                <TableRow className={totals.balanced ? "bg-emerald-50" : "bg-red-50"}>
                  <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                  <TableCell className="font-mono font-bold">{fmt(totals.totalDebit)}</TableCell>
                  <TableCell className="font-mono font-bold">{fmt(totals.totalCredit)}</TableCell>
                  <TableCell className="font-mono font-bold">{fmt(Math.abs(totals.difference))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setLines((prev) => [...prev, { ...blankLine }])}><Plus className="mr-2 h-4 w-4" />Add Line</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending}><Save className="mr-2 h-4 w-4" />Save Draft</Button>
              <Button onClick={() => postMutation.mutate()} disabled={!totals.balanced || postMutation.isPending}><Send className="mr-2 h-4 w-4" />Post Entry</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Journal List</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search journals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-48" />
                </div>
                <Input type="month" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="posted">Posted</SelectItem><SelectItem value="reversed">Reversed</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Journal #</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredJournals.map((journal) => (
                  <TableRow key={journal.id || journal.journal_number}>
                    <TableCell className="font-mono">{journal.journal_number}</TableCell>
                    <TableCell>{journal.entry_date}</TableCell>
                    <TableCell>{journal.entry_type}</TableCell>
                    <TableCell>{journal.description}</TableCell>
                    <TableCell><Badge>{journal.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmt(journal.total_debit)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(journal.total_credit)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(journal)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={journal.status !== "posted"} onClick={() => reverseMutation.mutate(journal)}><RotateCcw className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <JournalDetail journal={detailJournal} lines={detailLines} onClose={() => setDetailJournal(null)} />
    </div>
  );
}
