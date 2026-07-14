import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";
import { isPostableAccount } from "@/lib/accountStatus";

/**
 * Accounts from the Chart of Accounts that may be posted to.
 *
 * Deliberately lists rather than querying `.filter({ status: 'active' })` — see
 * src/lib/accountStatus.js for why that strict filter silently emptied every
 * account dropdown. A single shared query key also keeps the GL mapping and
 * journal entry screens from racing each other with different query functions.
 */
export function useActiveAccounts() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["chartOfAccounts"],
    queryFn: () => matrixSales.entities.ChartOfAccounts.list("account_code"),
    initialData: [],
  });

  return {
    accounts: data.filter(isPostableAccount),
    allAccounts: data,
    isLoading,
    error,
  };
}

export { isPostableAccount };
