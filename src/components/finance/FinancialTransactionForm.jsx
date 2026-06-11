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

export default function FinancialTransactionForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: accounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list('account_code'),
        initialData: []
    });

    const [formData, setFormData] = useState({
        transaction_number: '',
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'expense',
        category: 'other',
        account_code: '',
        account_name: '',
        amount: 0,
        description: '',
        reference_number: '',
        payment_method: 'cash',
        account: '',
        status: 'pending',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleAccountSelect = (accountCode) => {
        const selectedAccount = accounts.find(a => a.account_code === accountCode);
        if (selectedAccount) {
            setFormData(prev => ({
                ...prev,
                account_code: accountCode,
                account_name: selectedAccount.account_name
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let result;
            if (item) {
                result = await matrixSales.entities.FinancialTransaction.update(item.id, data);
            } else {
                result = await matrixSales.entities.FinancialTransaction.create(data);
            }

            // Update account balance if account is selected
            if (data.account_code) {
                const account = accounts.find(a => a.account_code === data.account_code);
                if (account) {
                    const balanceChange = data.transaction_type === 'revenue' ? data.amount : -data.amount;
                    const newBalance = (account.current_balance || 0) + balanceChange;
                    await matrixSales.entities.ChartOfAccounts.update(account.id, {
                        current_balance: newBalance
                    });
                }
            }

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['chartOfAccounts'] });
            toast({
                title: "Success",
                description: `Transaction ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} transaction: ${error.message}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this financial transaction?`)) {
            saveMutation.mutate(formData);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Filter accounts based on transaction type
    const filteredAccounts = accounts.filter(acc => {
        if (formData.transaction_type === 'revenue') {
            return acc.account_type === 'revenue' && acc.status === 'active';
        } else {
            return acc.account_type === 'expense' && acc.status === 'active';
        }
    });

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Financial Transaction' : 'New Financial Transaction'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Transaction Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Transaction Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Transaction Number *</Label>
                                <Input
                                    value={formData.transaction_number}
                                    onChange={(e) => handleChange('transaction_number', e.target.value)}
                                    required
                                    placeholder="FIN-2025-001"
                                />
                            </div>
                            <div>
                                <Label>Transaction Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.transaction_date}
                                    onChange={(e) => handleChange('transaction_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Transaction Type *</Label>
                                <Select 
                                    value={formData.transaction_type} 
                                    onValueChange={(val) => handleChange('transaction_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="revenue">Revenue</SelectItem>
                                        <SelectItem value="expense">Expense</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Category *</Label>
                                <Select 
                                    value={formData.category} 
                                    onValueChange={(val) => handleChange('category', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="product_sales">Product Sales</SelectItem>
                                        <SelectItem value="raw_materials">Raw Materials</SelectItem>
                                        <SelectItem value="utilities">Utilities</SelectItem>
                                        <SelectItem value="labor">Labor</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Account Selection */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Account Posting</h3>
                        <div>
                            <Label>Chart of Account *</Label>
                            <Select 
                                value={formData.account_code} 
                                onValueChange={handleAccountSelect}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.account_code}>
                                            {acc.account_code} - {acc.account_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.account_name && `Selected: ${formData.account_name}`}
                            </p>
                        </div>
                    </div>

                    {/* Financial Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Financial Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Amount (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                    required
                                    placeholder="0.00"
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
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Account</Label>
                                <Input
                                    value={formData.account}
                                    onChange={(e) => handleChange('account', e.target.value)}
                                    placeholder="Bank account or payment account"
                                />
                            </div>
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
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Reference Number</Label>
                            <Input
                                value={formData.reference_number}
                                onChange={(e) => handleChange('reference_number', e.target.value)}
                                placeholder="Related invoice or order number"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
                        <div>
                            <Label>Description *</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                required
                                rows={2}
                                placeholder="Brief description of the transaction"
                            />
                        </div>

                        <div>
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                                placeholder="Additional notes or comments"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' Transaction'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}