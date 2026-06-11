import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Send } from "lucide-react";

export default function BudgetManagementForm({ item, onClose, open }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState(item || {
        budget_id: '',
        fiscal_year: new Date().getFullYear().toString(),
        fiscal_period: new Date().toISOString().substring(0, 7),
        account_code: '',
        account_name: '',
        account_type: 'expense',
        budgeted_amount: 0,
        department: '',
        cost_center: '',
        project_code: '',
        status: 'draft',
        notes: ''
    });

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => matrixSales.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters'],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => matrixSales.entities.Project.list(),
        initialData: []
    });

    // Auto-generate budget ID if not editing
    useEffect(() => {
        if (!item && formData.fiscal_period && formData.account_code) {
            const budgetId = `BDG-${formData.fiscal_period}-${formData.account_code}${formData.department ? '-' + formData.department : ''}`;
            setFormData(prev => ({ ...prev, budget_id: budgetId }));
        }
    }, [formData.fiscal_period, formData.account_code, formData.department, item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Budget.update(item.id, data);
            }
            return matrixSales.entities.Budget.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            toast({
                title: "Success",
                description: `Budget ${item ? 'updated' : 'created'} successfully`,
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save budget",
                variant: "destructive"
            });
        }
    });

    const submitForApprovalMutation = useMutation({
        mutationFn: async (budget) => {
            const user = await matrixSales.auth.me();
            
            // Update budget status to pending approval
            await matrixSales.entities.Budget.update(budget.id, {
                ...budget,
                status: 'pending_approval'
            });

            // Find approval matrix for budget
            const approvalMatrix = await matrixSales.entities.ApprovalMatrix.filter({
                document_type: 'budget',
                status: 'active'
            });

            if (approvalMatrix.length > 0) {
                // Create approval request
                await matrixSales.entities.ApprovalRequest.create({
                    request_id: `APR-BDG-${Date.now()}`,
                    document_type: 'budget',
                    document_number: budget.budget_id,
                    requester: user.email,
                    requester_name: user.full_name,
                    amount: budget.budgeted_amount,
                    current_level: 1,
                    total_levels: approvalMatrix.length,
                    status: 'pending',
                    submission_date: new Date().toISOString().split('T')[0]
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            queryClient.invalidateQueries({ queryKey: ['approvals'] });
            toast({
                title: "Success",
                description: "Budget submitted for approval",
            });
            onClose();
        }
    });

    const handleAccountChange = (accountCode) => {
        const account = chartOfAccounts.find(a => a.account_code === accountCode);
        if (account) {
            setFormData(prev => ({
                ...prev,
                account_code: accountCode,
                account_name: account.account_name,
                account_type: account.account_type
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Set fiscal year from period
        const updatedData = {
            ...formData,
            fiscal_year: formData.fiscal_period.substring(0, 4)
        };

        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this budget?`)) {
            saveMutation.mutate(updatedData);
        }
    };

    const handleSubmitForApproval = () => {
        if (window.confirm('Submit this budget for approval?')) {
            const updatedData = {
                ...formData,
                fiscal_year: formData.fiscal_period.substring(0, 4)
            };
            
            // First save, then submit for approval
            if (item) {
                submitForApprovalMutation.mutate({ ...item, ...updatedData });
            } else {
                saveMutation.mutate(updatedData, {
                    onSuccess: (newBudget) => {
                        submitForApprovalMutation.mutate(newBudget);
                    }
                });
            }
        }
    };

    const canSubmitForApproval = formData.status === 'draft' && formData.budgeted_amount > 0;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Budget' : 'Create Budget'}
                    </DialogTitle>
                </DialogHeader>

                {item?.status === 'approved' && (
                    <Alert className="bg-green-50 border-green-200">
                        <AlertCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-900">
                            This budget has been approved. Changes will require re-approval.
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Fiscal Period *</Label>
                            <Input
                                type="month"
                                value={formData.fiscal_period}
                                onChange={(e) => setFormData({...formData, fiscal_period: e.target.value})}
                                required
                                disabled={!!item}
                            />
                        </div>
                        <div>
                            <Label>Budget ID</Label>
                            <Input
                                value={formData.budget_id}
                                disabled
                                className="bg-gray-50"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>GL Account *</Label>
                        <Select 
                            value={formData.account_code} 
                            onValueChange={handleAccountChange}
                            disabled={!!item}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                {chartOfAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.account_code}>
                                        {acc.account_code} - {acc.account_name} ({acc.account_type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Department</Label>
                            <Input
                                value={formData.department}
                                onChange={(e) => setFormData({...formData, department: e.target.value})}
                                placeholder="e.g., Sales, IT"
                            />
                        </div>
                        <div>
                            <Label>Cost Center</Label>
                            <Select 
                                value={formData.cost_center} 
                                onValueChange={(val) => setFormData({...formData, cost_center: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select cost center" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>None</SelectItem>
                                    {costCenters.map(cc => (
                                        <SelectItem key={cc.id} value={cc.cost_center_code}>
                                            {cc.cost_center_code} - {cc.cost_center_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Project</Label>
                            <Select 
                                value={formData.project_code} 
                                onValueChange={(val) => setFormData({...formData, project_code: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>None</SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.project_code}>
                                            {p.project_code} - {p.project_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Budgeted Amount (LKR) *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.budgeted_amount}
                            onChange={(e) => setFormData({...formData, budgeted_amount: parseFloat(e.target.value) || 0})}
                            required
                        />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Account Type:</span>
                            <span className="font-semibold capitalize">{formData.account_type}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Status:</span>
                            <span className="font-semibold capitalize">{formData.status}</span>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            rows={3}
                            placeholder="Budget justification, assumptions, etc."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        {canSubmitForApproval && (
                            <Button 
                                type="button" 
                                variant="outline"
                                onClick={handleSubmitForApproval}
                                className="gap-2"
                            >
                                <Send className="w-4 h-4" />
                                Submit for Approval
                            </Button>
                        )}
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Save as Draft'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}