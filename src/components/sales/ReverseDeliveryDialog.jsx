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
import { reverseGoodsIssue } from "../utils/inventoryIntegration";
import { reverseJournalEntriesForDocument, assertPeriodAllowed } from "../utils/journalService";
import { logAuditTrail } from "../utils/auditTrail";
import { findBlockingInvoices } from "@/lib/deliveryReversal";

/**
 * Reverse a delivery note after PGI: put the stock back, post the mirror COGS
 * journal, free the SO quantity and mark the delivery reversed. Requires a reason.
 *
 * Guarded: blocked if a non-cancelled invoice still references the delivery (cancel
 * the invoice first), if PGI was never done, or if the delivery is already reversed.
 * All postings use the original delivery date, so they land in the same period.
 */
export default function ReverseDeliveryDialog({ delivery, onClose }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentOrganization: currentOrg } = useOrganization();
    const [reason, setReason] = useState("");

    const { data: invoices = [] } = useQuery({
        queryKey: ["invoices"],
        queryFn: () => matrixSales.entities.Invoice.list(),
        initialData: [],
    });

    const blockingInvoices = useMemo(
        () => findBlockingInvoices(delivery?.delivery_number, invoices),
        [delivery, invoices]
    );

    const alreadyReversed = String(delivery?.status || "").toLowerCase() === "reversed";
    const notPosted = !delivery?.pgi_done;
    const blocked = blockingInvoices.length > 0 || alreadyReversed || notPosted;

    const reverseMutation = useMutation({
        mutationFn: async () => {
            const reversalDate = delivery.delivery_date;

            // 1. Period must be open for the reversal's own date, before anything moves.
            if (currentOrg?.id) {
                await assertPeriodAllowed(reversalDate, currentOrg.id, "inventory");
            }

            // 2. Reverse the COGS journal FIRST (idempotent — only posted entries),
            //    so a later failure cannot leave the GL reversed while stock stands.
            await reverseJournalEntriesForDocument({
                referenceType: "delivery",
                referenceId: delivery.delivery_number,
                reversalDate,
                reversedBy: "",
                orgId: currentOrg?.id,
            });

            // 3. Put the issued stock back at its issue cost.
            await reverseGoodsIssue(delivery, null, reversalDate);

            // 4. Mark the delivery reversed and record the reason.
            await matrixSales.entities.Delivery.update(delivery.id, {
                ...delivery,
                status: "reversed",
                reversal_reason: reason.trim(),
                reversal_date: reversalDate,
            });

            // 5. Give the delivered quantity back to the Sales Order.
            if (delivery.sales_order_number) {
                const sos = await matrixSales.entities.SalesOrder.filter({ order_number: delivery.sales_order_number });
                if (sos?.length) {
                    const so = sos[0];
                    const back = parseFloat(delivery.quantity_delivered) || 0;
                    const newDelivered = Math.max(0, (parseFloat(so.quantity_delivered) || 0) - back);
                    const ordered = parseFloat(so.quantity) || 0;
                    const status = newDelivered >= ordered && ordered > 0 ? "delivered"
                        : newDelivered > 0 ? "partially_delivered"
                        : "confirmed";
                    await matrixSales.entities.SalesOrder.update(so.id, { quantity_delivered: newDelivered, status });
                }
            }

            await logAuditTrail({
                entityType: "delivery",
                entityId: delivery.id,
                documentNumber: delivery.delivery_number,
                actionType: "reverse_pgi",
                beforeData: { status: delivery.status },
                afterData: { status: "reversed", reversal_reason: reason.trim() },
                user: null,
                severity: "warning",
                organizationId: currentOrg?.id,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({ title: "Delivery reversed", description: `${delivery.delivery_number}: stock returned and COGS reversed.` });
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
                        Reverse Delivery {delivery?.delivery_number}
                    </DialogTitle>
                </DialogHeader>

                {notPosted && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        This delivery has not been posted (PGI) yet — there is nothing to reverse. Use Delete instead.
                    </div>
                )}

                {alreadyReversed && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        This delivery is already reversed.
                    </div>
                )}

                {blockingInvoices.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <div className="mb-1 flex items-center gap-2 font-semibold">
                            <AlertTriangle className="h-4 w-4 shrink-0" /> Cannot reverse — it has been invoiced
                        </div>
                        Invoice{blockingInvoices.length > 1 ? "s" : ""}{" "}
                        <strong>{blockingInvoices.map(i => i.invoice_number).join(", ")}</strong>{" "}
                        still reference this delivery. Cancel or reverse the invoice first, then reverse the delivery.
                    </div>
                )}

                {!blocked && (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            This will put the issued stock back, post the mirror COGS journal, and return the quantity
                            to sales order <strong>{delivery.sales_order_number || "—"}</strong>. All dated{" "}
                            <strong>{delivery.delivery_date}</strong>.
                        </div>
                        <div>
                            <Label>Reason for reversal *</Label>
                            <Textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="e.g. Wrong quantity shipped / customer rejected the goods"
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
                            {reverseMutation.isPending ? "Reversing…" : "Reverse Delivery"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
