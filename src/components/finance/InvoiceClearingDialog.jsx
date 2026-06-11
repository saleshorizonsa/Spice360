import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, AlertCircle, DollarSign, Receipt } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InvoiceClearingDialog({ open, onClose }) {
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [selectedInvoices, setSelectedInvoices] = useState({});
    const [allocations, setAllocations] = useState({});
    const [remainingAmount, setRemainingAmount] = useState(0);

    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    const { data: allAR = [] } = useQuery({
        queryKey: ['ar'],
        queryFn: () => matrixSales.entities.AccountsReceivable.list(),
        initialData: []
    });

    // Filter open invoices for selected customer
    const openInvoices = allAR.filter(ar => 
        ar.customer_code === selectedCustomer && 
        ['open', 'partially_paid', 'overdue'].includes(ar.status) &&
        ar.outstanding_amount > 0
    ).sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));

    // Calculate remaining amount
    useEffect(() => {
        const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        setRemainingAmount(paymentAmount - totalAllocated);
    }, [allocations, paymentAmount]);

    const clearingMutation = useMutation({
        mutationFn: async (data) => {
            const user = await matrixSales.auth.me();
            const paymentNumber = `PMT-${Date.now()}`;
            const clearingRef = `CLR-${Date.now()}`;

            // Create payment record
            await matrixSales.entities.Payment.create({
                payment_number: paymentNumber,
                payment_type: 'incoming',
                payment_date: data.paymentDate,
                reference_number: data.referenceNumber,
                party_code: data.customerCode,
                party_name: data.customerName,
                amount: data.paymentAmount,
                currency: 'LKR',
                payment_method: data.paymentMethod,
                status: 'cleared',
                cleared_date: data.paymentDate,
                notes: `Invoice clearing: ${data.allocations.length} invoice(s) allocated`
            });

            // Create allocation records and update AR
            for (const allocation of data.allocations) {
                // Create payment allocation
                await matrixSales.entities.PaymentAllocation.create({
                    allocation_id: `ALLOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    payment_number: paymentNumber,
                    ar_number: allocation.ar_number,
                    invoice_number: allocation.invoice_number,
                    customer_code: data.customerCode,
                    customer_name: data.customerName,
                    invoice_amount: allocation.invoice_amount,
                    allocated_amount: allocation.allocated_amount,
                    allocation_date: data.paymentDate,
                    allocation_type: allocation.allocated_amount >= allocation.outstanding_amount ? 'full_clearing' : 'partial_clearing',
                    clearing_reference: clearingRef,
                    posted_by: user.email,
                    notes: `Allocated LKR ${allocation.allocated_amount.toFixed(2)} from payment ${paymentNumber}`
                });

                // Update AR record
                const newPaidAmount = allocation.current_paid_amount + allocation.allocated_amount;
                const newOutstanding = allocation.invoice_amount - newPaidAmount;
                let newStatus = 'open';
                if (newOutstanding <= 0) {
                    newStatus = 'paid';
                } else if (newPaidAmount > 0) {
                    newStatus = 'partially_paid';
                }

                await matrixSales.entities.AccountsReceivable.update(allocation.ar_id, {
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus
                });
            }

            return { paymentNumber, clearingRef };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['ar'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['paymentAllocations'] });
            toast({
                title: "Payment Cleared Successfully",
                description: `Payment ${result.paymentNumber} posted and allocated to ${Object.keys(selectedInvoices).length} invoice(s)`,
                variant: "default"
            });
            handleReset();
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Clearing Failed",
                description: error.message || "Failed to process payment clearing",
                variant: "destructive"
            });
        }
    });

    const handleCustomerChange = (customerCode) => {
        setSelectedCustomer(customerCode);
        setSelectedInvoices({});
        setAllocations({});
    };

    const handleInvoiceToggle = (invoice) => {
        const isSelected = selectedInvoices[invoice.id];
        const newSelected = { ...selectedInvoices };
        const newAllocations = { ...allocations };

        if (isSelected) {
            delete newSelected[invoice.id];
            delete newAllocations[invoice.id];
        } else {
            newSelected[invoice.id] = true;
            newAllocations[invoice.id] = 0;
        }

        setSelectedInvoices(newSelected);
        setAllocations(newAllocations);
    };

    const handleAllocationChange = (invoiceId, amount) => {
        const invoice = openInvoices.find(inv => inv.id === invoiceId);
        const maxAmount = Math.min(invoice.outstanding_amount, remainingAmount + (parseFloat(allocations[invoiceId]) || 0));
        const validAmount = Math.max(0, Math.min(parseFloat(amount) || 0, maxAmount));
        
        setAllocations({
            ...allocations,
            [invoiceId]: validAmount
        });
    };

    const handleAutoAllocate = () => {
        let remaining = paymentAmount;
        const newAllocations = {};

        for (const invoice of openInvoices) {
            if (selectedInvoices[invoice.id] && remaining > 0) {
                const allocated = Math.min(invoice.outstanding_amount, remaining);
                newAllocations[invoice.id] = allocated;
                remaining -= allocated;
            }
        }

        setAllocations(newAllocations);
    };

    const handleSubmit = () => {
        const customer = customers.find(c => c.customer_code === selectedCustomer);
        
        // Validate
        if (!selectedCustomer || !paymentAmount || paymentAmount <= 0) {
            toast({
                title: "Validation Error",
                description: "Please select a customer and enter a payment amount",
                variant: "destructive"
            });
            return;
        }

        const selectedCount = Object.keys(selectedInvoices).length;
        if (selectedCount === 0) {
            toast({
                title: "Validation Error",
                description: "Please select at least one invoice to clear",
                variant: "destructive"
            });
            return;
        }

        const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        if (totalAllocated > paymentAmount) {
            toast({
                title: "Validation Error",
                description: "Total allocated amount cannot exceed payment amount",
                variant: "destructive"
            });
            return;
        }

        // Prepare allocation data
        const allocationData = openInvoices
            .filter(inv => selectedInvoices[inv.id] && allocations[inv.id] > 0)
            .map(inv => ({
                ar_id: inv.id,
                ar_number: inv.ar_number,
                invoice_number: inv.invoice_number,
                invoice_amount: inv.invoice_amount,
                outstanding_amount: inv.outstanding_amount,
                current_paid_amount: inv.paid_amount,
                allocated_amount: parseFloat(allocations[inv.id])
            }));

        if (allocationData.length === 0) {
            toast({
                title: "Validation Error",
                description: "Please allocate amounts to selected invoices",
                variant: "destructive"
            });
            return;
        }

        if (window.confirm(`Post payment of LKR ${paymentAmount.toFixed(2)} and allocate to ${allocationData.length} invoice(s)?`)) {
            clearingMutation.mutate({
                customerCode: selectedCustomer,
                customerName: customer.customer_name,
                paymentAmount,
                paymentDate,
                paymentMethod,
                referenceNumber,
                allocations: allocationData
            });
        }
    };

    const handleReset = () => {
        setSelectedCustomer('');
        setPaymentAmount(0);
        setPaymentMethod('bank_transfer');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setReferenceNumber('');
        setSelectedInvoices({});
        setAllocations({});
    };

    const totalSelected = Object.keys(selectedInvoices).length;
    const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Receipt className="w-6 h-6 text-emerald-600" />
                        Invoice Clearing (F-28)
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Payment Header */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Payment Details
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Customer *</Label>
                                <Select value={selectedCustomer} onValueChange={handleCustomerChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => (
                                            <SelectItem key={c.id} value={c.customer_code}>
                                                {c.customer_code} - {c.customer_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Payment Amount (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <Label>Payment Date *</Label>
                                <Input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Payment Method *</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="check">Check</SelectItem>
                                        <SelectItem value="credit_card">Credit Card</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2">
                                <Label>Reference Number</Label>
                                <Input
                                    value={referenceNumber}
                                    onChange={(e) => setReferenceNumber(e.target.value)}
                                    placeholder="Bank reference or check number"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Open Items */}
                    {selectedCustomer && (
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    Open Items ({openInvoices.length})
                                </h3>
                                {totalSelected > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAutoAllocate}
                                        className="gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Auto-Allocate
                                    </Button>
                                )}
                            </div>

                            {openInvoices.length === 0 ? (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        No open invoices found for this customer
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead className="w-12"></TableHead>
                                                <TableHead>Invoice Number</TableHead>
                                                <TableHead>Invoice Date</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead className="text-right">Invoice Amount</TableHead>
                                                <TableHead className="text-right">Paid</TableHead>
                                                <TableHead className="text-right">Outstanding</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Amount to Clear</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {openInvoices.map(invoice => (
                                                <TableRow 
                                                    key={invoice.id}
                                                    className={selectedInvoices[invoice.id] ? 'bg-emerald-50' : ''}
                                                >
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedInvoices[invoice.id] || false}
                                                            onCheckedChange={() => handleInvoiceToggle(invoice)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {invoice.invoice_number}
                                                    </TableCell>
                                                    <TableCell>{invoice.invoice_date}</TableCell>
                                                    <TableCell>{invoice.due_date}</TableCell>
                                                    <TableCell className="text-right">
                                                        {invoice.invoice_amount.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {invoice.paid_amount.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-red-600">
                                                        {invoice.outstanding_amount.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            invoice.status === 'overdue' ? 'destructive' :
                                                            invoice.status === 'partially_paid' ? 'default' : 'secondary'
                                                        }>
                                                            {invoice.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {selectedInvoices[invoice.id] ? (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={allocations[invoice.id] || 0}
                                                                onChange={(e) => handleAllocationChange(invoice.id, e.target.value)}
                                                                className="w-32 text-right"
                                                                placeholder="0.00"
                                                            />
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </>
                    )}

                    {/* Summary */}
                    {selectedCustomer && totalSelected > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Payment Amount:</span>
                                <span className="font-semibold">LKR {paymentAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Allocated:</span>
                                <span className="font-semibold text-emerald-600">LKR {totalAllocated.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Remaining Amount:</span>
                                <span className={`font-semibold ${remainingAmount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                    LKR {remainingAmount.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t">
                                <span className="text-gray-600">Selected Invoices:</span>
                                <span className="font-semibold">{totalSelected}</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="button" variant="outline" onClick={handleReset}>
                            Reset
                        </Button>
                        <Button 
                            onClick={handleSubmit}
                            disabled={!selectedCustomer || totalSelected === 0 || totalAllocated === 0}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Post & Clear ({totalSelected})
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}