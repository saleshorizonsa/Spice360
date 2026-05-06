import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function ZakatConfigForm({ item, shareholders, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    
    const saudiGCCOwnership = shareholders
        .filter(s => s.is_saudi_gcc && s.status === 'active')
        .reduce((sum, s) => sum + (s.ownership_percentage || 0), 0);

    const [formData, setFormData] = useState(item || {
        config_id: `ZC-${Date.now()}`,
        fiscal_year: new Date().getFullYear().toString(),
        zakat_rate: 2.5,
        computation_method: 'net_zakat_base',
        saudi_gcc_ownership_percent: saudiGCCOwnership,
        use_hijri_year: true,
        inventory_valuation_method: 'weighted_average',
        bad_debt_deduction_allowed: true,
        obsolete_inventory_deduction_allowed: true,
        minimum_inventory_age_for_deduction: 365,
        status: 'draft'
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.ZakatConfiguration.update(item.id, data);
            }
            return base44.entities.ZakatConfiguration.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['zakatConfigurations']);
            toast({
                title: "Success",
                description: `Configuration ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Zakat Configuration</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="config_id">Configuration ID *</Label>
                            <Input
                                id="config_id"
                                value={formData.config_id}
                                onChange={(e) => setFormData({ ...formData, config_id: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fiscal_year">Fiscal Year *</Label>
                            <Input
                                id="fiscal_year"
                                value={formData.fiscal_year}
                                onChange={(e) => setFormData({ ...formData, fiscal_year: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="zakat_rate">Zakat Rate (%) *</Label>
                            <Input
                                id="zakat_rate"
                                type="number"
                                step="0.01"
                                value={formData.zakat_rate}
                                onChange={(e) => setFormData({ ...formData, zakat_rate: parseFloat(e.target.value) })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="computation_method">Computation Method</Label>
                            <Select
                                value={formData.computation_method}
                                onValueChange={(value) => setFormData({ ...formData, computation_method: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="net_zakat_base">Net Zakat Base</SelectItem>
                                    <SelectItem value="net_working_capital">Net Working Capital</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="saudi_gcc_ownership_percent">Saudi/GCC Ownership (%)</Label>
                            <Input
                                id="saudi_gcc_ownership_percent"
                                type="number"
                                step="0.01"
                                value={formData.saudi_gcc_ownership_percent}
                                onChange={(e) => setFormData({ ...formData, saudi_gcc_ownership_percent: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="use_hijri_year"
                            checked={formData.use_hijri_year || false}
                            onCheckedChange={(checked) => setFormData({ ...formData, use_hijri_year: checked })}
                        />
                        <Label htmlFor="use_hijri_year" className="cursor-pointer">
                            Use Hijri Year for Computation (354/355 days)
                        </Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="gregorian_year_start">Gregorian Year Start</Label>
                            <Input
                                id="gregorian_year_start"
                                type="date"
                                value={formData.gregorian_year_start || ''}
                                onChange={(e) => setFormData({ ...formData, gregorian_year_start: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gregorian_year_end">Gregorian Year End</Label>
                            <Input
                                id="gregorian_year_end"
                                type="date"
                                value={formData.gregorian_year_end || ''}
                                onChange={(e) => setFormData({ ...formData, gregorian_year_end: e.target.value })}
                            />
                        </div>
                    </div>

                    {formData.use_hijri_year && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="hijri_year_start">Hijri Year Start (e.g., 1 Muharram 1447)</Label>
                                <Input
                                    id="hijri_year_start"
                                    value={formData.hijri_year_start || ''}
                                    onChange={(e) => setFormData({ ...formData, hijri_year_start: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="hijri_year_end">Hijri Year End (e.g., 29 Dhul Hijjah 1447)</Label>
                                <Input
                                    id="hijri_year_end"
                                    value={formData.hijri_year_end || ''}
                                    onChange={(e) => setFormData({ ...formData, hijri_year_end: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="inventory_valuation_method">Inventory Valuation Method</Label>
                        <Select
                            value={formData.inventory_valuation_method}
                            onValueChange={(value) => setFormData({ ...formData, inventory_valuation_method: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fifo">FIFO</SelectItem>
                                <SelectItem value="lifo">LIFO</SelectItem>
                                <SelectItem value="weighted_average">Weighted Average</SelectItem>
                                <SelectItem value="lower_of_cost_or_market">Lower of Cost or Market</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="bad_debt_deduction_allowed"
                                checked={formData.bad_debt_deduction_allowed || false}
                                onCheckedChange={(checked) => setFormData({ ...formData, bad_debt_deduction_allowed: checked })}
                            />
                            <Label htmlFor="bad_debt_deduction_allowed" className="cursor-pointer">
                                Allow Bad Debt Deduction from Receivables
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="obsolete_inventory_deduction_allowed"
                                checked={formData.obsolete_inventory_deduction_allowed || false}
                                onCheckedChange={(checked) => setFormData({ ...formData, obsolete_inventory_deduction_allowed: checked })}
                            />
                            <Label htmlFor="obsolete_inventory_deduction_allowed" className="cursor-pointer">
                                Allow Obsolete Inventory Deduction
                            </Label>
                        </div>

                        {formData.obsolete_inventory_deduction_allowed && (
                            <div className="space-y-2 ml-6">
                                <Label htmlFor="minimum_inventory_age_for_deduction">Minimum Age for Deduction (days)</Label>
                                <Input
                                    id="minimum_inventory_age_for_deduction"
                                    type="number"
                                    value={formData.minimum_inventory_age_for_deduction}
                                    onChange={(e) => setFormData({ ...formData, minimum_inventory_age_for_deduction: parseInt(e.target.value) })}
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
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
                            {item ? 'Update' : 'Create'} Configuration
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}