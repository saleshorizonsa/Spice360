import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

const ACCOUNT_FIELDS = [
  { key: "ar_receivables",     label: "Accounts Receivable",          category: "Assets",      fallback: "1100" },
  { key: "inventory",          label: "Inventory",                    category: "Assets",      fallback: "1200" },
  { key: "cash_bank",          label: "Cash & Bank",                  category: "Assets",      fallback: "1010" },
  { key: "vat_input",          label: "VAT Input (Recoverable)",      category: "Assets",      fallback: "2210" },
  { key: "accum_depreciation", label: "Accumulated Depreciation",     category: "Assets",      fallback: "1410" },
  { key: "trade_payables",     label: "Trade Payables",               category: "Liabilities", fallback: "2100" },
  { key: "grni",               label: "Goods Received Not Invoiced",  category: "Liabilities", fallback: "2110" },
  { key: "vat_output",         label: "VAT Output (Payable)",         category: "Liabilities", fallback: "2200" },
  { key: "salaries_payable",   label: "Salaries Payable",             category: "Liabilities", fallback: "2410" },
  { key: "epf_payable",        label: "EPF Payable",                  category: "Liabilities", fallback: "2420" },
  { key: "etf_payable",        label: "ETF Payable",                  category: "Liabilities", fallback: "2430" },
  { key: "apit_payable",       label: "APIT Payable",                 category: "Liabilities", fallback: "2310" },
  { key: "wht_net_payable",    label: "WHT Net Payable",              category: "Liabilities", fallback: "2100" },
  { key: "sales_revenue",      label: "Sales Revenue",                category: "Revenue",     fallback: "4001" },
  { key: "cogs_general",       label: "Cost of Goods Sold",           category: "Expenses",    fallback: "5001" },
  { key: "salaries_expense",   label: "Salaries Expense",             category: "Expenses",    fallback: "5100" },
  { key: "epf_employer_exp",   label: "EPF Employer Expense",         category: "Expenses",    fallback: "5210" },
  { key: "etf_employer_exp",   label: "ETF Employer Expense",         category: "Expenses",    fallback: "5220" },
  { key: "depreciation_exp",   label: "Depreciation Expense",         category: "Expenses",    fallback: "5500" },
  { key: "wht_expense",        label: "Withholding Tax Expense",      category: "Expenses",    fallback: "5900" },
];

const CATEGORIES = ["Assets", "Liabilities", "Revenue", "Expenses"];

const CATEGORY_COLORS = {
  Assets:      "bg-blue-50 border-blue-200",
  Liabilities: "bg-orange-50 border-orange-200",
  Revenue:     "bg-green-50 border-green-200",
  Expenses:    "bg-red-50 border-red-200",
};

export default function GLAccountMappingForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ["chartOfAccounts"],
    queryFn: () => matrixSales.entities.ChartOfAccounts.filter({ status: "active" }),
    initialData: [],
  });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["glAccountMapping"],
    queryFn: () => matrixSales.entities.GLAccountMapping.list(),
    staleTime: 0,
  });

  const existing = mappings.length > 0 ? mappings[0] : null;
  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (existing) {
      const initial = {};
      ACCOUNT_FIELDS.forEach(({ key, fallback }) => {
        initial[key] = existing[key] || fallback;
      });
      setFormData(initial);
      setIsDirty(false);
    } else if (!isLoading) {
      // No existing mapping — pre-fill with fallbacks
      const initial = {};
      ACCOUNT_FIELDS.forEach(({ key, fallback }) => { initial[key] = fallback; });
      setFormData(initial);
    }
  }, [existing?.id, isLoading]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (existing) return matrixSales.entities.GLAccountMapping.update(existing.id, data);
      return matrixSales.entities.GLAccountMapping.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["glAccountMapping"] });
      setIsDirty(false);
      toast({ title: "GL Mapping saved", description: "Account mapping updated successfully." });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const nonHeaderAccounts = accounts.filter((a) => !a.is_header);

  if (isLoading) {
    return <div className="py-8 text-center text-gray-500 text-sm">Loading account mapping…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-600">
          Map each accounting function to a Chart of Accounts code. These codes are used by all modules when posting
          GL entries automatically.
        </p>
        {isDirty && (
          <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50 shrink-0">
            Unsaved changes
          </Badge>
        )}
      </div>

      {CATEGORIES.map((category) => {
        const fields = ACCOUNT_FIELDS.filter((f) => f.category === category);
        return (
          <div key={category} className={`rounded-lg border p-4 ${CATEGORY_COLORS[category]}`}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{category}</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {fields.map(({ key, label, fallback }) => {
                const currentCode = formData[key] || "";
                const matchedAcc = nonHeaderAccounts.find((a) => a.account_code === currentCode);
                return (
                  <div key={key}>
                    <Label className="text-xs text-gray-700 mb-1 block">{label}</Label>
                    <Select value={currentCode} onValueChange={(val) => handleChange(key, val)}>
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue placeholder={`Default: ${fallback}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {nonHeaderAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.account_code}>
                            {acc.account_code} — {acc.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {matchedAcc && (
                      <p className="text-xs text-gray-400 mt-0.5">{matchedAcc.account_name}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end pt-2 border-t">
        <Button
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending || !isDirty}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saveMutation.isPending ? "Saving…" : "Save GL Mapping"}
        </Button>
      </div>
    </div>
  );
}
