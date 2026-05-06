import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function ActivityForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: leads = [] } = useQuery({
        queryKey: ['leads'],
        queryFn: () => matrixSales.entities.Lead.list(),
        initialData: []
    });

    const { data: opportunities = [] } = useQuery({
        queryKey: ['opportunities'],
        queryFn: () => matrixSales.entities.Opportunity.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        activity_number: '',
        activity_type: 'call',
        activity_date: new Date().toISOString().slice(0, 16),
        duration_minutes: 30,
        subject: '',
        description: '',
        related_to: 'lead',
        related_number: '',
        company_name: '',
        contact_person: '',
        assigned_to: '',
        outcome: 'pending',
        priority: 'medium',
        status: 'scheduled',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleRelatedSelect = (value) => {
        setFormData(prev => ({ ...prev, related_number: value }));
        
        if (formData.related_to === 'lead') {
            const lead = leads.find(l => l.lead_number === value);
            if (lead) {
                setFormData(prev => ({
                    ...prev,
                    company_name: lead.company_name,
                    contact_person: lead.contact_person
                }));
            }
        } else if (formData.related_to === 'opportunity') {
            const opp = opportunities.find(o => o.opportunity_number === value);
            if (opp) {
                setFormData(prev => ({
                    ...prev,
                    company_name: opp.company_name,
                    contact_person: opp.contact_person
                }));
            }
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.Activity.update(item.id, data);
            }
            return matrixSales.entities.Activity.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activities'] });
            toast({
                title: "Success",
                description: `Activity ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const relatedRecords = formData.related_to === 'lead' ? leads : opportunities;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'Log'} Activity</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Activity Number *</Label>
                            <Input
                                value={formData.activity_number}
                                onChange={(e) => setFormData({...formData, activity_number: e.target.value})}
                                required
                                placeholder="ACT-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>Activity Type *</Label>
                            <Select 
                                value={formData.activity_type} 
                                onValueChange={(val) => setFormData({...formData, activity_type: val})}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="call">Call</SelectItem>
                                    <SelectItem value="meeting">Meeting</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="site_visit">Site Visit</SelectItem>
                                    <SelectItem value="demo">Demo</SelectItem>
                                    <SelectItem value="proposal">Proposal</SelectItem>
                                    <SelectItem value="follow_up">Follow-up</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Activity Date & Time *</Label>
                            <Input
                                type="datetime-local"
                                value={formData.activity_date}
                                onChange={(e) => setFormData({...formData, activity_date: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Duration (minutes)</Label>
                            <Input
                                type="number"
                                value={formData.duration_minutes}
                                onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})}
                                min="0"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Subject *</Label>
                        <Input
                            value={formData.subject}
                            onChange={(e) => setFormData({...formData, subject: e.target.value})}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Related To</Label>
                            <Select 
                                value={formData.related_to} 
                                onValueChange={(val) => setFormData({...formData, related_to: val, related_number: ''})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lead">Lead</SelectItem>
                                    <SelectItem value="opportunity">Opportunity</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Record</Label>
                            <Select 
                                value={formData.related_number} 
                                onValueChange={handleRelatedSelect}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select record" />
                                </SelectTrigger>
                                <SelectContent>
                                    {relatedRecords.map(record => (
                                        <SelectItem 
                                            key={record.id} 
                                            value={formData.related_to === 'lead' ? record.lead_number : record.opportunity_number}
                                        >
                                            {formData.related_to === 'lead' ? record.lead_number : record.opportunity_number} - {record.company_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Assigned To *</Label>
                            <Input
                                value={formData.assigned_to}
                                onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                                required
                            />
                        </div>
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
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Outcome</Label>
                            <Select 
                                value={formData.outcome} 
                                onValueChange={(val) => setFormData({...formData, outcome: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="successful">Successful</SelectItem>
                                    <SelectItem value="no_answer">No Answer</SelectItem>
                                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                    <SelectItem value="not_interested">Not Interested</SelectItem>
                                    <SelectItem value="follow_up_required">Follow-up Required</SelectItem>
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

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Log'} Activity
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}