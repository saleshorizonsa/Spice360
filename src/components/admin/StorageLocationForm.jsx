import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function StorageLocationForm({ item, onClose, open }) {
    const [formData, setFormData] = useState(item || {
        storage_location_code: '',
        storage_location_name: '',
        storage_location_name_ar: '',
        company_code: '',
        plant_code: '',
        location_type: 'warehouse',
        capacity: 0,
        capacity_unit: 'sqm',
        is_temperature_controlled: false,
        allow_negative_stock: false,
        require_batch_management: false,
        require_bin_management: false,
        status: 'active'
    });

    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => base44.entities.Organization.list(),
        initialData: []
    });

    const { data: plants = [] } = useQuery({
        queryKey: ['plants'],
        queryFn: () => base44.entities.Plant.list(),
        initialData: []
    });

    // Filter plants by selected company
    const filteredPlants = formData.company_code 
        ? plants.filter(p => p.company_code === formData.company_code)
        : plants;

    const mutation = useMutation({
        mutationFn: (data) => {
            const plant = plants.find(p => p.plant_code === data.plant_code);
            data.plant_name = plant?.plant_name;
            
            if (item) {
                return base44.entities.StorageLocation.update(item.id, data);
            }
            return base44.entities.StorageLocation.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['storageLocations'] });
            toast({ title: "Success", description: `Storage location ${item ? 'updated' : 'created'}` });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const handleCompanyChange = (companyCode) => {
        setFormData({
            ...formData, 
            company_code: companyCode,
            plant_code: '' // Reset plant when company changes
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Storage Location</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Storage Location Code *</Label>
                            <Input
                                value={formData.storage_location_code}
                                onChange={(e) => setFormData({...formData, storage_location_code: e.target.value})}
                                required
                                disabled={!!item}
                            />
                        </div>
                        <div>
                            <Label>Company *</Label>
                            <Select 
                                value={formData.company_code} 
                                onValueChange={handleCompanyChange}
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
                    </div>

                    <div>
                        <Label>Plant *</Label>
                        <Select 
                            value={formData.plant_code} 
                            onValueChange={(val) => setFormData({...formData, plant_code: val})} 
                            required
                            disabled={!formData.company_code}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={formData.company_code ? "Select plant" : "Select company first"} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredPlants.map(p => (
                                    <SelectItem key={p.id} value={p.plant_code}>
                                        {p.plant_code} - {p.plant_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Storage Location Name *</Label>
                            <Input
                                value={formData.storage_location_name}
                                onChange={(e) => setFormData({...formData, storage_location_name: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Name (Arabic)</Label>
                            <Input
                                value={formData.storage_location_name_ar}
                                onChange={(e) => setFormData({...formData, storage_location_name_ar: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Location Type</Label>
                            <Select value={formData.location_type} onValueChange={(val) => setFormData({...formData, location_type: val})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="warehouse">Warehouse</SelectItem>
                                    <SelectItem value="yard">Yard</SelectItem>
                                    <SelectItem value="cold_storage">Cold Storage</SelectItem>
                                    <SelectItem value="hazmat">Hazmat</SelectItem>
                                    <SelectItem value="transit">Transit</SelectItem>
                                    <SelectItem value="quarantine">Quarantine</SelectItem>
                                    <SelectItem value="scrap">Scrap</SelectItem>
                                    <SelectItem value="finished_goods">Finished Goods</SelectItem>
                                    <SelectItem value="raw_materials">Raw Materials</SelectItem>
                                    <SelectItem value="wip">WIP</SelectItem>
                                </SelectContent>
                            </Select>
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
                                    <SelectItem value="full">Full</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Capacity</Label>
                            <Input
                                type="number"
                                value={formData.capacity}
                                onChange={(e) => setFormData({...formData, capacity: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <Label>Capacity Unit</Label>
                            <Select value={formData.capacity_unit} onValueChange={(val) => setFormData({...formData, capacity_unit: val})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sqm">Square Meters</SelectItem>
                                    <SelectItem value="cbm">Cubic Meters</SelectItem>
                                    <SelectItem value="pallets">Pallets</SelectItem>
                                    <SelectItem value="tons">Tons</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Warehouse Manager</Label>
                            <Input
                                value={formData.warehouse_manager}
                                onChange={(e) => setFormData({...formData, warehouse_manager: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Contact Phone</Label>
                            <Input
                                value={formData.contact_phone}
                                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 p-4 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                            <Label>Temperature Controlled</Label>
                            <Switch
                                checked={formData.is_temperature_controlled}
                                onCheckedChange={(val) => setFormData({...formData, is_temperature_controlled: val})}
                            />
                        </div>
                        {formData.is_temperature_controlled && (
                            <div>
                                <Label>Temperature Range</Label>
                                <Input
                                    value={formData.temperature_range}
                                    onChange={(e) => setFormData({...formData, temperature_range: e.target.value})}
                                    placeholder="e.g., -20°C to +5°C"
                                />
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <Label>Allow Negative Stock</Label>
                            <Switch
                                checked={formData.allow_negative_stock}
                                onCheckedChange={(val) => setFormData({...formData, allow_negative_stock: val})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Require Batch Management</Label>
                            <Switch
                                checked={formData.require_batch_management}
                                onCheckedChange={(val) => setFormData({...formData, require_batch_management: val})}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Require Bin Management</Label>
                            <Switch
                                checked={formData.require_bin_management}
                                onCheckedChange={(val) => setFormData({...formData, require_bin_management: val})}
                            />
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
                            {item ? 'Update' : 'Create'} Location
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}