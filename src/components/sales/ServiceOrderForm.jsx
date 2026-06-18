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
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ServiceOrderForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const { guardedOpenChange, guardedClose } = useUnsavedChangesWarning(isDirty);

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: () => matrixSales.entities.Customer.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        service_order_number: '',
        customer_code: '',
        customer_name: '',
        service_type: 'installation',
        service_description: '',
        order_date: new Date().toISOString().split('T')[0],
        start_date: '',
        end_date: '',
        billing_type: 'fixed_price',
        total_contract_value: 0,
        currency: 'LKR',
        milestones: [],
        billed_amount: 0,
        assigned_to: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleCustomerSelect = (customerCode) => {
        const customer = customers.find(c => c.customer_code === customerCode);
        if (customer) {
            setFormData(prev => ({
                ...prev,
                customer_code: customerCode,
                customer_name: customer.customer_name
            }));
        }
    };

    const addMilestone = () => {
        setFormData(prev => ({
            ...prev,
            milestones: [
                ...prev.milestones,
                {
                    milestone_number: prev.milestones.length + 1,
                    milestone_description: '',
                    milestone_date: '',
                    milestone_value: 0,
                    completion_percent: 0,
                    status: 'pending'
                }
            ]
        }));
    };

    const removeMilestone = (index) => {
        setFormData(prev => ({
            ...prev,
            milestones: prev.milestones.filter((_, i) => i !== index)
        }));
    };

    const updateMilestone = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            milestones: prev.milestones.map((m, i) => 
                i === index ? { ...m, [field]: value } : m
            )
        }));
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.ServiceOrder.update(item.id, data);
            }
            return matrixSales.entities.ServiceOrder.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['serviceOrders'] });
            toast({
                title: "Success",
                description: `Service order ${item ? 'updated' : 'created'} successfully`,
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
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {item ? 'Edit Service Order' : 'New Service Order'}
                        {formData.billing_type === 'milestone_based' && formData.milestones.length > 0 && (
                            <Badge variant="outline" className="ml-2">
                                {formData.milestones.length} Milestones
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Order Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Order Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Service Order Number *</Label>
                                <Input
                                    value={formData.service_order_number}
                                    onChange={(e) => handleChange('service_order_number', e.target.value)}
                                    required
                                    placeholder="SRV-2025-0001"
                                />
                            </div>
                            <div>
                                <Label>Order Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.order_date}
                                    onChange={(e) => handleChange('order_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Service Type *</Label>
                                <Select 
                                    value={formData.service_type} 
                                    onValueChange={(val) => handleChange('service_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="installation">Installation</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="repair">Repair</SelectItem>
                                        <SelectItem value="consultation">Consultation</SelectItem>
                                        <SelectItem value="training">Training</SelectItem>
                                        <SelectItem value="project">Project</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
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
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Customer Information</h3>
                        <div>
                            <Label>Customer *</Label>
                            <Select
                                value={formData.customer_code}
                                onValueChange={handleCustomerSelect}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select customer..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map(c => (
                                        <SelectItem key={c.id} value={c.customer_code}>
                                            {c.customer_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Service Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Service Details</h3>
                        <div>
                            <Label>Service Description *</Label>
                            <Textarea
                                value={formData.service_description}
                                onChange={(e) => handleChange('service_description', e.target.value)}
                                required
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Start Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => handleChange('start_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => handleChange('end_date', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Assigned To</Label>
                            <Input
                                value={formData.assigned_to}
                                onChange={(e) => handleChange('assigned_to', e.target.value)}
                                placeholder="Technician or team name"
                            />
                        </div>
                    </div>

                    {/* Billing Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Billing Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Billing Type *</Label>
                                <Select 
                                    value={formData.billing_type} 
                                    onValueChange={(val) => handleChange('billing_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed_price">Fixed Price</SelectItem>
                                        <SelectItem value="time_and_material">Time & Material</SelectItem>
                                        <SelectItem value="milestone_based">Milestone Based</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Total Contract Value (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.total_contract_value}
                                    onChange={(e) => handleChange('total_contract_value', parseFloat(e.target.value))}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Billed Amount (LKR)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.billed_amount}
                                onChange={(e) => handleChange('billed_amount', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Milestones */}
                    {formData.billing_type === 'milestone_based' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-lg border-b pb-2 flex-1">Milestones</h3>
                                <Button type="button" onClick={addMilestone} variant="outline" size="sm">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Milestone
                                </Button>
                            </div>

                            {formData.milestones.map((milestone, index) => (
                                <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-semibold">Milestone #{milestone.milestone_number}</h4>
                                        <Button 
                                            type="button" 
                                            onClick={() => removeMilestone(index)}
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <Label>Description</Label>
                                            <Input
                                                value={milestone.milestone_description}
                                                onChange={(e) => updateMilestone(index, 'milestone_description', e.target.value)}
                                                placeholder="Milestone description..."
                                            />
                                        </div>
                                        <div>
                                            <Label>Date</Label>
                                            <Input
                                                type="date"
                                                value={milestone.milestone_date}
                                                onChange={(e) => updateMilestone(index, 'milestone_date', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Value (LKR)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={milestone.milestone_value}
                                                onChange={(e) => updateMilestone(index, 'milestone_value', parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <Label>Completion %</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={milestone.completion_percent}
                                                onChange={(e) => updateMilestone(index, 'completion_percent', parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <Label>Status</Label>
                                            <Select 
                                                value={milestone.status} 
                                                onValueChange={(val) => updateMilestone(index, 'status', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                    <SelectItem value="billed">Billed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Notes</h3>
                        <div>
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={guardedClose(onClose)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Service Order
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}