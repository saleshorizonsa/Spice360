
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

export default function CustomerForm({ customer, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        customer_code: '',
        customer_name: '',
        customer_type: 'corporate',
        salesman_code: '',
        salesman_name: '',
        contact_person: '',
        email: '',
        phone: '',
        mobile: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Saudi Arabia',
        tax_id: '',
        credit_limit: 0,
        payment_terms: 'net_30',
        outstanding_balance: 0,
        status: 'active',
        notes: ''
    });

    const { data: salesmen = [] } = useQuery({
        queryKey: ['salesmen'],
        queryFn: () => matrixSales.entities.Salesman.list(),
        initialData: []
    });

    useEffect(() => {
        if (customer) {
            setFormData(customer);
        }
    }, [customer]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (customer) {
                return matrixSales.entities.Customer.update(customer.id, data);
            }
            return matrixSales.entities.Customer.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast({
                title: "Success",
                description: `Customer ${customer ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${customer ? 'update' : 'create'} this customer?`)) {
            saveMutation.mutate(formData);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {customer ? 'Edit Customer' : 'New Customer'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Customer Code *</Label>
                                <Input
                                    value={formData.customer_code}
                                    onChange={(e) => handleChange('customer_code', e.target.value)}
                                    required
                                    placeholder="CUST-001"
                                />
                            </div>
                            <div>
                                <Label>Customer Name *</Label>
                                <Input
                                    value={formData.customer_name}
                                    onChange={(e) => handleChange('customer_name', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Customer Type</Label>
                                <Select 
                                    value={formData.customer_type} 
                                    onValueChange={(val) => handleChange('customer_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="corporate">Corporate</SelectItem>
                                        <SelectItem value="individual">Individual</SelectItem>
                                        <SelectItem value="distributor">Distributor</SelectItem>
                                        <SelectItem value="retailer">Retailer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Assigned Salesman</Label>
                                <Select 
                                    value={formData.salesman_code} 
                                    onValueChange={(val) => {
                                        handleChange('salesman_code', val);
                                        const salesman = salesmen.find(s => s.salesman_code === val);
                                        if (salesman) handleChange('salesman_name', salesman.salesman_name);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select salesman" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {salesmen.filter(s => s.status === 'active').map(salesman => (
                                            <SelectItem key={salesman.salesman_code} value={salesman.salesman_code}>
                                                {salesman.salesman_code} - {salesman.salesman_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tax ID</Label>
                                <Input
                                    value={formData.tax_id}
                                    onChange={(e) => handleChange('tax_id', e.target.value)}
                                    placeholder="Tax registration number"
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

                    {/* Financial Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Financial Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Credit Limit (SAR)</Label>
                                <Input
                                    type="number"
                                    value={formData.credit_limit}
                                    onChange={(e) => handleChange('credit_limit', parseFloat(e.target.value) || 0)}
                                />
                            </div>
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
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {customer ? 'Update' : 'Create'} Customer
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
