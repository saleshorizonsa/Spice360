import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function WorkCenterForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: locations = [] } = useQuery({
        queryKey: ['locations'],
        queryFn: () => base44.entities.Location.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        work_center_code: '',
        work_center_name: '',
        work_center_type: 'machine',
        location_code: '',
        capacity_per_hour: 0,
        capacity_uom: 'units',
        cost_center: '',
        hourly_rate_sar: 0,
        setup_time_minutes: 0,
        available_from: '08:00',
        available_to: '17:00',
        shift_pattern: 'single',
        operator_name: '',
        status: 'available',
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
                return base44.entities.WorkCenter.update(item.id, data);
            }
            return base44.entities.WorkCenter.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workCenters'] });
            toast({
                title: "Success",
                description: `Work center ${item ? 'updated' : 'created'} successfully`,
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Work Center' : 'New Work Center'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Work Center Code *</Label>
                            <Input 
                                value={formData.work_center_code}
                                onChange={(e) => handleChange('work_center_code', e.target.value)}
                                required
                                placeholder="WC-001"
                            />
                        </div>
                        <div>
                            <Label>Work Center Name *</Label>
                            <Input 
                                value={formData.work_center_name}
                                onChange={(e) => handleChange('work_center_name', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Type *</Label>
                            <Select 
                                value={formData.work_center_type} 
                                onValueChange={(val) => handleChange('work_center_type', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="machine">Machine</SelectItem>
                                    <SelectItem value="labor">Labor</SelectItem>
                                    <SelectItem value="assembly">Assembly</SelectItem>
                                    <SelectItem value="inspection">Inspection</SelectItem>
                                    <SelectItem value="packaging">Packaging</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Location</Label>
                            <Select 
                                value={formData.location_code} 
                                onValueChange={(val) => handleChange('location_code', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(l => (
                                        <SelectItem key={l.id} value={l.location_code}>
                                            {l.location_code} - {l.location_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Capacity/Hour</Label>
                            <Input 
                                type="number"
                                value={formData.capacity_per_hour}
                                onChange={(e) => handleChange('capacity_per_hour', parseFloat(e.target.value) || 0)}
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>Capacity UOM</Label>
                            <Input 
                                value={formData.capacity_uom}
                                onChange={(e) => handleChange('capacity_uom', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Hourly Rate (SAR)</Label>
                            <Input 
                                type="number"
                                value={formData.hourly_rate_sar}
                                onChange={(e) => handleChange('hourly_rate_sar', parseFloat(e.target.value) || 0)}
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Setup Time (min)</Label>
                            <Input 
                                type="number"
                                value={formData.setup_time_minutes}
                                onChange={(e) => handleChange('setup_time_minutes', parseFloat(e.target.value) || 0)}
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>Available From</Label>
                            <Input 
                                type="time"
                                value={formData.available_from}
                                onChange={(e) => handleChange('available_from', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Available To</Label>
                            <Input 
                                type="time"
                                value={formData.available_to}
                                onChange={(e) => handleChange('available_to', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Shift Pattern</Label>
                            <Select 
                                value={formData.shift_pattern} 
                                onValueChange={(val) => handleChange('shift_pattern', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Single</SelectItem>
                                    <SelectItem value="double">Double</SelectItem>
                                    <SelectItem value="triple">Triple</SelectItem>
                                    <SelectItem value="continuous">Continuous</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Primary Operator</Label>
                            <Input 
                                value={formData.operator_name}
                                onChange={(e) => handleChange('operator_name', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Cost Center</Label>
                            <Input 
                                value={formData.cost_center}
                                onChange={(e) => handleChange('cost_center', e.target.value)}
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
                                    <SelectItem value="available">Available</SelectItem>
                                    <SelectItem value="occupied">Occupied</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                    <SelectItem value="down">Down</SelectItem>
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

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Work Center
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}