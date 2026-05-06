import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Calculator, Loader2 } from "lucide-react";

export default function ZakatComputationForm({ item, configuration, chartOfAccounts, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isComputing, setIsComputing] = useState(false);

    const [formData, setFormData] = useState(item || {
        computation_id: `ZK-${Date.now()}`,
        fiscal_year: configuration?.fiscal_year || new Date().getFullYear().toString(),
        computation_date: new Date().toISOString().split('T')[0],
        period_start_date: `${new Date().getFullYear()}-01-01`,
        period_end_date: new Date().toISOString().split('T')[0],
        computation_status: 'draft',
        zakat_rate: configuration?.zakat_rate || 2.5,
        saudi_gcc_ownership_percent: configuration?.saudi_gcc_ownership_percent || 100
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.ZakatComputation.update(item.id, data);
            }
            return matrixSales.entities.ZakatComputation.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['zakatComputations']);
            toast({
                title: "Success",
                description: "Computation saved successfully"
            });
            onClose();
        }
    });

    const handleRunComputation = async () => {
        if (!configuration) {
            toast({
                title: "Configuration Required",
                description: "Please create and activate a Zakat configuration first",
                variant: "destructive"
            });
            return;
        }

        setIsComputing(true);
        try {
            // Fetch GL balances and compute
            const accounts = await matrixSales.entities.ChartOfAccounts.list();
            
            const zakatable = {
                cash_and_bank: 0,
                accounts_receivable: 0,
                inventory: 0,
                advances_to_related_parties: 0,
                other_zakatable_assets: 0,
                total: 0
            };

            const deductible = {
                accounts_payable: 0,
                accrued_expenses: 0,
                short_term_loans: 0,
                other_deductible_liabilities: 0,
                total: 0
            };

            accounts.forEach(acc => {
                const balance = acc.current_balance || 0;
                
                if (acc.zakat_category === 'zakatable_asset') {
                    if (acc.zakat_subcategory === 'cash_and_bank') zakatable.cash_and_bank += balance;
                    else if (acc.zakat_subcategory === 'accounts_receivable') zakatable.accounts_receivable += balance;
                    else if (acc.zakat_subcategory === 'inventory') zakatable.inventory += balance;
                    else if (acc.zakat_subcategory === 'related_party_advance') zakatable.advances_to_related_parties += balance;
                    else zakatable.other_zakatable_assets += balance;
                } else if (acc.zakat_category === 'deductible_liability') {
                    if (acc.zakat_subcategory === 'accounts_payable') deductible.accounts_payable += Math.abs(balance);
                    else if (acc.zakat_subcategory === 'accrued_expense') deductible.accrued_expenses += Math.abs(balance);
                    else if (acc.zakat_subcategory === 'short_term_loan') deductible.short_term_loans += Math.abs(balance);
                    else deductible.other_deductible_liabilities += Math.abs(balance);
                }
            });

            zakatable.total = zakatable.cash_and_bank + zakatable.accounts_receivable + 
                zakatable.inventory + zakatable.advances_to_related_parties + zakatable.other_zakatable_assets;

            deductible.total = deductible.accounts_payable + deductible.accrued_expenses + 
                deductible.short_term_loans + deductible.other_deductible_liabilities;

            const netZakatBase = zakatable.total - deductible.total;
            const zakatBaseForSaudiGCC = netZakatBase * (formData.saudi_gcc_ownership_percent / 100);
            const annualZakatDue = zakatBaseForSaudiGCC * (formData.zakat_rate / 100);

            setFormData({
                ...formData,
                zakatable_assets: zakatable,
                deductible_liabilities: deductible,
                add_backs: { total: 0 },
                allowed_deductions: { total: 0 },
                net_zakat_base: netZakatBase,
                zakat_base_for_saudi_gcc: zakatBaseForSaudiGCC,
                annual_zakat_due: annualZakatDue,
                prorated_zakat_due: annualZakatDue,
                computation_status: 'computed'
            });

            toast({
                title: "Computation Complete",
                description: `Zakat Due: SAR ${annualZakatDue.toLocaleString()}`
            });
        } catch (error) {
            console.error('Computation error:', error);
            toast({
                title: "Computation Failed",
                description: "Error computing Zakat. Please check configuration and GL accounts.",
                variant: "destructive"
            });
        } finally {
            setIsComputing(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Zakat Computation - {formData.fiscal_year}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Computation ID</Label>
                            <Input value={formData.computation_id} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Fiscal Year</Label>
                            <Input value={formData.fiscal_year} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Period End Date</Label>
                            <Input
                                type="date"
                                value={formData.period_end_date}
                                onChange={(e) => setFormData({ ...formData, period_end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={handleRunComputation}
                        disabled={isComputing}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                        {isComputing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Computing...
                            </>
                        ) : (
                            <>
                                <Calculator className="w-4 h-4 mr-2" />
                                Run Zakat Computation
                            </>
                        )}
                    </Button>

                    {formData.net_zakat_base !== undefined && (
                        <>
                            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                <h3 className="font-semibold text-lg">Zakatable Assets</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>Cash & Bank: <span className="font-bold">SAR {formData.zakatable_assets?.cash_and_bank?.toLocaleString()}</span></div>
                                    <div>Accounts Receivable: <span className="font-bold">SAR {formData.zakatable_assets?.accounts_receivable?.toLocaleString()}</span></div>
                                    <div>Inventory: <span className="font-bold">SAR {formData.zakatable_assets?.inventory?.toLocaleString()}</span></div>
                                    <div>Related Party Advances: <span className="font-bold">SAR {formData.zakatable_assets?.advances_to_related_parties?.toLocaleString()}</span></div>
                                </div>
                                <div className="text-base font-bold pt-2 border-t">
                                    Total: SAR {formData.zakatable_assets?.total?.toLocaleString()}
                                </div>
                            </div>

                            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                <h3 className="font-semibold text-lg">Deductible Liabilities</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>Accounts Payable: <span className="font-bold">SAR {formData.deductible_liabilities?.accounts_payable?.toLocaleString()}</span></div>
                                    <div>Accrued Expenses: <span className="font-bold">SAR {formData.deductible_liabilities?.accrued_expenses?.toLocaleString()}</span></div>
                                    <div>Short-term Loans: <span className="font-bold">SAR {formData.deductible_liabilities?.short_term_loans?.toLocaleString()}</span></div>
                                </div>
                                <div className="text-base font-bold pt-2 border-t">
                                    Total: SAR {formData.deductible_liabilities?.total?.toLocaleString()}
                                </div>
                            </div>

                            <div className="border-2 border-emerald-500 rounded-lg p-4 bg-emerald-50 space-y-2">
                                <div className="flex justify-between text-lg">
                                    <span className="font-semibold">Net Zakat Base:</span>
                                    <span className="font-bold">SAR {formData.net_zakat_base?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Saudi/GCC Ownership ({formData.saudi_gcc_ownership_percent}%):</span>
                                    <span className="font-semibold">SAR {formData.zakat_base_for_saudi_gcc?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Zakat Rate:</span>
                                    <span className="font-semibold">{formData.zakat_rate}%</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold pt-3 border-t-2 border-emerald-600 text-emerald-900">
                                    <span>Annual Zakat Due:</span>
                                    <span>SAR {formData.annual_zakat_due?.toLocaleString()}</span>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="computation_status">Status</Label>
                        <Select
                            value={formData.computation_status}
                            onValueChange={(value) => setFormData({ ...formData, computation_status: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="computed">Computed</SelectItem>
                                <SelectItem value="reviewed">Reviewed</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="locked">Locked</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            Save Computation
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}