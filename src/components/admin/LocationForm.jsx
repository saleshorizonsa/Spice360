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

export default function LocationForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        location_code: '',
        location_name: '',
        location_type: 'warehouse',
        address: '',
        city: '',
        state: '',
        country: 'Saudi Arabia',
        capacity: '',
        manager_name: '',
        phone: '',
        is_default: false,
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
                return base44.entities.Location.update(item.id, data);
            }
            return base44.entities.Location.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['locations'] });
            toast({
                title: "Success",
                description: `Location ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (window.confirm(`Are you sure you want to ${item ? 'update' : 'create'} this location?`)) {
            saveMutation.mutate(formData);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Location' : 'New Location'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Location Code *</Label>
                                <Input
                                    value={formData.location_code}
                                    onChange={(e) => handleChange('location_code', e.target.value)}
                                    required
                                    placeholder="LOC-001"
                                />
                            </div>
                            <div>
                                <Label>Location Name *</Label>
                                <Input
                                    value={formData.location_name}
                                    onChange={(e) => handleChange('location_name', e.target.value)}
                                    required
                                    placeholder="Main Warehouse"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Location Type *</Label>
                                <Select 
                                    value={formData.location_type} 
                                    onValueChange={(val) => handleChange('location_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="warehouse">Warehouse</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                        <SelectItem value="showroom">Showroom</SelectItem>
                                        <SelectItem value="office">Office</SelectItem>
                                        <SelectItem value="yard">Yard</SelectItem>
                                        <SelectItem value="transit">Transit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Capacity</Label>
                                <Input
                                    value={formData.capacity}
                                    onChange={(e) => handleChange('capacity', e.target.value)}
                                    placeholder="e.g., 10000 sqm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Address</h3>
                        <div>
                            <Label>Street Address</Label>
                            <Input
                                value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder="Full street address"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
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
                            <div>
                                <Label>Country</Label>
                                <Input
                                    value={formData.country}
                                    onChange={(e) => handleChange('country', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Management Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Management</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Manager Name</Label>
                                <Input
                                    value={formData.manager_name}
                                    onChange={(e) => handleChange('manager_name', e.target.value)}
                                    placeholder="Location manager"
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder="Contact phone"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    checked={formData.is_default}
                                    onCheckedChange={(val) => handleChange('is_default', val)}
                                />
                                <Label>Set as Default Location</Label>
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
                                        <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
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
                            placeholder="Additional information about this location"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Location
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}