import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function ProjectTaskForm({ item, onClose, projectCode }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        task_code: "",
        project_code: projectCode || "",
        project_name: "",
        task_name: "",
        parent_task_code: "",
        wbs_level: 1,
        task_type: "task",
        assigned_to: "",
        start_date: "",
        end_date: "",
        planned_hours: 0,
        actual_hours: 0,
        remaining_hours: 0,
        completion_percent: 0,
        billable: true,
        billing_rate: 0,
        priority: "medium",
        status: "not_started",
        predecessor_tasks: "",
        description: "",
        notes: ""
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: () => base44.entities.Project.list(),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.list(),
        initialData: []
    });

    const { data: tasks = [] } = useQuery({
        queryKey: ['projectTasks'],
        queryFn: () => base44.entities.ProjectTask.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else if (projectCode) {
            const project = projects.find(p => p.project_code === projectCode);
            setFormData(prev => ({
                ...prev,
                task_code: `TASK-${Date.now()}`,
                project_code: projectCode,
                project_name: project?.project_name || ""
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                task_code: `TASK-${Date.now()}`
            }));
        }
    }, [item, projectCode, projects]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.ProjectTask.update(item.id, data);
            }
            return base44.entities.ProjectTask.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projectTasks'] });
            toast({ title: "Success", description: "Task saved successfully" });
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

    const availableParentTasks = tasks.filter(t => 
        t.project_code === formData.project_code && 
        t.task_code !== formData.task_code
    );

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? "Edit Task" : "New Task"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Task Code *</Label>
                            <Input
                                value={formData.task_code}
                                onChange={(e) => handleChange('task_code', e.target.value)}
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
                            <Label>Task Name *</Label>
                            <Input
                                value={formData.task_name}
                                onChange={(e) => handleChange('task_name', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Task Type</Label>
                            <Select value={formData.task_type} onValueChange={(val) => handleChange('task_type', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="phase">Phase</SelectItem>
                                    <SelectItem value="deliverable">Deliverable</SelectItem>
                                    <SelectItem value="task">Task</SelectItem>
                                    <SelectItem value="milestone">Milestone</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Parent Task</Label>
                            <Select value={formData.parent_task_code} onValueChange={(val) => handleChange('parent_task_code', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>None</SelectItem>
                                    {availableParentTasks.map(t => (
                                        <SelectItem key={t.task_code} value={t.task_code}>
                                            {t.task_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Assigned To</Label>
                            <Select value={formData.assigned_to} onValueChange={(val) => handleChange('assigned_to', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.employee_number} value={e.employee_name}>
                                            {e.employee_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={formData.priority} onValueChange={(val) => handleChange('priority', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
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
                            <Label>End Date *</Label>
                            <Input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => handleChange('end_date', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Planned Hours</Label>
                            <Input
                                type="number"
                                value={formData.planned_hours}
                                onChange={(e) => handleChange('planned_hours', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Actual Hours</Label>
                            <Input
                                type="number"
                                value={formData.actual_hours}
                                onChange={(e) => handleChange('actual_hours', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Completion %</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.completion_percent}
                                onChange={(e) => handleChange('completion_percent', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleChange('status', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="not_started">Not Started</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Billing Rate (SAR/hour)</Label>
                            <Input
                                type="number"
                                value={formData.billing_rate}
                                onChange={(e) => handleChange('billing_rate', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <span>Billable</span>
                                <Switch
                                    checked={formData.billable}
                                    onCheckedChange={(val) => handleChange('billable', val)}
                                />
                            </Label>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600">
                            {item ? "Update" : "Create"} Task
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}