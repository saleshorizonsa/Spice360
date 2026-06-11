import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function ResourceAllocationForm({ item, onClose, projectCode }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        allocation_id: "",
        project_code: projectCode || "",
        project_name: "",
        employee_number: "",
        employee_name: "",
        role: "",
        allocation_percent: 100,
        start_date: "",
        end_date: "",
        billing_rate: 0,
        cost_rate: 0,
        is_billable: true,
        status: "planned",
        notes: ""
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => matrixSales.entities.Project.list(),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else if (projectCode) {
            const project = projects.find(p => p.project_code === projectCode);
            setFormData(prev => ({
                ...prev,
                allocation_id: `ALLOC-${Date.now()}`,
                project_code: projectCode,
                project_name: project?.project_name || ""
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                allocation_id: `ALLOC-${Date.now()}`
            }));
        }
    }, [item, projectCode, projects]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.ResourceAllocation.update(item.id, data);
            }
            return matrixSales.entities.ResourceAllocation.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['resourceAllocations'] });
            toast({ title: "Success", description: "Resource allocation saved successfully" });
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

    const handleProjectChange = (projectCode) => {
        const project = projects.find(p => p.project_code === projectCode);
        setFormData(prev => ({
            ...prev,
            project_code: projectCode,
            project_name: project?.project_name || ""
        }));
    };

    const handleEmployeeChange = (employeeNumber) => {
        const employee = employees.find(e => e.employee_number === employeeNumber);
        setFormData(prev => ({
            ...prev,
            employee_number: employeeNumber,
            employee_name: employee?.employee_name || ""
        }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? "Edit Resource Allocation" : "New Resource Allocation"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Allocation ID *</Label>
                            <Input
                                value={formData.allocation_id}
                                onChange={(e) => handleChange('allocation_id', e.target.value)}
                                required
                                disabled={!!item}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Project *</Label>
                            <Select value={formData.project_code} onValueChange={handleProjectChange} disabled={!!projectCode || !!item}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.project_code} value={p.project_code}>
                                            {p.project_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Employee *</Label>
                            <Select value={formData.employee_number} onValueChange={handleEmployeeChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.employee_number} value={e.employee_number}>
                                            {e.employee_name} ({e.employee_number})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Role *</Label>
                            <Input
                                value={formData.role}
                                onChange={(e) => handleChange('role', e.target.value)}
                                placeholder="e.g., Developer, Consultant"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Allocation % *</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.allocation_percent}
                                onChange={(e) => handleChange('allocation_percent', parseFloat(e.target.value) || 0)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Start Date *</Label>
                            <Input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => handleChange('start_date', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => handleChange('end_date', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Billing Rate (LKR/hour)</Label>
                            <Input
                                type="number"
                                value={formData.billing_rate}
                                onChange={(e) => handleChange('billing_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Cost Rate (LKR/hour)</Label>
                            <Input
                                type="number"
                                value={formData.cost_rate}
                                onChange={(e) => handleChange('cost_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <span>Billable</span>
                                <Switch
                                    checked={formData.is_billable}
                                    onCheckedChange={(val) => handleChange('is_billable', val)}
                                />
                            </Label>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="planned">Planned</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600">
                            {item ? "Update" : "Create"} Allocation
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}