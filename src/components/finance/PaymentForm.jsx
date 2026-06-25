import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import ReverseButton from "../shared/ReverseButton";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

export default function PaymentForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);

    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: () => matrixSales.entities.BankAccount.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        payment_number: '',
        payment_type: 'outgoing',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        party_code: '',
        party_name: '',
        amount: 0,
        currency: 'LKR',
        payment_method: 'bank_transfer',
        bank_account: '',
        check_number: '',
        transaction_id: '',
        status: 'pending',
        cleared_date: '',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Payment.update(item.id, data);
            }
            return matrixSales.entities.Payment.create(data);
        },
        onSuccess: async (savedPayment) => {
            if (savedPayment?.status === 'cleared' && !savedPayment.gl_posted) {
                try {
                    const isIncoming = savedPayment.payment_type === 'incoming';
                    await postJournalEntry({
                        lines: isIncoming
                            ? [
                                { account_code: gl.cash_bank,       account_name: 'Cash & Bank',       debit: savedPayment.amount, credit: 0 },
                                { account_code: gl.ar_receivables,  account_name: 'Trade Receivables', debit: 0, credit: savedPayment.amount }
                            ]
                            : [
                                { account_code: gl.trade_payables, account_name: 'Trade Payables', debit: savedPayment.amount, credit: 0 },
                                { account_code: gl.cash_bank,      account_name: 'Cash & Bank',    debit: 0, credit: savedPayment.amount }
                            ],
                        referenceType: isIncoming ? 'customer_payment' : 'vendor_payment',
                        referenceId: savedPayment.payment_number,
                        description: `Payment ${savedPayment.payment_number}`,
                        entryDate: savedPayment.payment_date,
                        entryType: 'payment',
                        orgId: currentOrg?.id,
                        area: isIncoming ? "ar" : "ap"
                    });
                    await matrixSales.entities.Payment.update(savedPayment.id, { ...savedPayment, gl_posted: true });
                } catch (error) {
                    toast({ title: "Payment saved but GL posting failed", description: error.message, variant: "destructive" });
                }
            }

            // Reduce AP outstanding balance when outgoing vendor payment clears
            if (savedPayment?.status === 'cleared' && savedPayment.payment_type === 'outgoing' && savedPayment.party_code) {
                try {
                    let apRecords = [];
                    if (savedPayment.reference_number) {
                        apRecords = await matrixSales.entities.AccountsPayable.filter({
                            vendor_code:           savedPayment.party_code,
                            vendor_invoice_number: savedPayment.reference_number,
                        });
                    }
                    if (apRecords.length === 0) {
                        const allPending = await matrixSales.entities.AccountsPayable.filter({
                            vendor_code:    savedPayment.party_code,
                            payment_status: 'pending',
                        });
                        apRecords = allPending.sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));
                    }

                    let remaining = parseFloat(savedPayment.amount) || 0;
                    const nowPaidAPs = [];
                    for (const ap of apRecords) {
                        if (remaining <= 0.001) break;
                        const outstanding    = parseFloat(ap.outstanding_amount) || 0;
                        if (outstanding <= 0.001) continue;
                        const applied        = Math.min(remaining, outstanding);
                        const newOutstanding = Math.max(0, outstanding - applied);
                        const newPaid        = (parseFloat(ap.paid_amount) || 0) + applied;
                        await matrixSales.entities.AccountsPayable.update(ap.id, {
                            ...ap,
                            paid_amount:        newPaid,
                            outstanding_amount: newOutstanding,
                            payment_status:     newOutstanding <= 0.01 ? 'paid' : 'partial',
                        });
                        if (newOutstanding <= 0.01) nowPaidAPs.push(ap);
                        remaining -= applied;
                    }
                    queryClient.invalidateQueries({ queryKey: ['ap'] });

                    // G6: close linked PO when AP is fully paid
                    for (const ap of nowPaidAPs) {
                        try {
                            if (ap.vendor_invoice_number) {
                                const vis = await matrixSales.entities.VendorInvoice.filter({ invoice_number: ap.vendor_invoice_number });
                                if (vis?.[0]?.po_number) {
                                    const pos = await matrixSales.entities.PurchaseOrder.filter({ po_number: vis[0].po_number });
                                    if (pos?.[0] && !['closed', 'cancelled'].includes(pos[0].status)) {
                                        await matrixSales.entities.PurchaseOrder.update(pos[0].id, { ...pos[0], status: 'closed' });
                                        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
                                    }
                                }
                            }
                        } catch (_) { /* non-fatal */ }
                    }
                } catch (_) {
                    // Non-fatal — payment recorded; AP update is best-effort
                }
            }

            // Reduce AR outstanding balance when incoming customer payment clears
            if (savedPayment?.status === 'cleared' && savedPayment.payment_type === 'incoming' && savedPayment.party_code) {
                try {
                    let arRecords = [];
                    if (savedPayment.reference_number) {
                        arRecords = await matrixSales.entities.AccountsReceivable.filter({
                            customer_code:  savedPayment.party_code,
                            invoice_number: savedPayment.reference_number,
                        });
                    }
                    if (arRecords.length === 0) {
                        const allOpen = await matrixSales.entities.AccountsReceivable.filter({
                            customer_code: savedPayment.party_code,
                            status:        'open',
                        });
                        arRecords = allOpen.sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));
                    }
                    let remaining = parseFloat(savedPayment.amount) || 0;
                    const nowClosedARs = [];
                    for (const ar of arRecords) {
                        if (remaining <= 0.001) break;
                        const outstanding    = parseFloat(ar.outstanding_amount) || 0;
                        if (outstanding <= 0.001) continue;
                        const applied        = Math.min(remaining, outstanding);
                        const newOutstanding = Math.max(0, outstanding - applied);
                        const newPaid        = (parseFloat(ar.paid_amount) || 0) + applied;
                        await matrixSales.entities.AccountsReceivable.update(ar.id, {
                            ...ar,
                            paid_amount:        newPaid,
                            outstanding_amount: newOutstanding,
                            status:             newOutstanding <= 0.01 ? 'closed' : ar.status,
                        });
                        if (newOutstanding <= 0.01) nowClosedARs.push(ar);
                        remaining -= applied;
                    }
                    queryClient.invalidateQueries({ queryKey: ['ar'] });

                    // G5: mark linked SalesOrder as completed when AR is fully paid
                    for (const ar of nowClosedARs) {
                        try {
                            if (ar.invoice_number) {
                                const invs = await matrixSales.entities.Invoice.filter({ invoice_number: ar.invoice_number });
                                if (invs?.[0]) {
                                    // Mark invoice as paid
                                    if (invs[0].payment_status !== 'paid') {
                                        await matrixSales.entities.Invoice.update(invs[0].id, {
                                            ...invs[0],
                                            payment_status: 'paid',
                                        });
                                        queryClient.invalidateQueries({ queryKey: ['invoices'] });
                                    }
                                    // Complete linked SO
                                    if (invs[0].sales_order_number) {
                                        const sos = await matrixSales.entities.SalesOrder.filter({ order_number: invs[0].sales_order_number });
                                        if (sos?.[0] && !['completed', 'cancelled'].includes(sos[0].status)) {
                                            await matrixSales.entities.SalesOrder.update(sos[0].id, { ...sos[0], status: 'completed' });
                                            queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
                                        }
                                    }
                                }
                            }
                        } catch (_) { /* non-fatal */ }
                    }
                } catch (_) {
                    // Non-fatal
                }
            }

            // Update bank account balance when payment clears
            if (savedPayment?.status === 'cleared' && savedPayment.bank_account) {
                try {
                    const bankList = await matrixSales.entities.BankAccount.filter({
                        account_number: savedPayment.bank_account
                    });
                    if (bankList.length > 0) {
                        const bank       = bankList[0];
                        const current    = parseFloat(bank.current_balance) || 0;
                        const amt        = parseFloat(savedPayment.amount)  || 0;
                        const isIncoming = savedPayment.payment_type === 'incoming';
                        await matrixSales.entities.BankAccount.update(bank.id, {
                            ...bank,
                            current_balance: isIncoming ? current + amt : current - amt
                        });
                        queryClient.invalidateQueries({ queryKey: ['banks'] });
                    }
                } catch (_) {
                    // Non-fatal
                }
            }

            queryClient.invalidateQueries({ queryKey: ['payments'] });
            toast({
                title: "Success",
                description: `Payment ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this payment?`)) {
            saveMutation.mutate(formData);
        }
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Payment' : 'New Payment'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payment Number *</Label>
                            <Input
                                value={formData.payment_number}
                                onChange={(e) => handleChange('payment_number', e.target.value)}
                                required
                                placeholder="PAY-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>Payment Type *</Label>
                            <Select 
                                value={formData.payment_type} 
                                onValueChange={(val) => handleChange('payment_type', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="incoming">Incoming</SelectItem>
                                    <SelectItem value="outgoing">Outgoing</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payment Date *</Label>
                            <Input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => handleChange('payment_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Reference Number</Label>
                            <Input
                                value={formData.reference_number}
                                onChange={(e) => handleChange('reference_number', e.target.value)}
                                placeholder="Invoice or document ref"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Party Code</Label>
                            <Input
                                value={formData.party_code}
                                onChange={(e) => handleChange('party_code', e.target.value)}
                                placeholder="Customer/Vendor code"
                            />
                        </div>
                        <div>
                            <Label>Party Name *</Label>
                            <Input
                                value={formData.party_name}
                                onChange={(e) => handleChange('party_name', e.target.value)}
                                required
                                placeholder="Customer/Vendor name"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Amount (LKR) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Payment Method *</Label>
                            <Select 
                                value={formData.payment_method} 
                                onValueChange={(val) => handleChange('payment_method', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="check">Check</SelectItem>
                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="credit_card">Credit Card</SelectItem>
                                    <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Bank Account</Label>
                        <Select 
                            value={formData.bank_account} 
                            onValueChange={(val) => handleChange('bank_account', val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select bank account" />
                            </SelectTrigger>
                            <SelectContent>
                                {banks.map(bank => (
                                    <SelectItem key={bank.id} value={bank.account_number}>
                                        {bank.account_name} - {bank.bank_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Check Number</Label>
                            <Input
                                value={formData.check_number}
                                onChange={(e) => handleChange('check_number', e.target.value)}
                                placeholder="If check payment"
                            />
                        </div>
                        <div>
                            <Label>Transaction ID</Label>
                            <Input
                                value={formData.transaction_id}
                                onChange={(e) => handleChange('transaction_id', e.target.value)}
                                placeholder="Bank transaction ID"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => handleChange('status', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="cleared">Cleared</SelectItem>
                                    <SelectItem value="bounced">Bounced</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Cleared Date</Label>
                            <Input
                                type="date"
                                value={formData.cleared_date}
                                onChange={(e) => handleChange('cleared_date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <ReverseButton
                            item={item}
                            entityName="Payment"
                            queryKeys={['payments']}
                            onSuccess={onClose}
                        />
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                {item ? 'Update' : 'Create'} Payment
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
