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
import SearchableSelect from "../shared/SearchableSelect";

export default function ZakatAdjustmentForm({ item, computations, chartOfAccounts, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [formData, setFormData] = useState(item || {
        adjustment_id: `ZA-${Date.now()}`,
        adjustment_date: new Date().toISOString().split('T')[0],
        approval_status: 'pending',
        requires_evidence: false,
        evidence_provided: false
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.ZakatAdjustment.update(item.id, data);
            }
            return base44.entities.ZakatAdjustment.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['zakatAdjustments']);
            toast({
                title: "Success",
                description: `Adjustment ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.requires_evidence && !formData.evidence_provided) {
            toast({
                title: "Evidence Required",
                description: "Please upload supporting evidence for this adjustment",
                variant: "destructive"
            });
            return;
        }
        saveMutation.mutate(formData);
    };

    const adjustmentTypes = [
        { value: "add_back", label: "Add-back" },
        { value: "deduction", label: "Deduction" },
        { value: "non_zakatable", label: "Non-Zakatable" },
        { value: "evidence_required", label: "Evidence Required" },
        { value: "reclassification", label: "Reclassification" }
    ];

    const adjustmentCategories = [
        { value: "bad_debt", label: "Bad Debt" },
        { value: "obsolete_inventory", label: "Obsolete Inventory" },
        { value: "provision_add_back", label: "Provision Add-back" },
        { value: "related_party_advance", label: "Related Party Advance" },
        { value: "non_trade_receivable", label: "Non-Trade Receivable" },
        { value: "long_term_liability_exclusion", label: "Long-term Liability Exclusion" },
        { value: "other", label: "Other" }
    ];

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Zakat Adjustment</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adjustment_id">Adjustment ID *</Label>
                            <Input
                                id="adjustment_id"
                                value={formData.adjustment_id}
                                onChange={(e) => setFormData({ ...formData, adjustment_id: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="computation_id">Computation *</Label>
                            <Select
                                value={formData.computation_id}
                                onValueChange={(value) => {
                                    const comp = computations.find(c => c.computation_id === value);
                                    setFormData({ 
                                        ...formData, 
                                        computation_id: value,
                                        fiscal_year: comp?.fiscal_year 
                                    });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select computation" />
                                </SelectTrigger>
                                <SelectContent>
                                    {computations.map(comp => (
                                        <SelectItem key={comp.id} value={comp.computation_id}>
                                            {comp.computation_id} - {comp.fiscal_year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adjustment_type">Adjustment Type *</Label>
                            <Select
                                value={formData.adjustment_type}
                                onValueChange={(value) => setFormData({ ...formData, adjustment_type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {adjustmentTypes.map(type => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adjustment_category">Adjustment Category *</Label>
                            <Select
                                value={formData.adjustment_category}
                                onValueChange={(value) => setFormData({ ...formData, adjustment_category: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {adjustmentCategories.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="gl_account_code">GL Account *</Label>
                            <SearchableSelect
                                items={chartOfAccounts.map(acc => ({
                                    value: acc.account_code,
                                    label: `${acc.account_code} - ${acc.account_name}`
                                }))}
                                value={formData.gl_account_code}
                                onValueChange={(value) => {
                                    const acc = chartOfAccounts.find(a => a.account_code === value);
                                    setFormData({ 
                                        ...formData, 
                                        gl_account_code: value,
                                        gl_account_name: acc?.account_name
                                    });
                                }}
                                placeholder="Search account..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adjustment_amount">Adjustment Amount (SAR) *</Label>
                            <Input
                                id="adjustment_amount"
                                type="number"
                                step="0.01"
                                value={formData.adjustment_amount || ''}
                                onChange={(e) => setFormData({ ...formData, adjustment_amount: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adjustment_date">Adjustment Date *</Label>
                            <Input
                                id="adjustment_date"
                                type="date"
                                value={formData.adjustment_date}
                                onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="source_document_number">Source Document #</Label>
                            <Input
                                id="source_document_number"
                                value={formData.source_document_number || ''}
                                onChange={(e) => setFormData({ ...formData, source_document_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="requires_evidence"
                                checked={formData.requires_evidence || false}
                                onCheckedChange={(checked) => setFormData({ ...formData, requires_evidence: checked })}
                            />
                            <Label htmlFor="requires_evidence" className="cursor-pointer">
                                This adjustment requires supporting evidence
                            </Label>
                        </div>

                        {formData.requires_evidence && (
                            <div className="ml-6 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="evidence_provided"
                                        checked={formData.evidence_provided || false}
                                        onCheckedChange={(checked) => setFormData({ ...formData, evidence_provided: checked })}
                                    />
                                    <Label htmlFor="evidence_provided" className="cursor-pointer">
                                        Evidence has been provided
                                    </Label>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="evidence_document_url">Evidence Document URL</Label>
                                    <Input
                                        id="evidence_document_url"
                                        value={formData.evidence_document_url || ''}
                                        onChange={(e) => setFormData({ ...formData, evidence_document_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Adjustment
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}