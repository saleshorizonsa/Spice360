import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

export default function GLZakatMappingForm({ item, accounts, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [formData, setFormData] = useState(item || {});
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [bulkUpdate, setBulkUpdate] = useState(!item);

    const updateMutation = useMutation({
        mutationFn: async (data) => {
            if (bulkUpdate && selectedAccounts.length > 0) {
                const promises = selectedAccounts.map(accountId => {
                    const account = accounts.find(a => a.id === accountId);
                    return base44.entities.ChartOfAccounts.update(accountId, {
                        zakat_category: data.zakat_category,
                        zakat_subcategory: data.zakat_subcategory,
                        is_related_party_account: data.is_related_party_account
                    });
                });
                return Promise.all(promises);
            } else {
                return base44.entities.ChartOfAccounts.update(item.id, data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['chartOfAccounts']);
            toast({
                title: "Success",
                description: bulkUpdate 
                    ? `Updated ${selectedAccounts.length} accounts successfully`
                    : "Account mapping updated successfully"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    const handleSelectAccount = (accountId, checked) => {
        if (checked) {
            setSelectedAccounts(prev => [...prev, accountId]);
        } else {
            setSelectedAccounts(prev => prev.filter(id => id !== accountId));
        }
    };

    const zakatCategories = [
        { value: "zakatable_asset", label: "Zakatable Asset" },
        { value: "non_zakatable_asset", label: "Non-Zakatable Asset" },
        { value: "deductible_liability", label: "Deductible Liability" },
        { value: "non_deductible_liability", label: "Non-Deductible Liability" },
        { value: "add_back", label: "Add-back" },
        { value: "allowed_deduction", label: "Allowed Deduction" },
        { value: "not_applicable", label: "Not Applicable" }
    ];

    const zakatSubcategories = [
        { value: "cash_and_bank", label: "Cash & Bank" },
        { value: "accounts_receivable", label: "Accounts Receivable" },
        { value: "inventory", label: "Inventory" },
        { value: "related_party_advance", label: "Related Party Advance" },
        { value: "fixed_asset", label: "Fixed Asset" },
        { value: "accounts_payable", label: "Accounts Payable" },
        { value: "accrued_expense", label: "Accrued Expense" },
        { value: "short_term_loan", label: "Short-term Loan" },
        { value: "long_term_loan", label: "Long-term Loan" },
        { value: "provision", label: "Provision" },
        { value: "bad_debt", label: "Bad Debt" },
        { value: "obsolete_inventory", label: "Obsolete Inventory" },
        { value: "other", label: "Other" },
        { value: "not_applicable", label: "Not Applicable" }
    ];

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {bulkUpdate ? "Bulk Update GL Zakat Mapping" : `Edit Zakat Mapping - ${item?.account_code}`}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {bulkUpdate && (
                        <div className="space-y-4 border-b pb-4">
                            <h3 className="font-semibold">Select Accounts to Update</h3>
                            <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                                {accounts.map(account => (
                                    <div key={account.id} className="flex items-center gap-2">
                                        <Checkbox
                                            id={account.id}
                                            checked={selectedAccounts.includes(account.id)}
                                            onCheckedChange={(checked) => handleSelectAccount(account.id, checked)}
                                        />
                                        <Label htmlFor={account.id} className="flex-1 cursor-pointer">
                                            {account.account_code} - {account.account_name}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-gray-600">
                                {selectedAccounts.length} account(s) selected
                            </p>
                        </div>
                    )}

                    {!bulkUpdate && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Account Code</Label>
                                <Input value={item?.account_code} disabled />
                            </div>
                            <div>
                                <Label>Account Name</Label>
                                <Input value={item?.account_name} disabled />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="zakat_category">Zakat Category *</Label>
                            <Select
                                value={formData.zakat_category}
                                onValueChange={(value) => setFormData({ ...formData, zakat_category: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {zakatCategories.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="zakat_subcategory">Zakat Subcategory</Label>
                            <Select
                                value={formData.zakat_subcategory}
                                onValueChange={(value) => setFormData({ ...formData, zakat_subcategory: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subcategory" />
                                </SelectTrigger>
                                <SelectContent>
                                    {zakatSubcategories.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="is_related_party_account"
                            checked={formData.is_related_party_account || false}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_related_party_account: checked })}
                        />
                        <Label htmlFor="is_related_party_account" className="cursor-pointer">
                            Related Party Account (advances/loans to be added back to Zakat base)
                        </Label>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">Zakat Category Guidelines</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li><strong>Zakatable Asset:</strong> Cash, bank, AR, inventory, prepaid assets</li>
                            <li><strong>Deductible Liability:</strong> Trade AP, accrued expenses, short-term trade loans</li>
                            <li><strong>Add-back:</strong> Provisions, related party advances (to be added back to base)</li>
                            <li><strong>Allowed Deduction:</strong> Approved bad debts, obsolete inventory with evidence</li>
                            <li><strong>Non-Zakatable Asset:</strong> Fixed assets, long-term investments</li>
                            <li><strong>Non-Deductible Liability:</strong> Long-term loans, capital leases</li>
                        </ul>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={bulkUpdate && selectedAccounts.length === 0}
                        >
                            {bulkUpdate ? `Update ${selectedAccounts.length} Account(s)` : "Update Mapping"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}