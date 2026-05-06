import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Calculator, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BudgetVarianceReport() {
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().substring(0, 7));
    const [showBudgetDialog, setShowBudgetDialog] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: budgets = [] } = useQuery({
        queryKey: ['budgets', selectedPeriod],
        queryFn: () => base44.entities.Budget.filter({ fiscal_period: selectedPeriod }),
        initialData: []
    });

    const { data: journals = [] } = useQuery({
        queryKey: ['journals', selectedPeriod],
        queryFn: async () => {
            const allJournals = await base44.entities.JournalEntry.list();
            const periodStart = selectedPeriod + '-01';
            const periodEnd = new Date(new Date(selectedPeriod).getFullYear(), new Date(selectedPeriod).getMonth() + 1, 0).toISOString().split('T')[0];
            return allJournals.filter(j => 
                j.posting_date >= periodStart && 
                j.posting_date <= periodEnd &&
                j.status === 'posted'
            );
        },
        initialData: []
    });

    const { data: chartOfAccounts = [] } = useQuery({
        queryKey: ['chartOfAccounts'],
        queryFn: () => base44.entities.ChartOfAccounts.list(),
        initialData: []
    });

    const [newBudget, setNewBudget] = useState({
        account_code: '',
        budgeted_amount: 0
    });

    const createBudgetMutation = useMutation({
        mutationFn: (data) => base44.entities.Budget.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            toast({ title: "Success", description: "Budget created" });
            setShowBudgetDialog(false);
            setNewBudget({ account_code: '', budgeted_amount: 0 });
        }
    });

    const handleCreateBudget = () => {
        const account = chartOfAccounts.find(a => a.account_code === newBudget.account_code);
        if (!account) return;

        createBudgetMutation.mutate({
            budget_id: `BDG-${selectedPeriod}-${newBudget.account_code}`,
            fiscal_year: selectedPeriod.substring(0, 4),
            fiscal_period: selectedPeriod,
            account_code: newBudget.account_code,
            account_name: account.account_name,
            account_type: account.account_type,
            budgeted_amount: parseFloat(newBudget.budgeted_amount),
            status: 'approved'
        });
    };

    const calculateActuals = async () => {
        setCalculating(true);
        try {
            for (const budget of budgets) {
                const accountJournals = journals.filter(j => j.account_code === budget.account_code);
                const debits = accountJournals.reduce((sum, j) => sum + (j.debit_amount || 0), 0);
                const credits = accountJournals.reduce((sum, j) => sum + (j.credit_amount || 0), 0);
                
                let actual = 0;
                if (budget.account_type === 'revenue') {
                    actual = credits - debits;
                } else if (budget.account_type === 'expense') {
                    actual = debits - credits;
                }

                const variance = actual - budget.budgeted_amount;
                const variancePercent = budget.budgeted_amount !== 0 ? (variance / budget.budgeted_amount) * 100 : 0;

                await base44.entities.Budget.update(budget.id, {
                    ...budget,
                    actual_amount: actual,
                    variance_amount: variance,
                    variance_percent: variancePercent
                });
            }
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            toast({ title: "Success", description: "Actuals calculated and updated" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to calculate actuals", variant: "destructive" });
        } finally {
            setCalculating(false);
        }
    };

    const totalBudgeted = budgets.reduce((sum, b) => sum + (b.budgeted_amount || 0), 0);
    const totalActual = budgets.reduce((sum, b) => sum + (b.actual_amount || 0), 0);
    const totalVariance = totalActual - totalBudgeted;
    const totalVariancePercent = totalBudgeted !== 0 ? (totalVariance / totalBudgeted) * 100 : 0;

    const handleExport = () => {
        const csv = [
            ['Budget vs Actual Variance Report'],
            [`Period: ${selectedPeriod}`],
            [''],
            ['Account', 'Type', 'Budgeted', 'Actual', 'Variance', 'Variance %'],
            ...budgets.map(b => [
                b.account_name,
                b.account_type,
                b.budgeted_amount?.toFixed(2),
                b.actual_amount?.toFixed(2),
                b.variance_amount?.toFixed(2),
                b.variance_percent?.toFixed(2) + '%'
            ]),
            [''],
            ['TOTAL', '', totalBudgeted.toFixed(2), totalActual.toFixed(2), totalVariance.toFixed(2), totalVariancePercent.toFixed(2) + '%']
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget_variance_${selectedPeriod}.csv`;
        a.click();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-purple-600" />
                        Budget vs Actual Variance Analysis
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowBudgetDialog(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Budget
                        </Button>
                        <Button variant="outline" size="sm" onClick={calculateActuals} disabled={calculating}>
                            {calculating ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Calculator className="w-4 h-4 mr-2" />
                            )}
                            Calculate Actuals
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label>Fiscal Period</Label>
                    <Input 
                        type="month" 
                        value={selectedPeriod} 
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="max-w-xs"
                    />
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border">
                        <div className="text-sm text-gray-600">Total Budgeted</div>
                        <div className="text-2xl font-bold text-blue-700">SAR {totalBudgeted.toLocaleString()}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border">
                        <div className="text-sm text-gray-600">Total Actual</div>
                        <div className="text-2xl font-bold text-purple-700">SAR {totalActual.toLocaleString()}</div>
                    </div>
                    <div className={`p-4 rounded-lg border ${totalVariance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="text-sm text-gray-600">Variance</div>
                        <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            SAR {totalVariance.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg border">
                        <div className="text-sm text-gray-600">Variance %</div>
                        <div className="text-2xl font-bold text-amber-700">{totalVariancePercent.toFixed(1)}%</div>
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead>Account</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Budgeted</TableHead>
                                <TableHead className="text-right">Actual</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                                <TableHead className="text-right">Variance %</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {budgets.map((budget, idx) => {
                                const variance = budget.variance_amount || 0;
                                const isUnfavorable = 
                                    (budget.account_type === 'revenue' && variance < 0) ||
                                    (budget.account_type === 'expense' && variance > 0);
                                
                                return (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <div className="font-medium">{budget.account_name}</div>
                                            <div className="text-xs text-gray-500">{budget.account_code}</div>
                                        </TableCell>
                                        <TableCell className="capitalize">{budget.account_type}</TableCell>
                                        <TableCell className="text-right">{budget.budgeted_amount?.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{budget.actual_amount?.toLocaleString()}</TableCell>
                                        <TableCell className={`text-right font-semibold ${
                                            isUnfavorable ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                            {variance >= 0 ? '+' : ''}{variance.toLocaleString()}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${
                                            isUnfavorable ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                            {budget.variance_percent?.toFixed(1)}%
                                        </TableCell>
                                        <TableCell>
                                            {Math.abs(budget.variance_percent || 0) > 10 ? (
                                                <span className="text-red-600 text-sm">⚠️ Alert</span>
                                            ) : (
                                                <span className="text-green-600 text-sm">✓ On Track</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {budgets.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No budgets defined for {selectedPeriod}. Click "Add Budget" to create one.
                    </div>
                )}
            </CardContent>

            {showBudgetDialog && (
                <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Budget</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Period</Label>
                                <Input type="month" value={selectedPeriod} disabled />
                            </div>
                            <div>
                                <Label>Account</Label>
                                <Select value={newBudget.account_code} onValueChange={(val) => setNewBudget({...newBudget, account_code: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chartOfAccounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.account_code}>
                                                {acc.account_code} - {acc.account_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Budgeted Amount (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={newBudget.budgeted_amount}
                                    onChange={(e) => setNewBudget({...newBudget, budgeted_amount: e.target.value})}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>Cancel</Button>
                                <Button onClick={handleCreateBudget} className="bg-emerald-600">Create Budget</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </Card>
    );
}