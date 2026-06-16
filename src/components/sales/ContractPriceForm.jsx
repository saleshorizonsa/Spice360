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
import { useOrganization } from "../utils/OrganizationContext";
import { Tag } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";

export default function ContractPriceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        customer_code: '',
        customer_name: '',
        material_code: '',
        material_name: '',
        price_per_unit: 0,
        currency: 'LKR',
        incoterm: '',
        min_quantity: 0,
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
        status: 'active',
        notes: ''
    });

    useEffect(() => {
        if (item) setFormData({ ...item });
    }, [item]);

    const handleCustomerSelect = (code) => {
        const c = customers.find(c => c.customer_code === code);
        setFormData(prev => ({
            ...prev,
            customer_code: code,
            customer_name: c?.customer_name || ''
        }));
    };

    const handleMaterialSelect = (code) => {
        const m = materials.find(m => m.material_code === code);
        setFormData(prev => ({
            ...prev,
            material_code: code,
            material_name: m?.material_name || '',
            unit_of_measure: m?.unit_of_measure || ''
        }));
    };

    const saveMutation = useMutation({
        mutationFn: (data) => item
            ? matrixSales.entities.ContractPrice.update(item.id, data)
            : matrixSales.entities.ContractPrice.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contractPrices'] });
            toast({ title: "Saved", description: "Contract price saved." });
            onClose();
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const customerOptions = customers.map(c => ({
        value: c.customer_code,
        label: `${c.customer_code} — ${c.customer_name}`
    }));
    const materialOptions = materials.map(m => ({
        value: m.material_code,
        label: `${m.material_code} — ${m.material_name}`
    }));

    const today = new Date().toISOString().split('T')[0];
    const isExpired = formData.valid_to && formData.valid_to < today;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-indigo-600" />
                        {item ? 'Edit Contract Price' : 'New Contract Price'}
                    </DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }}
                    className="space-y-4"
                >
                    {isExpired && (
                        <div className="bg-orange-50 border border-orange-200 rounded p-2 text-sm text-orange-800">
                            This contract price has expired. Set a new Valid To date to reactivate.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect
                            label="Customer *"
                            value={formData.customer_code}
                            onValueChange={handleCustomerSelect}
                            options={customerOptions}
                            placeholder="Select customer..."
                            searchPlaceholder="Search customers..."
                        />
                        <SearchableSelect
                            label="Material *"
                            value={formData.material_code}
                            onValueChange={handleMaterialSelect}
                            options={materialOptions}
                            placeholder="Select material..."
                            searchPlaceholder="Search materials..."
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Price per Unit *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price_per_unit}
                                onChange={(e) => handleChange('price_per_unit', parseFloat(e.target.value) || 0)}
                                required
                            />
                            {formData.unit_of_measure && (
                                <p className="text-xs text-gray-500 mt-1">per {formData.unit_of_measure}</p>
                            )}
                        </div>
                        <div>
                            <Label>Currency</Label>
                            <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LKR">LKR</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                    <SelectItem value="GBP">GBP</SelectItem>
                                    <SelectItem value="JPY">JPY</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Incoterm</Label>
                            <Select
                                value={formData.incoterm || '__none__'}
                                onValueChange={(v) => handleChange('incoterm', v === '__none__' ? '' : v)}
                            >
                                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">None</SelectItem>
                                    <SelectItem value="FOB">FOB</SelectItem>
                                    <SelectItem value="CIF">CIF</SelectItem>
                                    <SelectItem value="CFR">CFR</SelectItem>
                                    <SelectItem value="EXW">EXW</SelectItem>
                                    <SelectItem value="DDP">DDP</SelectItem>
                                    <SelectItem value="DAP">DAP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Min Quantity</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.min_quantity}
                                onChange={(e) => handleChange('min_quantity', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <Label>Valid From *</Label>
                            <Input
                                type="date"
                                value={formData.valid_from}
                                onChange={(e) => handleChange('valid_from', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Valid To</Label>
                            <Input
                                type="date"
                                value={formData.valid_to}
                                onChange={(e) => handleChange('valid_to', e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave blank = no expiry</p>
                        </div>
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                            placeholder="Special terms, packing conditions, etc."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Saving...' : 'Save Contract Price'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
