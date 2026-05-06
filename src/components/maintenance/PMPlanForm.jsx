import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function PMPlanForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        pm_plan_code: '',
        pm_plan_name: '',
        equipment_code: '',
        equipment_name: '',
        maintenance_type: 'preventive',
        frequency_type: 'time_based',
        frequency_value: 30,
        frequency_unit: 'days',
        estimated_duration_hours: 2,
        task_description: '',
        auto_generate_wo: true,
        advance_notice_days: 7,
        status: 'active'
    });

    const { data: equipment = [] } = useQuery({
        queryKey: ['equipment'],
        queryFn: () => matrixSales.entities.Equipment.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.PMPlan.update(item.id, data);
            }
            return matrixSales.entities.PMPlan.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pmPlans'] });
            toast({
                title: "Success",
                description: "PM Plan saved successfully"
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
                    <DialogTitle>{item ? 'Edit' : 'New'} PM Plan</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>PM Plan Code</Label>
                            <Input
                                value={formData.pm_plan_code}
                                onChange={(e) => setFormData({...formData, pm_plan_code: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>PM Plan Name</Label>
                            <Input
                                value={formData.pm_plan_name}
                                onChange={(e) => setFormData({...formData, pm_plan_name: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Equipment</Label>
                        <Select
                            value={formData.equipment_code}
                            onValueChange={(value) => {
                                const selectedEquip = equipment.find(e => e.equipment_code === value);
                                setFormData({
                                    ...formData, 
                                    equipment_code: value,
                                    equipment_name: selectedEquip?.equipment_name || ''
                                });
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                            <SelectContent>
                                {equipment.map(e => (
                                    <SelectItem key={e.equipment_code} value={e.equipment_code}>
                                        {e.equipment_code} - {e.equipment_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Maintenance Type</Label>
                            <Select
                                value={formData.maintenance_type}
                                onValueChange={(value) => setFormData({...formData, maintenance_type: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="preventive">Preventive</SelectItem>
                                    <SelectItem value="predictive">Predictive</SelectItem>
                                    <SelectItem value="inspection">Inspection</SelectItem>
                                    <SelectItem value="calibration">Calibration</SelectItem>
                                    <SelectItem value="lubrication">Lubrication</SelectItem>
                                    <SelectItem value="cleaning">Cleaning</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Frequency Type</Label>
                            <Select
                                value={formData.frequency_type}
                                onValueChange={(value) => setFormData({...formData, frequency_type: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="time_based">Time Based</SelectItem>
                                    <SelectItem value="usage_based">Usage Based</SelectItem>
                                    <SelectItem value="condition_based">Condition Based</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Frequency Value</Label>
                            <Input
                                type="number"
                                value={formData.frequency_value}
                                onChange={(e) => setFormData({...formData, frequency_value: parseInt(e.target.value)})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Frequency Unit</Label>
                            <Select
                                value={formData.frequency_unit}
                                onValueChange={(value) => setFormData({...formData, frequency_unit: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="weeks">Weeks</SelectItem>
                                    <SelectItem value="months">Months</SelectItem>
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="cycles">Cycles</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Duration (Hours)</Label>
                            <Input
                                type="number"
                                value={formData.estimated_duration_hours}
                                onChange={(e) => setFormData({...formData, estimated_duration_hours: parseFloat(e.target.value)})}
                                step="0.5"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Task Description</Label>
                        <Textarea
                            value={formData.task_description}
                            onChange={(e) => setFormData({...formData, task_description: e.target.value})}
                            rows={4}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={formData.auto_generate_wo}
                            onCheckedChange={(checked) => setFormData({...formData, auto_generate_wo: checked})}
                        />
                        <Label>Auto-generate Work Orders</Label>
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