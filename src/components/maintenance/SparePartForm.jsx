import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function SparePartForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        part_code: '',
        part_name: '',
        part_category: 'mechanical',
        manufacturer: '',
        manufacturer_part_number: '',
        equipment_applicable: '',
        unit_of_measure: 'piece',
        unit_cost: 0,
        current_stock: 0,
        minimum_stock: 0,
        maximum_stock: 0,
        warehouse_code: '',
        bin_location: '',
        lead_time_days: 7,
        criticality: 'normal',
        status: 'active'
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.SparePart.update(item.id, data);
            }
            return matrixSales.entities.SparePart.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spareParts'] });
            toast({
                title: "Success",
                description: "Spare part saved successfully"
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Spare Part</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Part Code</Label>
                            <Input
                                value={formData.part_code}
                                onChange={(e) => setFormData({...formData, part_code: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Part Name</Label>
                            <Input
                                value={formData.part_name}
                                onChange={(e) => setFormData({...formData, part_name: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Category</Label>
                            <Select
                                value={formData.part_category}
                                onValueChange={(value) => setFormData({...formData, part_category: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mechanical">Mechanical</SelectItem>
                                    <SelectItem value="electrical">Electrical</SelectItem>
                                    <SelectItem value="hydraulic">Hydraulic</SelectItem>
                                    <SelectItem value="pneumatic">Pneumatic</SelectItem>
                                    <SelectItem value="electronic">Electronic</SelectItem>
                                    <SelectItem value="consumable">Consumable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Criticality</Label>
                            <Select
                                value={formData.criticality}
                                onValueChange={(value) => setFormData({...formData, criticality: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="critical">Critical</SelectItem>
                                    <SelectItem value="important">Important</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Manufacturer</Label>
                            <Input
                                value={formData.manufacturer}
                                onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Manufacturer Part Number</Label>
                            <Input
                                value={formData.manufacturer_part_number}
                                onChange={(e) => setFormData({...formData, manufacturer_part_number: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Applicable Equipment</Label>
                        <Input
                            value={formData.equipment_applicable}
                            onChange={(e) => setFormData({...formData, equipment_applicable: e.target.value})}
                            placeholder="Equipment codes (comma separated)"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Unit Cost (LKR)</Label>
                            <Input
                                type="number"
                                value={formData.unit_cost}
                                onChange={(e) => setFormData({...formData, unit_cost: parseFloat(e.target.value)})}
                                step="0.01"
                            />
                        </div>
                        <div>
                            <Label>Current Stock</Label>
                            <Input
                                type="number"
                                value={formData.current_stock}
                                onChange={(e) => setFormData({...formData, current_stock: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <Label>Unit of Measure</Label>
                            <Input
                                value={formData.unit_of_measure}
                                onChange={(e) => setFormData({...formData, unit_of_measure: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Minimum Stock</Label>
                            <Input
                                type="number"
                                value={formData.minimum_stock}
                                onChange={(e) => setFormData({...formData, minimum_stock: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <Label>Maximum Stock</Label>
                            <Input
                                type="number"
                                value={formData.maximum_stock}
                                onChange={(e) => setFormData({...formData, maximum_stock: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <Label>Lead Time (Days)</Label>
                            <Input
                                type="number"
                                value={formData.lead_time_days}
                                onChange={(e) => setFormData({...formData, lead_time_days: parseInt(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Warehouse</Label>
                            <Input
                                value={formData.warehouse_code}
                                onChange={(e) => setFormData({...formData, warehouse_code: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Bin Location</Label>
                            <Input
                                value={formData.bin_location}
                                onChange={(e) => setFormData({...formData, bin_location: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}