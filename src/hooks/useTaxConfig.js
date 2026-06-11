import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";

const FALLBACK = {
  vat_standard_rate: 18,
  vat_zero_rate: 0,
  sscl_rate: 2.5,
  sscl_threshold_quarterly: 120000000,
  epf_employee_rate: 8,
  epf_employer_rate: 12,
  etf_employer_rate: 3,
  wht_dividends: 14,
  wht_interest: 14,
  wht_rent: 14,
  wht_service_fees: 14,
  wht_commissions: 5,
  wht_construction: 2.5,
  corporate_tax_standard: 30,
  corporate_tax_sme: 14,
};

export function useTaxConfig() {
  const { data } = useQuery({
    queryKey: ["slTaxConfiguration"],
    queryFn: () => matrixSales.entities.SLTaxConfiguration.list(),
    staleTime: 15 * 60 * 1000,
  });

  const record = Array.isArray(data) && data.length > 0 ? data[0] : {};
  return { ...FALLBACK, ...record };
}
