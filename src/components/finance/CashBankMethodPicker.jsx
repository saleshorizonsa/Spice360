import React, { useEffect, useMemo, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { isCashAccount, isBankAccount, DEFAULT_PETTY_CASH_CODE } from "@/lib/vendorPayment";

const toOption = (a) => ({ value: a.account_code, label: `${a.account_code} — ${a.account_name}` });

/**
 * Payment-method picker shared by the customer-receipt (AR) and vendor-payment (AP)
 * dialogs. The method drives which chart account the money moves through:
 *
 *   Cash          → a petty-cash account, pre-selected to 1011 Petty Cash - Priyantha
 *   Bank Transfer → a bank account chosen from the chart
 *
 * Controlled: the parent owns `method` and `account` (so it can post them). Switching
 * method re-defaults the account; the account stays choosable within the method.
 */
export default function CashBankMethodPicker({
  allAccounts = [],
  method,
  onMethodChange,
  account,
  onAccountChange,
  label = "Account",
}) {
  const cashOptions = useMemo(() => allAccounts.filter(isCashAccount).map(toOption), [allAccounts]);
  const bankOptions = useMemo(() => allAccounts.filter(isBankAccount).map(toOption), [allAccounts]);
  const options = method === "cash" ? cashOptions : bankOptions;

  const defaultFor = (m) => {
    if (m === "cash") {
      const has1011 = cashOptions.some((o) => o.value === DEFAULT_PETTY_CASH_CODE);
      return has1011 ? DEFAULT_PETTY_CASH_CODE : (cashOptions[0]?.value || "");
    }
    // Don't guess a bank when there are several — force an explicit choice.
    return bankOptions.length === 1 ? bankOptions[0].value : "";
  };

  // Pre-select the default account once the chart has loaded (and only if the parent
  // hasn't already set one).
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    if (cashOptions.length === 0 && bankOptions.length === 0) return; // chart not loaded yet
    inited.current = true;
    if (!account) onAccountChange(defaultFor(method));
  }, [cashOptions, bankOptions]);

  const changeMethod = (m) => {
    onMethodChange(m);
    onAccountChange(defaultFor(m));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Payment Method *</Label>
        <Select value={method} onValueChange={changeMethod}>
          <SelectTrigger><SelectValue placeholder="Select method…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SearchableSelect
        label={`${label} (${method === "cash" ? "Cash" : "Bank"}) *`}
        mode="client"
        value={account}
        onChange={onAccountChange}
        options={options}
        placeholder={method === "cash" ? "Select a petty cash account…" : "Select a bank account…"}
        searchPlaceholder={method === "cash" ? "Search cash accounts…" : "Search bank accounts…"}
        emptyText={
          method === "cash"
            ? "No cash / petty-cash accounts in the chart. Add one under Admin → Chart of Accounts."
            : "No bank accounts in the chart. Add one under Admin → Chart of Accounts."
        }
      />
    </div>
  );
}
