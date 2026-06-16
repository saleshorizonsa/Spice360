import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";

const FALLBACK = {
  ar_receivables:     "1100",
  sales_revenue:      "4001",
  vat_output:         "2200",
  cogs_general:       "5001",
  vat_input:          "2210",
  trade_payables:     "2100",
  inventory:          "1200",  // Raw materials / finished goods inventory
  grni:               "2110",  // Goods Received Not Invoiced (clearing account)
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

export function useGLAccounts() {
  const { data } = useQuery({
    queryKey: ["glAccountMapping"],
    queryFn: () => matrixSales.entities.GLAccountMapping.list(),
    staleTime: 15 * 60 * 1000,
  });
  const record = Array.isArray(data) && data.length > 0 ? data[0] : {};
  return { ...FALLBACK, ...record };
}
