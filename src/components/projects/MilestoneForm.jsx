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

export default function MilestoneForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        milestone_number: '',
        project_code: '',
        project_name: '',
        milestone_name: '',
        milestone_name_ar: '',
        sequence_number: 1,
        description: '',
        deliverables: '',
        planned_date: '',
        milestone_value: 0,
        retention_percent: 0,
        retention_amount: 0,
        invoice_amount: 0,
        completion_percent: 0,
        acceptance_criteria: '',
        status: 'planned',
        notes: ''
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => base44.entities.Project.list(),
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
                return base44.entities.ProjectMilestone.update(item.id, data);
            }
            return base44.entities.ProjectMilestone.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['milestones'] });
            toast({
                title: "Success",
                description: `Milestone ${item ? 'updated' : 'created'} successfully`
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
            
            // Auto-calculate retention and invoice amounts
            if (field === 'milestone_value' || field === 'retention_percent') {
                const value = updated.milestone_value || 0;
                const retentionPct = updated.retention_percent || 0;
                updated.retention_amount = value * (retentionPct / 100);
                updated.invoice_amount = value - updated.retention_amount;
            }
            
            return updated;
        });
    };

    const handleProjectSelect = (projectCode) => {
        const project = projects.find(p => p.project_code === projectCode);
        if (project) {
            setFormData(prev => ({
                ...prev,
                project_code: projectCode,
                project_name: project.project_name,
                retention_percent: project.retention_percent || 0
            }));
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Project Milestone</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Milestone Number *</Label>
                            <Input
                                value={formData.milestone_number}
                                onChange={(e) => handleChange('milestone_number', e.target.value)}
                                required
                                placeholder="MS-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>Sequence Number *</Label>
                            <Input
                                type="number"
                                value={formData.sequence_number}
                                onChange={(e) => handleChange('sequence_number', parseInt(e.target.value) || 1)}
                                required
                                min="1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Project *</Label>
                        <Select
                            value={formData.project_code}
                            onValueChange={handleProjectSelect}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(project => (
                                    <SelectItem key={project.id} value={project.project_code}>
                                        {project.project_code} - {project.project_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Milestone Name (English) *</Label>
                            <Input
                                value={formData.milestone_name}
                                onChange={(e) => handleChange('milestone_name', e.target.value)}
                                required
                                placeholder="Phase 1 Completion"
                            />
                        </div>
                        <div>
                            <Label>Milestone Name (Arabic)</Label>
                            <Input
                                value={formData.milestone_name_ar}
                                onChange={(e) => handleChange('milestone_name_ar', e.target.value)}
                                placeholder="إنجاز المرحلة الأولى"
                                className="text-right"
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label>Deliverables</Label>
                        <Textarea
                            value={formData.deliverables}
                            onChange={(e) => handleChange('deliverables', e.target.value)}
                            rows={2}
                            placeholder="List of expected deliverables"
                        />
                    </div>

                    <div>
                        <Label>Acceptance Criteria</Label>
                        <Textarea
                            value={formData.acceptance_criteria}
                            onChange={(e) => handleChange('acceptance_criteria', e.target.value)}
                            rows={2}
                            placeholder="Criteria for milestone acceptance"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Planned Completion Date *</Label>
                            <Input
                                type="date"
                                value={formData.planned_date}
                                onChange={(e) => handleChange('planned_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Actual Completion Date</Label>
                            <Input
                                type="date"
                                value={formData.actual_date}
                                onChange={(e) => handleChange('actual_date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Milestone Value (SAR) *</Label>
                            <Input
                                type="number"
                                value={formData.milestone_value}
                                onChange={(e) => handleChange('milestone_value', parseFloat(e.target.value) || 0)}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <Label>Retention Percentage (%)</Label>
                            <Input
                                type="number"
                                value={formData.retention_percent}
                                onChange={(e) => handleChange('retention_percent', parseFloat(e.target.value) || 0)}
                                min="0"
                                max="100"
                                step="0.1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Retention Amount (SAR)</Label>
                            <Input
                                type="number"
                                value={formData.retention_amount}
                                disabled
                                className="bg-gray-100"
                            />
                        </div>
                        <div>
                            <Label>Invoice Amount (SAR)</Label>
                            <Input
                                type="number"
                                value={formData.invoice_amount}
                                disabled
                                className="bg-gray-100"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Completion Percentage (%)</Label>
                            <Input
                                type="number"
                                value={formData.completion_percent}
                                onChange={(e) => handleChange('completion_percent', parseFloat(e.target.value) || 0)}
                                min="0"
                                max="100"
                                step="1"
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
                                    <SelectItem value="planned">Planned</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="accepted">Accepted</SelectItem>
                                    <SelectItem value="invoiced">Invoiced</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Milestone
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}