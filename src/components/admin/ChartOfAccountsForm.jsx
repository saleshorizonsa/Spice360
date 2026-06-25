import React, { useState, useEffect, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { useOrganization } from "../utils/OrganizationContext";
import SearchableSelect from "@/components/ui/SearchableSelect";

export default function ChartOfAccountsForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: accounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        account_code: '',
        account_name: '',
        account_type: 'asset',
        account_subtype: 'current_asset',
        financial_statement_category: 'current_asset',
        normal_balance: 'debit',
        parent_account: '',
        level: 1,
        is_header: false,
        is_control_account: false,
        allow_direct_posting: true,
        cost_center_required: false,
        is_active: true,
        currency: 'LKR',
        opening_balance: 0,
        current_balance: 0,
        status: 'active',
        description: '',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            const payload = {
                ...data,
                tenant_id: data.tenant_id || currentOrg?.id,
                organization_id: data.organization_id || currentOrg?.id
            };
            if (item) {
                return matrixSales.entities.ChartOfAccounts.update(item.id, payload);
            }
            return matrixSales.entities.ChartOfAccounts.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chartOfAccounts'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            toast({
                title: "Success",
                description: `Account ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} account: ${error.message}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this account?`)) {
            saveMutation.mutate(formData);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
            ...(field === "is_header" && value ? { allow_direct_posting: false } : {})
        }));
    };

    const subtypeOptions = {
        asset: [
            { value: 'current_asset', label: 'Current Asset' },
            { value: 'fixed_asset', label: 'Fixed Asset' }
        ],
        liability: [
            { value: 'current_liability', label: 'Current Liability' },
            { value: 'long_term_liability', label: 'Long Term Liability' }
        ],
        equity: [
            { value: 'equity', label: 'Equity' }
        ],
        revenue: [
            { value: 'operating_revenue', label: 'Operating Revenue' },
            { value: 'other_revenue', label: 'Other Revenue' }
        ],
        expense: [
            { value: 'operating_expense', label: 'Operating Expense' },
            { value: 'cost_of_goods_sold', label: 'Cost of Goods Sold' },
            { value: 'other_expense', label: 'Other Expense' }
        ]
    };

    const categoryOptions = [
        { value: 'current_asset', label: 'Current Asset' },
        { value: 'non_current_asset', label: 'Non-current Asset' },
        { value: 'current_liability', label: 'Current Liability' },
        { value: 'non_current_liability', label: 'Non-current Liability' },
        { value: 'equity', label: 'Equity / Owner Capital' },
        { value: 'retained_earnings', label: 'Retained Earnings' },
        { value: 'revenue', label: 'Revenue' },
        { value: 'cost_of_sales', label: 'Cost of Sales / Services' },
        { value: 'operating_expense', label: 'Operating Expense' },
        { value: 'other_income', label: 'Other Income' },
        { value: 'other_expense', label: 'Other Expense' }
    ];

    const defaultCategoryForType = {
        asset: 'current_asset',
        liability: 'current_liability',
        equity: 'equity',
        revenue: 'revenue',
        expense: 'operating_expense'
    };

    const defaultNormalBalanceForType = {
        asset: 'debit',
        expense: 'debit',
        liability: 'credit',
        equity: 'credit',
        revenue: 'credit'
    };

    const controlAccounts = accounts.filter(a => a.is_control_account || a.level === 1);

    const parentAccountOptions = useMemo(() => [
        { value: '', label: 'None (Top Level)' },
        ...controlAccounts.map(acc => ({
            value: acc.account_code,
            label: `${acc.account_code} - ${acc.account_name}`
        }))
    ], [controlAccounts]);

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Account' : 'Create New Account'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Account Identification */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Account Identification</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Account Code *</Label>
                                <Input
                                    value={formData.account_code}
                                    onChange={(e) => handleChange('account_code', e.target.value)}
                                    required
                                    placeholder="e.g., 1010, 4010"
                                />
                                <p className="text-xs text-gray-500 mt-1">Unique identifier for the account</p>
                            </div>
                            <div>
                                <Label>Account Name *</Label>
                                <Input
                                    value={formData.account_name}
                                    onChange={(e) => handleChange('account_name', e.target.value)}
                                    required
                                    placeholder="e.g., Cash in Hand"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Account Classification */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Classification</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Account Type *</Label>
                                <Select 
                                    value={formData.account_type} 
                                    onValueChange={(val) => {
                                        handleChange('account_type', val);
                                        const firstSubtype = subtypeOptions[val]?.[0]?.value;
                                        if (firstSubtype) {
                                            handleChange('account_subtype', firstSubtype);
                                        }
                                        handleChange('financial_statement_category', defaultCategoryForType[val] || 'current_asset');
                                        handleChange('normal_balance', defaultNormalBalanceForType[val] || 'debit');
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asset">Asset</SelectItem>
                                        <SelectItem value="liability">Liability</SelectItem>
                                        <SelectItem value="equity">Equity</SelectItem>
                                        <SelectItem value="revenue">Revenue</SelectItem>
                                        <SelectItem value="expense">Expense</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Account Subtype *</Label>
                                <Select 
                                    value={formData.account_subtype} 
                                    onValueChange={(val) => handleChange('account_subtype', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subtypeOptions[formData.account_type]?.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Financial Statement Category *</Label>
                                <Select
                                    value={formData.financial_statement_category}
                                    onValueChange={(val) => handleChange('financial_statement_category', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Normal Balance *</Label>
                                <Select
                                    value={formData.normal_balance}
                                    onValueChange={(val) => handleChange('normal_balance', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="debit">Debit</SelectItem>
                                        <SelectItem value="credit">Credit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Hierarchy */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Account Hierarchy</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <SearchableSelect
                                    label="Parent Account"
                                    mode="client"
                                    value={formData.parent_account}
                                    onChange={(val) => handleChange('parent_account', val)}
                                    options={parentAccountOptions}
                                    placeholder="None (Top Level)"
                                    searchPlaceholder="Search accounts..."
                                    clearable
                                />
                            </div>
                            <div>
                                <Label>Level</Label>
                                <Input
                                    type="number"
                                    value={formData.level}
                                    onChange={(e) => handleChange('level', parseInt(e.target.value) || 1)}
                                    min="1"
                                />
                                <p className="text-xs text-gray-500 mt-1">1 = Top level</p>
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch
                                    checked={formData.is_control_account}
                                    onCheckedChange={(val) => handleChange('is_control_account', val)}
                                />
                                <Label>Control Account</Label>
                            </div>
                        </div>
                    </div>

                    {/* Balances */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Balances</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Currency</Label>
                                <Input
                                    value={formData.currency}
                                    onChange={(e) => handleChange('currency', e.target.value)}
                                    placeholder="LKR"
                                />
                            </div>
                            <div>
                                <Label>Opening Balance</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.opening_balance}
                                    onChange={(e) => handleChange('opening_balance', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Current Balance</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.current_balance}
                                    onChange={(e) => handleChange('current_balance', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
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
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                ["is_header",            "Header account"],
                                ["is_active",            "Active"],
                                ["allow_direct_posting", "Allow direct posting"],
                                ["cost_center_required", "Cost center required"],
                            ].map(([field, label]) => (
                                <label key={field} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                                    <Switch
                                        checked={Boolean(formData[field])}
                                        onCheckedChange={(value) => handleChange(field, value)}
                                    />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </div>

                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={2}
                                placeholder="Account description and purpose"
                            />
                        </div>

                        <div>
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={2}
                                placeholder="Additional notes"
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
                            {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' Account'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
