import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function EquipmentForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        equipment_code: '',
        equipment_name: '',
        equipment_type: 'machine',
        manufacturer: '',
        model_number: '',
        installation_date: new Date().toISOString().split('T')[0],
        location_code: '',
        location_name: '',
        criticality: 'medium',
        maintenance_strategy: 'preventive',
        operating_hours: 0,
        status: 'operational',
        responsible_person: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Equipment.update(item.id, data);
            }
            return matrixSales.entities.Equipment.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['equipment'] });
            toast({
                title: "Success",
                description: "Equipment saved successfully"
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
                    <DialogTitle>{item ? 'Edit' : 'New'} Equipment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Equipment Code</Label>
                            <Input
                                value={formData.equipment_code}
                                onChange={(e) => setFormData({...formData, equipment_code: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Equipment Name</Label>
                            <Input
                                value={formData.equipment_name}
                                onChange={(e) => setFormData({...formData, equipment_name: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Equipment Type</Label>
                            <Select
                                value={formData.equipment_type}
                                onValueChange={(value) => setFormData({...formData, equipment_type: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="machine">Machine</SelectItem>
                                    <SelectItem value="vehicle">Vehicle</SelectItem>
                                    <SelectItem value="tool">Tool</SelectItem>
                                    <SelectItem value="facility">Facility</SelectItem>
                                    <SelectItem value="utility">Utility</SelectItem>
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
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
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
                            <Label>Model Number</Label>
                            <Input
                                value={formData.model_number}
                                onChange={(e) => setFormData({...formData, model_number: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Installation Date</Label>
                            <Input
                                type="date"
                                value={formData.installation_date}
                                onChange={(e) => setFormData({...formData, installation_date: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Operating Hours</Label>
                            <Input
                                type="number"
                                value={formData.operating_hours}
                                onChange={(e) => setFormData({...formData, operating_hours: parseFloat(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Location</Label>
                            <Input
                                value={formData.location_name}
                                onChange={(e) => setFormData({...formData, location_name: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Responsible Person</Label>
                            <Input
                                value={formData.responsible_person}
                                onChange={(e) => setFormData({...formData, responsible_person: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Maintenance Strategy</Label>
                            <Select
                                value={formData.maintenance_strategy}
                                onValueChange={(value) => setFormData({...formData, maintenance_strategy: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="preventive">Preventive</SelectItem>
                                    <SelectItem value="predictive">Predictive</SelectItem>
                                    <SelectItem value="reactive">Reactive</SelectItem>
                                    <SelectItem value="condition_based">Condition Based</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) => setFormData({...formData, status: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="operational">Operational</SelectItem>
                                    <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                                    <SelectItem value="down">Down</SelectItem>
                                    <SelectItem value="standby">Standby</SelectItem>
                                    <SelectItem value="retired">Retired</SelectItem>
                                </SelectContent>
                            </Select>
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