import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function PaymentForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: () => base44.entities.BankAccount.list(),
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
        currency: 'SAR',
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
                return base44.entities.Payment.update(item.id, data);
            }
            return base44.entities.Payment.create(data);
        },
        onSuccess: () => {
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
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
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
                            <Label>Amount (SAR) *</Label>
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

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Payment
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}