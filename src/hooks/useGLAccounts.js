import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";

// Default account codes, used only until the mapping is configured in
// Finance → GL Account Mapping. They are generic guesses — if your chart of
// accounts uses different codes, map them there; the saved mapping always wins.
export const GL_ACCOUNT_FALLBACK = {
  ar_receivables:     "1100",
  sales_revenue:      "4001",
  vat_output:         "2200",
  cogs_general:       "5001",
  vat_input:          "2210",
  trade_payables:     "2100",
  inventory:          "1200",
  grni:               "2110",
  freight_accrual:    "2130",  // inbound freight owed to 3rd-party carriers
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
  wht_net_payable:    "2320",
  fixed_asset_cost:      "1400",
  gain_on_disposal:      "7001",
  loss_on_disposal:      "6001",
  accrued_mfg_costs:     "2120",  // Accrued Manufacturing / Processing Costs
};

export function useGLAccounts() {
  const { data } = useQuery({
    queryKey: ["glAccountMapping"],
    queryFn: () => matrixSales.entities.GLAccountMapping.list(),
    staleTime: 15 * 60 * 1000,
  });
  const record = Array.isArray(data) && data.length > 0 ? data[0] : {};

  // Only take known keys with a real value. Spreading the whole record used to
  // (a) let a blank field in the mapping screen overwrite a fallback with "",
  // producing a journal line with no account code, and (b) leak DB metadata
  // (id, status, created_at…) into the returned account map.
  const mapped = {};
  for (const key of Object.keys(GL_ACCOUNT_FALLBACK)) {
    const value = record?.[key];
    if (value === 0 || (value != null && String(value).trim() !== "")) {
      mapped[key] = String(value).trim();
    }
  }

  return { ...GL_ACCOUNT_FALLBACK, ...mapped };
}
