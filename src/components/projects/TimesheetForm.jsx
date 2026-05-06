import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function TimesheetForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        timesheet_number: '',
        employee_number: '',
        employee_name: '',
        week_start_date: '',
        week_end_date: '',
        total_hours: 0,
        billable_hours: 0,
        non_billable_hours: 0,
        overtime_hours: 0,
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            // Set default week dates
            const today = new Date();
            const dayOfWeek = today.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(today);
            monday.setDate(today.getDate() + mondayOffset);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            setFormData(prev => ({
                ...prev,
                week_start_date: monday.toISOString().split('T')[0],
                week_end_date: sunday.toISOString().split('T')[0]
            }));
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Timesheet.update(item.id, data);
            }
            return matrixSales.entities.Timesheet.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timesheets'] });
            toast({
                title: "Success",
                description: `Timesheet ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            
            // Auto-calculate totals
            if (['billable_hours', 'non_billable_hours'].includes(field)) {
                updated.total_hours = (parseFloat(updated.billable_hours) || 0) + 
                                     (parseFloat(updated.non_billable_hours) || 0);
            }
            
            return updated;
        });
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Timesheet</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Timesheet Number *</Label>
                            <Input
                                value={formData.timesheet_number}
                                onChange={(e) => handleChange('timesheet_number', e.target.value)}
                                required
                                placeholder="TS-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>Employee Number *</Label>
                            <Input
                                value={formData.employee_number}
                                onChange={(e) => handleChange('employee_number', e.target.value)}
                                required
                                placeholder="EMP-001"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Employee Name *</Label>
                        <Input
                            value={formData.employee_name}
                            onChange={(e) => handleChange('employee_name', e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Week Start Date *</Label>
                            <Input
                                type="date"
                                value={formData.week_start_date}
                                onChange={(e) => handleChange('week_start_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Week End Date *</Label>
                            <Input
                                type="date"
                                value={formData.week_end_date}
                                onChange={(e) => handleChange('week_end_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Billable Hours</Label>
                            <Input
                                type="number"
                                value={formData.billable_hours}
                                onChange={(e) => handleChange('billable_hours', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.25"
                            />
                        </div>
                        <div>
                            <Label>Non-Billable Hours</Label>
                            <Input
                                type="number"
                                value={formData.non_billable_hours}
                                onChange={(e) => handleChange('non_billable_hours', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.25"
                            />
                        </div>
                        <div>
                            <Label>Overtime Hours</Label>
                            <Input
                                type="number"
                                value={formData.overtime_hours}
                                onChange={(e) => handleChange('overtime_hours', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.25"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Total Hours</Label>
                        <Input
                            type="number"
                            value={formData.total_hours}
                            disabled
                            className="bg-gray-100"
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Timesheet
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}