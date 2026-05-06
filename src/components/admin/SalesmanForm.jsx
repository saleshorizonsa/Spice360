import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function SalesmanForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        salesman_code: '',
        salesman_name: '',
        salesman_name_ar: '',
        employee_number: '',
        email: '',
        phone: '',
        mobile: '',
        territory: '',
        branch_code: '',
        commission_percent: 0,
        monthly_target: 0,
        status: 'active',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.Salesman.update(item.id, data);
            }
            return base44.entities.Salesman.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salesmen'] });
            toast({
                title: "Success",
                description: `Salesman ${item ? 'updated' : 'created'} successfully`,
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
                    <DialogTitle>{item ? 'Edit Salesman' : 'New Salesman'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Salesman Code *</Label>
                                <Input
                                    value={formData.salesman_code}
                                    onChange={(e) => handleChange('salesman_code', e.target.value)}
                                    required
                                    placeholder="SALES-001"
                                />
                            </div>
                            <div>
                                <Label>Employee Number</Label>
                                <Input
                                    value={formData.employee_number}
                                    onChange={(e) => handleChange('employee_number', e.target.value)}
                                    placeholder="EMP-001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Salesman Name (English) *</Label>
                                <Input
                                    value={formData.salesman_name}
                                    onChange={(e) => handleChange('salesman_name', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Salesman Name (Arabic)</Label>
                                <Input
                                    value={formData.salesman_name_ar}
                                    onChange={(e) => handleChange('salesman_name_ar', e.target.value)}
                                    dir="rtl"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Email *</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Phone *</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Mobile</Label>
                                <Input
                                    value={formData.mobile}
                                    onChange={(e) => handleChange('mobile', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Territory</Label>
                                <Input
                                    value={formData.territory}
                                    onChange={(e) => handleChange('territory', e.target.value)}
                                    placeholder="Central Region, Riyadh, etc."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Sales Settings</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Branch Code</Label>
                                <Input
                                    value={formData.branch_code}
                                    onChange={(e) => handleChange('branch_code', e.target.value)}
                                    placeholder="RUH, JED, DMM"
                                />
                            </div>
                            <div>
                                <Label>Commission %</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.commission_percent}
                                    onChange={(e) => handleChange('commission_percent', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Monthly Target (SAR)</Label>
                                <Input
                                    type="number"
                                    value={formData.monthly_target}
                                    onChange={(e) => handleChange('monthly_target', parseFloat(e.target.value) || 0)}
                                />
                            </div>
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
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

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
                            {item ? 'Update' : 'Create'} Salesman
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}