import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { GL_ACCOUNT_FALLBACK } from "@/hooks/useGLAccounts";
import { useActiveAccounts } from "@/hooks/useActiveAccounts";

// Fallback codes come from GL_ACCOUNT_FALLBACK (the same table the posting code
// reads) so the two can never drift. They previously did: this screen pre-filled
// "WHT Net Payable" with 2100 — the Trade Payables code — so saving the mapping
// silently pointed withholding tax at Trade Payables.
const ACCOUNT_FIELD_LABELS = [
  { key: "ar_receivables",     label: "Accounts Receivable",          category: "Assets" },
  { key: "inventory",          label: "Inventory",                    category: "Assets" },
  { key: "cash_bank",          label: "Cash & Bank",                  category: "Assets" },
  { key: "vat_input",          label: "VAT Input (Recoverable)",      category: "Assets" },
  { key: "accum_depreciation", label: "Accumulated Depreciation",     category: "Assets" },
  { key: "fixed_asset_cost",   label: "Fixed Asset Cost",             category: "Assets" },
  { key: "trade_payables",     label: "Trade Payables",               category: "Liabilities" },
  { key: "grni",               label: "Goods Received Not Invoiced",  category: "Liabilities" },
  { key: "vat_output",         label: "VAT Output (Payable)",         category: "Liabilities" },
  { key: "salaries_payable",   label: "Salaries Payable",             category: "Liabilities" },
  { key: "epf_payable",        label: "EPF Payable",                  category: "Liabilities" },
  { key: "etf_payable",        label: "ETF Payable",                  category: "Liabilities" },
  { key: "apit_payable",       label: "APIT Payable",                 category: "Liabilities" },
  { key: "wht_net_payable",    label: "WHT Net Payable",              category: "Liabilities" },
  { key: "accrued_mfg_costs",  label: "Accrued Manufacturing Costs",  category: "Liabilities" },
  { key: "sales_revenue",      label: "Sales Revenue",                category: "Revenue" },
  { key: "gain_on_disposal",   label: "Gain on Asset Disposal",       category: "Revenue" },
  { key: "cogs_general",       label: "Cost of Goods Sold",           category: "Expenses" },
  { key: "salaries_expense",   label: "Salaries Expense",             category: "Expenses" },
  { key: "epf_employer_exp",   label: "EPF Employer Expense",         category: "Expenses" },
  { key: "etf_employer_exp",   label: "ETF Employer Expense",         category: "Expenses" },
  { key: "depreciation_exp",   label: "Depreciation Expense",         category: "Expenses" },
  { key: "wht_expense",        label: "Withholding Tax Expense",      category: "Expenses" },
  { key: "loss_on_disposal",   label: "Loss on Asset Disposal",       category: "Expenses" },
];

const ACCOUNT_FIELDS = ACCOUNT_FIELD_LABELS.map((field) => ({
  ...field,
  fallback: GL_ACCOUNT_FALLBACK[field.key],
}));

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

  const { accounts, isLoading: accountsLoading } = useActiveAccounts();

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

  const accountOptions = useMemo(
    () =>
      nonHeaderAccounts.map((acc) => ({
        value: acc.account_code,
        label: `${acc.account_code} - ${acc.account_name}`,
      })),
    [nonHeaderAccounts]
  );

  if (isLoading || accountsLoading) {
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

      {/* Never fail silently: an empty account list used to surface only as
          "No results found" inside every dropdown, with no hint as to why. */}
      {nonHeaderAccounts.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>No postable accounts found.</strong> The dropdowns below will be empty. Add accounts under{" "}
          <em>Admin → Chart of Accounts</em>. If accounts already exist there, check that they are not all marked as
          header accounts and that their status is not set to inactive.
        </div>
      )}

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
                    <SearchableSelect
                      mode="client"
                      value={currentCode}
                      onChange={(val) => handleChange(key, val)}
                      options={accountOptions}
                      placeholder={`Default: ${fallback}`}
                      searchPlaceholder="Search accounts…"
                    />
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
