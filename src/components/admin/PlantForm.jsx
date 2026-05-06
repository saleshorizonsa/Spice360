import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function PlantForm({ item, onClose, open }) {
    const [formData, setFormData] = useState(item || {
        plant_code: '',
        plant_name: '',
        plant_name_ar: '',
        plant_type: 'manufacturing',
        company_code: '',
        address: '',
        city: '',
        country: 'Saudi Arabia',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        is_production_plant: false,
        is_storage_plant: true,
        status: 'active'
    });

    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => matrixSales.entities.Organization.list(),
        initialData: []
    });

    const mutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Plant.update(item.id, data);
            }
            return matrixSales.entities.Plant.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            toast({ title: "Success", description: `Plant ${item ? 'updated' : 'created'}` });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Plant</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Plant Code *</Label>
                            <Input
                                value={formData.plant_code}
                                onChange={(e) => setFormData({...formData, plant_code: e.target.value})}
                                required
                                disabled={!!item}
                            />
                        </div>
                        <div>
                            <Label>Plant Type</Label>
                            <Select value={formData.plant_type} onValueChange={(val) => setFormData({...formData, plant_type: val})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                    <SelectItem value="warehouse">Warehouse</SelectItem>
                                    <SelectItem value="distribution_center">Distribution Center</SelectItem>
                                    <SelectItem value="office">Office</SelectItem>
                                    <SelectItem value="mixed">Mixed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Plant Name *</Label>
                            <Input
                                value={formData.plant_name}
                                onChange={(e) => setFormData({...formData, plant_name: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Plant Name (Arabic)</Label>
                            <Input
                                value={formData.plant_name_ar}
                                onChange={(e) => setFormData({...formData, plant_name_ar: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Company *</Label>
                        <Select 
                            value={formData.company_code} 
                            onValueChange={(val) => setFormData({...formData, company_code: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                                {organizations.map(org => (
                                    <SelectItem key={org.id} value={org.company_code}>
                                        {org.company_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Address</Label>
                        <Textarea
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>City</Label>
                            <Input
                                value={formData.city}
                                onChange={(e) => setFormData({...formData, city: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Country</Label>
                            <Input
                                value={formData.country}
                                onChange={(e) => setFormData({...formData, country: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Contact Person</Label>
                            <Input
                                value={formData.contact_person}
                                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Contact Phone</Label>
                            <Input
                                value={formData.contact_phone}
                                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Contact Email</Label>
                            <Input
                                type="email"
                                value={formData.contact_email}
                                onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                            <Label>Production Enabled</Label>
                            <Switch
                                checked={formData.is_production_plant}
                                onCheckedChange={(val) => setFormData({...formData, is_production_plant: val})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Storage Enabled</Label>
                            <Switch
                                checked={formData.is_storage_plant}
                                onCheckedChange={(val) => setFormData({...formData, is_storage_plant: val})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Cost Center</Label>
                            <Input
                                value={formData.cost_center}
                                onChange={(e) => setFormData({...formData, cost_center: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="under_construction">Under Construction</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-emerald-600">
                            {item ? 'Update' : 'Create'} Plant
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}