import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function CAPAForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        capa_number: '',
        capa_date: new Date().toISOString().split('T')[0],
        capa_type: 'corrective',
        source: 'non_conformance',
        source_reference: '',
        problem_description: '',
        root_cause_analysis: '',
        corrective_action: '',
        preventive_action: '',
        assigned_to: '',
        target_date: new Date().toISOString().split('T')[0],
        effectiveness_result: 'pending',
        priority: 'medium',
        status: 'open'
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.CAPA.update(item.id, data);
            }
            return base44.entities.CAPA.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['capas'] });
            toast({
                title: "Success",
                description: `CAPA ${item ? 'updated' : 'created'} successfully`
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit CAPA' : 'New CAPA'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>CAPA Number *</Label>
                            <Input
                                value={formData.capa_number}
                                onChange={(e) => setFormData({...formData, capa_number: e.target.value})}
                                required
                                placeholder="CAPA-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>CAPA Date *</Label>
                            <Input
                                type="date"
                                value={formData.capa_date}
                                onChange={(e) => setFormData({...formData, capa_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>CAPA Type *</Label>
                            <Select 
                                value={formData.capa_type} 
                                onValueChange={(val) => setFormData({...formData, capa_type: val})}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="corrective">Corrective</SelectItem>
                                    <SelectItem value="preventive">Preventive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Source *</Label>
                            <Select 
                                value={formData.source} 
                                onValueChange={(val) => setFormData({...formData, source: val})}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="non_conformance">Non-Conformance</SelectItem>
                                    <SelectItem value="audit">Audit</SelectItem>
                                    <SelectItem value="customer_complaint">Customer Complaint</SelectItem>
                                    <SelectItem value="management_review">Management Review</SelectItem>
                                    <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Source Reference</Label>
                        <Input
                            value={formData.source_reference}
                            onChange={(e) => setFormData({...formData, source_reference: e.target.value})}
                            placeholder="NC number / Audit number"
                        />
                    </div>

                    <div>
                        <Label>Problem Description *</Label>
                        <Textarea
                            value={formData.problem_description}
                            onChange={(e) => setFormData({...formData, problem_description: e.target.value})}
                            rows={3}
                            required
                        />
                    </div>

                    <div>
                        <Label>Root Cause Analysis</Label>
                        <Textarea
                            value={formData.root_cause_analysis}
                            onChange={(e) => setFormData({...formData, root_cause_analysis: e.target.value})}
                            rows={3}
                            placeholder="5 Why / Fishbone analysis"
                        />
                    </div>

                    <div>
                        <Label>Corrective Action</Label>
                        <Textarea
                            value={formData.corrective_action}
                            onChange={(e) => setFormData({...formData, corrective_action: e.target.value})}
                            rows={3}
                        />
                    </div>

                    <div>
                        <Label>Preventive Action</Label>
                        <Textarea
                            value={formData.preventive_action}
                            onChange={(e) => setFormData({...formData, preventive_action: e.target.value})}
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Assigned To *</Label>
                            <Input
                                value={formData.assigned_to}
                                onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Target Date *</Label>
                            <Input
                                type="date"
                                value={formData.target_date}
                                onChange={(e) => setFormData({...formData, target_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Priority</Label>
                            <Select 
                                value={formData.priority} 
                                onValueChange={(val) => setFormData({...formData, priority: val})}
                            >
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
                        <div>
                            <Label>Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => setFormData({...formData, status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Effectiveness</Label>
                            <Select 
                                value={formData.effectiveness_result} 
                                onValueChange={(val) => setFormData({...formData, effectiveness_result: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="effective">Effective</SelectItem>
                                    <SelectItem value="ineffective">Ineffective</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : item ? 'Update' : 'Create'} CAPA
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}