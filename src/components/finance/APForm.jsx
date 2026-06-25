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
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import ReverseButton from "../shared/ReverseButton";
import SearchableSelect from "@/components/ui/SearchableSelect";

export default function APForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);
    const taxConfig = useTaxConfig();

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => matrixSales.entities.Vendor.list(),
        initialData: []
    });

    const vendorOptions = useMemo(
        () => vendors.map(v => ({ value: v.vendor_code, label: `${v.vendor_code} - ${v.vendor_name}` })),
        [vendors]
    );

    const [formData, setFormData] = useState({
        ap_number: '',
        vendor_invoice_number: '',
        vendor_code: '',
        vendor_name: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        invoice_amount: 0,
        paid_amount: 0,
        outstanding_amount: 0,
        payment_terms: 'net_30',
        aging_days: 0,
        aging_bucket: 'current',
        vat_amount: 0,
        currency: 'LKR',
        payment_status: 'pending',
        approved_by: '',
        approval_date: '',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        const outstanding = (formData.invoice_amount || 0) - (formData.paid_amount || 0);
        const vat = (formData.invoice_amount || 0) * (taxConfig.vat_standard_rate / 100);
        setFormData(prev => ({
            ...prev,
            outstanding_amount: outstanding,
            vat_amount: vat
        }));
    }, [formData.invoice_amount, formData.paid_amount, taxConfig.vat_standard_rate]);

    const handleVendorSelect = (vendorCode) => {
        const vendor = vendors.find(v => v.vendor_code === vendorCode);
        if (vendor) {
            setFormData(prev => ({
                ...prev,
                vendor_code: vendorCode,
                vendor_name: vendor.vendor_name,
                payment_terms: vendor.payment_terms || 'net_30'
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.AccountsPayable.update(item.id, data);
            }
            return matrixSales.entities.AccountsPayable.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ap'] });
            toast({
                title: "Success",
                description: `AP entry ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this AP entry?`)) {
            saveMutation.mutate(formData);
        }
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit AP Entry' : 'New AP Entry'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>AP Number *</Label>
                            <Input
                                value={formData.ap_number}
                                onChange={(e) => handleChange('ap_number', e.target.value)}
                                required
                                placeholder="AP-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>Vendor Invoice Number *</Label>
                            <Input
                                value={formData.vendor_invoice_number}
                                onChange={(e) => handleChange('vendor_invoice_number', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <SearchableSelect
                            label="Vendor *"
                            mode="client"
                            options={vendorOptions}
                            value={formData.vendor_code}
                            onChange={handleVendorSelect}
                            placeholder="Select vendor"
                            searchPlaceholder="Search vendors..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Invoice Date *</Label>
                            <Input
                                type="date"
                                value={formData.invoice_date}
                                onChange={(e) => handleChange('invoice_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Due Date *</Label>
                            <Input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => handleChange('due_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Invoice Amount (LKR) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.invoice_amount}
                                onChange={(e) => handleChange('invoice_amount', parseFloat(e.target.value) || 0)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Paid Amount (LKR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.paid_amount}
                                onChange={(e) => handleChange('paid_amount', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-600">VAT (15%):</span>
                            <span className="font-semibold">LKR {formData.vat_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg border-t pt-2">
                            <span className="font-bold">Outstanding:</span>
                            <span className="font-bold text-red-600">
                                LKR {formData.outstanding_amount.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Payment Terms</Label>
                            <Select
                                value={formData.payment_terms}
                                onValueChange={(val) => handleChange('payment_terms', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="net_30">Net 30</SelectItem>
                                    <SelectItem value="net_45">Net 45</SelectItem>
                                    <SelectItem value="net_60">Net 60</SelectItem>
                                    <SelectItem value="cod">COD</SelectItem>
                                    <SelectItem value="advance">Advance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Payment Status</Label>
                            <Select
                                value={formData.payment_status}
                                onValueChange={(val) => handleChange('payment_status', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Aging Bucket</Label>
                        <Select
                            value={formData.aging_bucket}
                            onValueChange={(val) => handleChange('aging_bucket', val)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="current">Current</SelectItem>
                                <SelectItem value="1-30">1-30 Days</SelectItem>
                                <SelectItem value="31-60">31-60 Days</SelectItem>
                                <SelectItem value="61-90">61-90 Days</SelectItem>
                                <SelectItem value="90+">90+ Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <ReverseButton
                            item={item}
                            entityName="AccountsPayable"
                            queryKeys={['ap']}
                            onSuccess={onClose}
                        />
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                {item ? 'Update' : 'Create'} AP Entry
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
