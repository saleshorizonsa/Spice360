import React, { useMemo, useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Undo2 } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { reverseGoodsReceipt, rollbackPurchaseOrderReceipt, assertGoodsReceiptReversible } from "../utils/inventoryIntegration";
import { reverseJournalEntriesForDocument, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import { findBlockingVendorInvoices } from "@/lib/grnReversal";

/**
 * Reverse a GRN after it has been posted to stock: take the goods back out, post
 * the mirror Inventory/GRNI journal, roll the quantity off the PO and mark the GRN
 * reversed with a required reason.
 *
 * Guarded: blocked if a non-cancelled vendor invoice still references the GRN
 * (reverse the invoice first), if the GRN was never posted to stock, if it is
 * already reversed, or if the goods have since been issued (assertGoodsReceiptReversible).
 * All postings use the original GRN date, so they land in the same period.
 */
export default function ReverseGRNDialog({ grn, onClose }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentOrg } = useOrganization();
    const [reason, setReason] = useState("");

    const { data: vendorInvoices = [] } = useQuery({
        queryKey: ["vendorInvoices"],
        queryFn: () => matrixSales.entities.VendorInvoice.list(),
        initialData: [],
    });

    const blockingInvoices = useMemo(
        () => findBlockingVendorInvoices(grn?.grn_number, vendorInvoices),
        [grn, vendorInvoices]
    );

    const alreadyReversed = String(grn?.status || "").toLowerCase() === "reversed";
    const notPosted = !grn?.stock_posted;
    const blocked = blockingInvoices.length > 0 || alreadyReversed || notPosted;

    const reverseMutation = useMutation({
        mutationFn: async () => {
            const reversalDate = grn.grn_date;

            // 1. Period must be open before anything moves.
            if (currentOrg?.id) {
                await assertPeriodAllowed(reversalDate, currentOrg.id, "inventory");
            }

            // 2. Confirm the goods are still on hand (not issued/consumed) BEFORE the
            //    GL is reversed — otherwise the ledger would reverse while stock stands.
            await assertGoodsReceiptReversible(grn);

            // 3. Reverse the Inventory/GRNI journal (mirror; idempotent).
            await reverseJournalEntriesForDocument({
                referenceType: "grn",
                referenceId: grn.grn_number,
                reversalDate,
                reversedBy: "",
                orgId: currentOrg?.id,
            });

            // 4. Take the goods back out of stock, then roll the receipt off the PO.
            await reverseGoodsReceipt(grn, null, reversalDate);
            await rollbackPurchaseOrderReceipt(grn);

            // 5. Mark the GRN reversed and record the reason.
            await matrixSales.entities.GoodsReceiptNote.update(grn.id, {
                ...grn,
                status: "reversed",
                reversal_reason: reason.trim(),
                reversal_date: reversalDate,
            });

            await logAuditTrail({
                entityType: "grn",
                entityId: grn.id,
                documentNumber: grn.grn_number,
                actionType: "reverse_grn",
                beforeData: { status: grn.status },
                afterData: { status: "reversed", reversal_reason: reason.trim() },
                user: null,
                severity: "warning",
                relatedDocumentType: "purchase_order",
                relatedDocumentId: grn.po_number,
                organizationId: currentOrg?.id,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({ title: "GRN reversed", description: `${grn.grn_number}: stock returned and Inventory/GRNI reversed.` });
            onClose();
        },
        onError: (error) => {
            toast({ title: "Reversal failed", description: `${error.message || "Unknown error"}. Nothing was changed.`, variant: "destructive", duration: 15000 });
        },
    });

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Undo2 className="w-5 h-5 text-red-600" />
                        Reverse GRN {grn?.grn_number}
                    </DialogTitle>
                </DialogHeader>

                {notPosted && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        This GRN has not been posted to stock — there is nothing to reverse. Use Delete instead.
                    </div>
                )}

                {alreadyReversed && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        This GRN is already reversed.
                    </div>
                )}

                {blockingInvoices.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <div className="mb-1 flex items-center gap-2 font-semibold">
                            <AlertTriangle className="h-4 w-4 shrink-0" /> Cannot reverse — it has been invoiced
                        </div>
                        Vendor invoice{blockingInvoices.length > 1 ? "s" : ""}{" "}
                        <strong>{blockingInvoices.map(i => i.vendor_invoice_number).join(", ")}</strong>{" "}
                        still reference this GRN. Reverse or cancel the invoice first, then reverse the GRN.
                    </div>
                )}

                {!blocked && (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            This will take the goods back out of stock, post the mirror Inventory/GRNI journal, and
                            roll the received quantity off purchase order <strong>{grn.po_number || "—"}</strong>. All
                            dated <strong>{grn.grn_date}</strong>. Blocked if the goods have already been issued.
                        </div>
                        <div>
                            <Label>Reason for reversal *</Label>
                            <Textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="e.g. Goods received in error / wrong material / quality rejection"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={reverseMutation.isPending}>
                        Close
                    </Button>
                    {!blocked && (
                        <Button
                            type="button"
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => reverseMutation.mutate()}
                            disabled={reverseMutation.isPending || !reason.trim()}
                        >
                            {reverseMutation.isPending ? "Reversing…" : "Reverse GRN"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
