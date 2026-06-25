import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { DollarSign, Building2, CheckCircle2, AlertTriangle } from "lucide-react";
import { postJournalEntry } from "../utils/journalService";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useOrganization } from "../utils/OrganizationContext";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { stepAccrual } from "./cinnamonUtils";

export default function CinnamonAccrualClearingDialog({ batch, onClose }) {
    const queryClient  = useQueryClient();
    const { toast }    = useToast();
    const { currentOrg } = useOrganization();
    const gl           = useGLAccounts();

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: rawSteps = [] } = useQuery({
        queryKey: ["cinnamonProcessSteps", batch.batch_number],
        queryFn:  () => matrixSales.entities.CinnamonProcessStep.filter({ batch_number: batch.batch_number }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: clearingJEs = [], isLoading: jeLoading } = useQuery({
        queryKey: ["cinnamonAccrualClearings", batch.batch_number],
        queryFn:  () => matrixSales.entities.JournalEntry.filter({
            reference_type: "cinnamon_accrual_clearing",
            reference_id:   batch.batch_number,
        }),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    // GL journal entries that were actually posted for this batch's process steps.
    // total_debit = the debit to Inventory, which equals the credit to 2120 (balanced JE).
    const { data: stepJEs = [] } = useQuery({
        queryKey: ["cinnamonStepJEs", batch.batch_number],
        queryFn:  () => matrixSales.entities.JournalEntry.filter({ reference_type: "cinnamon_process_step" }),
        enabled:  rawSteps.length > 0,
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ["vendors"],
        queryFn:  () => matrixSales.entities.Vendor.list(),
        initialData: [],
        select: (d) => Array.isArray(d) ? d : [],
    });

    // ── Accrual arithmetic ────────────────────────────────────────────────────
    // totalAccrued: what actually hit 2120, derived from GL entries.
    // Using GL rather than step records prevents over-clearing when a GL post silently failed.
    const totalAccrued = useMemo(() => {
        const stepIdSet = new Set(rawSteps.map((s) => String(s.id)));
        return stepJEs
            .filter((je) => stepIdSet.has(String(je.reference_id)))
            .reduce((sum, je) => sum + (parseFloat(je.total_debit) || 0), 0);
    }, [stepJEs, rawSteps]);

    // totalExpected: what step records say should have been accrued (informational only).
    const totalExpected = useMemo(
        () => rawSteps.reduce((sum, s) => sum + stepAccrual(s), 0),
        [rawSteps]
    );

    const glMismatch = totalExpected > 0.005 && Math.abs(totalAccrued - totalExpected) > 0.5;

    const totalCleared = useMemo(
        () => clearingJEs.reduce((sum, je) => sum + (parseFloat(je.total_debit) || 0), 0),
        [clearingJEs]
    );

    const outstanding = Math.max(0, totalAccrued - totalCleared);

    // ── Form state ────────────────────────────────────────────────────────────
    const [clearingType,        setClearingType]        = useState("cash");
    const [amount,              setAmount]              = useState("");
    const [date,                setDate]                = useState(new Date().toISOString().slice(0, 10));
    const [description,         setDescription]         = useState(
        `Processing cost accrual clearing – batch ${batch.batch_number}`
    );
    const [vendorCode,          setVendorCode]          = useState("");
    const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");

    const clearAmount    = parseFloat(amount) || 0;
    const selectedVendor = vendors.find((v) => v.vendor_code === vendorCode);
    const isOverClear    = clearAmount > outstanding + 0.005;
    const isValid        = clearAmount > 0 && !isOverClear && !!date &&
        (clearingType === "cash" || (clearingType === "ap" && !!vendorCode));

    // ── Mutation ──────────────────────────────────────────────────────────────
    const clearMutation = useMutation({
        mutationFn: async () => {
            if (!currentOrg?.id) throw new Error("Organisation not loaded");
            if (clearAmount <= 0)  throw new Error("Amount must be greater than zero");
            if (isOverClear)       throw new Error(
                `Amount LKR ${clearAmount.toFixed(2)} exceeds outstanding balance of LKR ${outstanding.toFixed(2)}. ` +
                "Cannot over-clear – posting would drive account 2120 into a debit balance."
            );

            if (clearingType === "cash") {
                // ── Cash path: DR 2120 / CR 1010 ──────────────────────────────
                await postJournalEntry({
                    lines: [
                        { account_code: gl.accrued_mfg_costs, account_name: "Accrued Manufacturing Costs", debit: clearAmount, credit: 0 },
                        { account_code: gl.cash_bank,          account_name: "Cash / Bank",                  debit: 0,          credit: clearAmount },
                    ],
                    referenceType: "cinnamon_accrual_clearing",
                    referenceId:   batch.batch_number,
                    description:   description,
                    entryDate:     date,
                    entryType:     "payment",
                    orgId:         currentOrg.id,
                    area:          "ap",
                });
            } else {
                // ── AP path: DR 2120 / CR 2100 (clears accrual, creates payable) ──
                // AP record is created BEFORE the JE so that a JE failure leaves
                // a visible AP (recoverable) rather than a committed JE with no AP.
                const apNumber = await getNextDocumentNumber("AP");

                await matrixSales.entities.AccountsPayable.create({
                    ap_number:             apNumber,
                    vendor_invoice_number: vendorInvoiceNumber || apNumber,
                    vendor_code:           vendorCode,
                    vendor_name:           selectedVendor?.vendor_name || vendorCode,
                    invoice_date:          date,
                    due_date:              date,
                    invoice_amount:        clearAmount,
                    paid_amount:           0,
                    outstanding_amount:    clearAmount,
                    payment_terms:         selectedVendor?.payment_terms || "net_30",
                    aging_days:            0,
                    aging_bucket:          "current",
                    payment_status:        "pending",
                    currency:              "LKR",
                    notes:                 description,
                    organization_id:       currentOrg.id,
                });

                await postJournalEntry({
                    lines: [
                        { account_code: gl.accrued_mfg_costs, account_name: "Accrued Manufacturing Costs", debit: clearAmount, credit: 0 },
                        { account_code: gl.trade_payables,     account_name: "Trade Payables",              debit: 0,          credit: clearAmount },
                    ],
                    referenceType: "cinnamon_accrual_clearing",
                    referenceId:   batch.batch_number,
                    description:   description,
                    entryDate:     date,
                    entryType:     "invoice",
                    orgId:         currentOrg.id,
                    area:          "ap",
                });
            }
        },
        onSuccess: () => {
            // Invalidate both the per-batch key (this dialog) and the unfiltered key
            // (CinnamonProcessing page KPI card and batch badge column).
            queryClient.invalidateQueries({ queryKey: ["cinnamonAccrualClearings", batch.batch_number] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonAccrualClearings"] });
            queryClient.invalidateQueries({ queryKey: ["cinnamonStepJEs", batch.batch_number] });
            queryClient.invalidateQueries({ queryKey: ["journalEntries"] });
            queryClient.invalidateQueries({ queryKey: ["journals"] });
            queryClient.invalidateQueries({ queryKey: ["ap"] });
            toast({ title: "Accrual cleared", description: "Journal entry posted successfully" });
            setAmount("");
            setVendorCode("");
            setVendorInvoiceNumber("");
            setDescription(`Processing cost accrual clearing – batch ${batch.batch_number}`);
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-amber-600" />
                        Clear Processing Cost Accruals — {batch.batch_number}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">

                    {/* ── Balance summary ─────────────────────────────────────── */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                            <p className="text-xs text-orange-600 font-medium">Accrued to 2120 (GL)</p>
                            <p className="text-lg font-bold text-orange-800">LKR {totalAccrued.toFixed(2)}</p>
                            {glMismatch && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                    Expected {totalExpected.toFixed(2)}
                                </p>
                            )}
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                            <p className="text-xs text-green-600 font-medium">Cleared (Dr 2120)</p>
                            <p className="text-lg font-bold text-green-800">LKR {totalCleared.toFixed(2)}</p>
                        </div>
                        <div className={`${outstanding > 0.005 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"} border rounded-lg p-3 text-center`}>
                            <p className={`text-xs font-medium ${outstanding > 0.005 ? "text-red-600" : "text-emerald-600"}`}>Outstanding</p>
                            <p className={`text-lg font-bold ${outstanding > 0.005 ? "text-red-800" : "text-emerald-800"}`}>
                                LKR {outstanding.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* ── GL / step mismatch warning ──────────────────────────── */}
                    {glMismatch && (
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <AlertDescription className="text-amber-700 text-sm">
                                GL shows LKR {totalAccrued.toFixed(2)} posted to account 2120, but step records
                                total LKR {totalExpected.toFixed(2)}. One or more processing cost GL entries may
                                have failed silently. Check Finance → Journal Entries for reference type
                                "cinnamon_process_step".
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* ── Step breakdown ──────────────────────────────────────── */}
                    {rawSteps.filter((s) => stepAccrual(s) > 0).length > 0 && (
                        <div className="bg-slate-50 rounded-lg border p-3">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Accrual Breakdown by Processing Step (from step records)</p>
                            <div className="space-y-1">
                                {rawSteps
                                    .filter((s) => stepAccrual(s) > 0)
                                    .map((s) => (
                                        <div key={s.id} className="flex justify-between text-xs text-slate-700">
                                            <span className="capitalize">
                                                {s.stage.replace(/_/g, " ")}{" "}
                                                <span className="text-slate-400">
                                                    {s.completed_at?.slice(0, 10) || s.started_at?.slice(0, 10) || "—"}
                                                </span>
                                            </span>
                                            <span className="font-medium">LKR {stepAccrual(s).toFixed(2)}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* ── Clearing history ─────────────────────────────────────── */}
                    {!jeLoading && clearingJEs.length > 0 && (
                        <div className="bg-green-50 rounded-lg border border-green-200 p-3">
                            <p className="text-xs font-semibold text-green-700 mb-2">Clearing History</p>
                            <div className="space-y-1">
                                {clearingJEs.map((je) => (
                                    <div key={je.id} className="flex justify-between text-xs text-green-800">
                                        <span>
                                            {je.journal_number} · {je.entry_date} ·{" "}
                                            <span className="italic">{je.entry_type}</span>
                                        </span>
                                        <span className="font-semibold">LKR {parseFloat(je.total_debit || 0).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Fully cleared ───────────────────────────────────────── */}
                    {outstanding <= 0.005 ? (
                        <Alert className="border-emerald-200 bg-emerald-50">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <AlertDescription className="text-emerald-700 font-medium">
                                All processing costs for this batch are fully cleared.
                                Account 2120 is zero for batch {batch.batch_number}.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            {/* ── Clearing method ──────────────────────────────── */}
                            <div>
                                <Label className="text-sm font-semibold">Clearing Method</Label>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setClearingType("cash")}
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                                            clearingType === "cash"
                                                ? "border-emerald-500 bg-emerald-50"
                                                : "border-gray-200 hover:border-gray-300 bg-white"
                                        }`}
                                    >
                                        <DollarSign className={`w-5 h-5 flex-shrink-0 ${clearingType === "cash" ? "text-emerald-600" : "text-gray-400"}`} />
                                        <div>
                                            <p className="font-medium text-sm">Cash Payment</p>
                                            <p className="text-xs text-gray-500">DR 2120 / CR Cash (1010)</p>
                                            <p className="text-xs text-gray-400">Casual/day labour, petty cash</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setClearingType("ap")}
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                                            clearingType === "ap"
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:border-gray-300 bg-white"
                                        }`}
                                    >
                                        <Building2 className={`w-5 h-5 flex-shrink-0 ${clearingType === "ap" ? "text-blue-600" : "text-gray-400"}`} />
                                        <div>
                                            <p className="font-medium text-sm">Vendor Invoice (AP)</p>
                                            <p className="text-xs text-gray-500">DR 2120 / CR AP (2100)</p>
                                            <p className="text-xs text-gray-400">Contractors, utilities, transport</p>
                                        </div>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    {clearingType === "ap"
                                        ? "A payable is created in Finance → AP. Pay it there (DR 2100 / CR Cash) — no second expense will be booked."
                                        : "Posts a journal entry immediately. No AP record is created."}
                                </p>
                            </div>

                            {/* ── AP vendor fields ─────────────────────────────── */}
                            {clearingType === "ap" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Vendor *</Label>
                                        <Select value={vendorCode} onValueChange={setVendorCode}>
                                            <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                                            <SelectContent>
                                                {vendors.map((v) => (
                                                    <SelectItem key={v.id} value={v.vendor_code}>
                                                        {v.vendor_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Vendor Invoice Number</Label>
                                        <Input
                                            value={vendorInvoiceNumber}
                                            onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                                            placeholder="e.g. INV-2025-001"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── Amount + date ────────────────────────────────── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Amount (LKR) *</Label>
                                    <Input
                                        type="number" step="0.01" min="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder={`Max ${outstanding.toFixed(2)}`}
                                        className={isOverClear ? "border-red-400 focus-visible:ring-red-400" : ""}
                                    />
                                    {isOverClear && (
                                        <p className="text-xs text-red-600 mt-1">
                                            Exceeds outstanding LKR {outstanding.toFixed(2)} — posting blocked
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Date *</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Description</Label>
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. Payment to contractor for cutting labour"
                                />
                            </div>

                            {/* ── Actions ─────────────────────────────────────── */}
                            <div className="flex justify-end gap-3 pt-2 border-t">
                                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                                <Button
                                    className={clearingType === "cash"
                                        ? "bg-emerald-600 hover:bg-emerald-700"
                                        : "bg-blue-600 hover:bg-blue-700"}
                                    disabled={!isValid || clearMutation.isPending}
                                    onClick={() => clearMutation.mutate()}
                                >
                                    {clearingType === "cash" ? (
                                        <><DollarSign className="w-4 h-4 mr-2" />Post Cash Clearing</>
                                    ) : (
                                        <><Building2 className="w-4 h-4 mr-2" />Create AP & Clear Accrual</>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
}
