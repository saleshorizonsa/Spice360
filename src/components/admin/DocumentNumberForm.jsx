import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

export default function DocumentNumberForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        document_type: '',
        prefix: '',
        current_number: 0,
        starting_number: 1,
        padding: 4,
        separator: '-',
        include_year: true,
        include_month: false,
        example_format: '',
        status: 'active',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        // Generate example format
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const number = String(formData.starting_number).padStart(formData.padding, '0');
        
        let example = formData.prefix;
        if (formData.include_year) {
            example += `${formData.separator}${year}`;
        }
        if (formData.include_month) {
            example += `${formData.separator}${month}`;
        }
        example += `${formData.separator}${number}`;
        
        setFormData(prev => ({ ...prev, example_format: example }));
    }, [formData.prefix, formData.separator, formData.include_year, formData.include_month, formData.padding, formData.starting_number]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.DocumentNumberSeries.update(item.id, data);
            }
            return base44.entities.DocumentNumberSeries.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documentSeries'] });
            toast({
                title: "Success",
                description: `Document number series ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Document Number Series' : 'New Document Number Series'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Document Configuration</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Document Type *</Label>
                                <Select 
                                    value={formData.document_type} 
                                    onValueChange={(val) => handleChange('document_type', val)}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select document type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="quotation">Quotation</SelectItem>
                                        <SelectItem value="sales_order">Sales Order</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                        <SelectItem value="invoice">Invoice</SelectItem>
                                        <SelectItem value="purchase_order">Purchase Order</SelectItem>
                                        <SelectItem value="production_order">Production Order</SelectItem>
                                        <SelectItem value="quality_inspection">Quality Inspection</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="financial_transaction">Financial Transaction</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Prefix *</Label>
                                <Input
                                    value={formData.prefix}
                                    onChange={(e) => handleChange('prefix', e.target.value.toUpperCase())}
                                    placeholder="e.g., QT, SO, INV"
                                    required
                                />
                            </div>

                            <div>
                                <Label>Separator</Label>
                                <Input
                                    value={formData.separator}
                                    onChange={(e) => handleChange('separator', e.target.value)}
                                    placeholder="-"
                                    maxLength={2}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Starting Number</Label>
                                <Input
                                    type="number"
                                    value={formData.starting_number}
                                    onChange={(e) => handleChange('starting_number', parseInt(e.target.value))}
                                    min="1"
                                />
                            </div>

                            <div>
                                <Label>Current Number</Label>
                                <Input
                                    type="number"
                                    value={formData.current_number}
                                    onChange={(e) => handleChange('current_number', parseInt(e.target.value))}
                                    min="0"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Number Padding (Digits)</Label>
                            <Input
                                type="number"
                                value={formData.padding}
                                onChange={(e) => handleChange('padding', parseInt(e.target.value))}
                                min="1"
                                max="10"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Number of digits to display (e.g., 4 = 0001, 5 = 00001)
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Format Options</h3>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Include Year</Label>
                                <p className="text-xs text-gray-500">Add year to document number</p>
                            </div>
                            <Switch
                                checked={formData.include_year}
                                onCheckedChange={(val) => handleChange('include_year', val)}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Include Month</Label>
                                <p className="text-xs text-gray-500">Add month to document number</p>
                            </div>
                            <Switch
                                checked={formData.include_month}
                                onCheckedChange={(val) => handleChange('include_month', val)}
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Label className="text-blue-900 font-semibold mb-2 block">
                            Example Format Preview
                        </Label>
                        <Badge className="bg-blue-600 text-white text-lg py-2 px-4">
                            {formData.example_format || 'Configure settings above'}
                        </Badge>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                            placeholder="Additional notes about this number series..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Number Series
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}