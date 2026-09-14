import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { cashPositionFromLedger } from "@/lib/dashboardMetrics";

/**
 * Cash position from the general ledger — the single cash figure every screen shows.
 *
 * Screens used to add up BankAccount.current_balance, a stored figure only two forms
 * ever wrote, so dashboard, Finance, Treasury and the financial statements all
 * disagreed with what had actually been posted. This reads the ledger instead.
 *
 * It uses the same query keys and fetches as the financial reports, so a screen that
 * already has the ledger loaded shares that data rather than downloading it again.
 */
export function useLedgerCash({ refetchInterval } = {}) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const shared = { enabled: Boolean(orgId), refetchInterval };

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["chartOfAccounts", orgId],
    queryFn: () => matrixSales.entities.ChartOfAccounts.filter({ organization_id: orgId }),
    ...shared,
  });
  const { data: lines = [], isLoading: loadingLines } = useQuery({
    queryKey: ["journalLines", orgId],
    queryFn: () => matrixSales.entities.JournalLine.filter({ organization_id: orgId }),
    ...shared,
  });
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["journalEntries", orgId],
    queryFn: () => matrixSales.entities.JournalEntry.filter({ organization_id: orgId }, "-entry_date"),
    ...shared,
  });

  const cash = useMemo(
    () => cashPositionFromLedger({ accounts, lines, entries }),
    [accounts, lines, entries]
  );

  return { ...cash, isLoading: loadingAccounts || loadingLines || loadingEntries };
}
