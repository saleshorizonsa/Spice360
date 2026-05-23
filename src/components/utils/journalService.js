import { matrixSales } from "@/api/matrixSalesClient";
import { getNextDocumentNumber } from "./documentNumberGenerator";
import { logAuditTrail } from "./auditTrail";

const toAmount = (value) => Number(value || 0);
const money = (value) => Math.round(toAmount(value) * 100) / 100;
const periodFromDate = (date) => String(date || new Date().toISOString().slice(0, 10)).slice(0, 7);

const assertBalanced = (lines) => {
  const totalDebit = money(lines.reduce((sum, line) => sum + toAmount(line.debit), 0));
  const totalCredit = money(lines.reduce((sum, line) => sum + toAmount(line.credit), 0));
  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error(`Journal entry is not balanced. Debit ${totalDebit.toFixed(2)} does not equal credit ${totalCredit.toFixed(2)}.`);
  }
  return { totalDebit, totalCredit };
};

const assertDirectPostingAllowed = async (lines, orgId) => {
  const accounts = await matrixSales.entities.Account.filter({ organization_id: orgId });
  const accountMap = new Map(accounts.map((account) => [account.account_code, account]));

  lines.forEach((line) => {
    const account = accountMap.get(line.account_code);
    if (!account) throw new Error(`Account ${line.account_code} does not exist.`);
    if (account.is_header || account.allow_direct_posting === false) {
      throw new Error(`Posting is not allowed to header account ${line.account_code}.`);
    }
    if (account.cost_center_required && !line.cost_center) {
      throw new Error(`Cost center is required for account ${line.account_code}.`);
    }
  });
};

const assertOpenPeriod = async (entryDate, orgId) => {
  const period = periodFromDate(entryDate);
  const periods = await matrixSales.entities.AccountingPeriod.filter({ period, organization_id: orgId });
  const accountingPeriod = periods[0];
  if (!accountingPeriod || accountingPeriod.status !== "open") {
    throw new Error(`Accounting period ${period} is not open.`);
  }
  return period;
};

export async function postJournalEntry({
  lines,
  referenceType = "",
  referenceId = "",
  description = "",
  entryDate = new Date().toISOString().slice(0, 10),
  entryType = "adjustment",
  createdBy = "",
  orgId
}) {
  if (!orgId) throw new Error("Organization is required to post a journal entry.");
  if (!Array.isArray(lines) || lines.length < 2) throw new Error("Journal entry requires at least two lines.");

  await assertDirectPostingAllowed(lines, orgId);
  const { totalDebit, totalCredit } = assertBalanced(lines);
  const period = await assertOpenPeriod(entryDate, orgId);
  const journalNumber = await getNextDocumentNumber("JE");
  const now = new Date().toISOString();

  const journalEntry = await matrixSales.entities.JournalEntry.create({
    journal_number: journalNumber,
    entry_date: entryDate,
    entry_type: entryType,
    reference_type: referenceType,
    reference_id: referenceId,
    description,
    status: "posted",
    total_debit: totalDebit,
    total_credit: totalCredit,
    period,
    created_by: createdBy,
    posted_by: createdBy,
    posted_at: now,
    organization_id: orgId
  });

  await Promise.all(lines.map((line, index) => matrixSales.entities.JournalLine.create({
    journal_number: journalNumber,
    line_number: index + 1,
    account_code: line.account_code,
    account_name: line.account_name,
    debit: money(line.debit),
    credit: money(line.credit),
    description: line.description || description,
    cost_center: line.cost_center || "",
    vat_code: line.vat_code || "",
    currency: line.currency || "SAR",
    organization_id: orgId
  })));

  await logAuditTrail({
    entityType: "journal_entry",
    entityId: journalEntry.id,
    documentNumber: journalNumber,
    actionType: "post",
    afterData: journalEntry,
    severity: "info"
  });

  return journalEntry;
}

export async function reverseJournalEntry(originalJeNumber, reversalDate, reversedBy) {
  const originals = await matrixSales.entities.JournalEntry.filter({ journal_number: originalJeNumber });
  const original = originals[0];
  if (!original) throw new Error(`Journal entry ${originalJeNumber} was not found.`);
  if (original.status !== "posted") throw new Error("Only posted journal entries can be reversed.");

  const originalLines = await matrixSales.entities.JournalLine.filter({ journal_number: originalJeNumber });
  const reversal = await postJournalEntry({
    lines: originalLines.map((line) => ({
      account_code: line.account_code,
      account_name: line.account_name,
      debit: line.credit,
      credit: line.debit,
      description: `Reversal: ${line.description || original.description || originalJeNumber}`,
      cost_center: line.cost_center,
      vat_code: line.vat_code,
      currency: line.currency
    })),
    referenceType: "reversal",
    referenceId: originalJeNumber,
    description: `Reversal: ${original.description || originalJeNumber}`,
    entryDate: reversalDate,
    entryType: "reversal",
    createdBy: reversedBy,
    orgId: original.organization_id
  });

  await matrixSales.entities.JournalEntry.update(original.id, {
    ...original,
    status: "reversed",
    reversal_of: reversal.journal_number
  });

  await logAuditTrail({
    entityType: "journal_entry",
    entityId: original.id,
    documentNumber: originalJeNumber,
    actionType: "reverse",
    beforeData: original,
    afterData: { ...original, status: "reversed", reversal_of: reversal.journal_number },
    severity: "warning"
  });

  return reversal;
}
