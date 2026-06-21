import React, { useState, useEffect } from "react";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function VendorForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        vendor_code: '',
        vendor_name: '',
        vendor_type: 'manufacturer',
        contact_person: '',
        email: '',
        phone: '',
        mobile: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Sri Lanka',
        tax_id: '',
        payment_terms: 'net_30',
        currency: 'LKR',
        rating: 3,
        status: 'active',
        notes: ''
    });
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Vendor.update(item.id, data);
            }
            return matrixSales.entities.Vendor.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast({
                title: "Success",
                description: `Vendor ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this vendor?`)) {
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
                        {item ? 'Edit Vendor' : 'New Vendor'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Vendor Code *</Label>
                                <Input
                                    value={formData.vendor_code}
                                    onChange={(e) => handleChange('vendor_code', e.target.value)}
                                    required
                                    placeholder="VEND-001"
                                />
                            </div>
                            <div>
                                <Label>Vendor Name *</Label>
                                <Input
                                    value={formData.vendor_name}
                                    onChange={(e) => handleChange('vendor_name', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Vendor Type</Label>
                                <Select 
                                    value={formData.vendor_type} 
                                    onValueChange={(val) => handleChange('vendor_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manufacturer">Manufacturer</SelectItem>
                                        <SelectItem value="distributor">Distributor</SelectItem>
                                        <SelectItem value="service_provider">Service Provider</SelectItem>
                                        <SelectItem value="contractor">Contractor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Tax ID</Label>
                                <Input
                                    value={formData.tax_id}
                                    onChange={(e) => handleChange('tax_id', e.target.value)}
                                    placeholder="Tax registration number"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Contact Person *</Label>
                                <Input
                                    value={formData.contact_person}
                                    onChange={(e) => handleChange('contact_person', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Email *</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Phone *</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Mobile</Label>
                                <Input
                                    value={formData.mobile}
                                    onChange={(e) => handleChange('mobile', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Address</h3>
                        <div>
                            <Label>Street Address</Label>
                            <Input
                                value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>City</Label>
                                <Input
                                    value={formData.city}
                                    onChange={(e) => handleChange('city', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>State/Province</Label>
                                <Input
                                    value={formData.state}
                                    onChange={(e) => handleChange('state', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Postal Code</Label>
                                <Input
                                    value={formData.postal_code}
                                    onChange={(e) => handleChange('postal_code', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Country</Label>
                                <Input
                                    value={formData.country}
                                    onChange={(e) => handleChange('country', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Business Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Business Information</h3>
                        <div className="grid grid-cols-3 gap-4">
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
                                <Label>Rating (1-5)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={formData.rating}
                                    onChange={(e) => handleChange('rating', parseInt(e.target.value) || 3)}
                                />
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
                                        <SelectItem value="blocked">Blocked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Vendor
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}