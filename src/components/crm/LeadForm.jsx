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
import { RefreshCw } from "lucide-react";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";

export default function LeadForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        lead_number: '',
        lead_date: new Date().toISOString().split('T')[0],
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        mobile: '',
        industry: 'manufacturing',
        lead_source: 'website',
        estimated_value: 0,
        products_interested: '',
        requirements: '',
        assigned_to: '',
        lead_score: 50,
        qualification_status: 'new',
        status: 'open',
        notes: ''
    });

    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    const generateLeadNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('lead');
            setFormData(prev => ({ ...prev, lead_number: number }));
        } catch (error) {
            console.error("Error generating lead number:", error);
            toast({
                title: "Error",
                description: "Failed to generate lead number. Please try again or enter manually.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateLeadNumber();
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.Lead.update(item.id, data);
            }
            return base44.entities.Lead.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast({
                title: "Success",
                description: `Lead ${item ? 'updated' : 'created'} successfully`
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Lead</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Lead Number *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.lead_number}
                                    onChange={(e) => setFormData({...formData, lead_number: e.target.value})}
                                    required
                                    placeholder="LEAD-2025-0001"
                                    disabled={isGeneratingNumber || !!item}
                                />
                                {!item && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generateLeadNumber}
                                        disabled={isGeneratingNumber}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label>Lead Date *</Label>
                            <Input
                                type="date"
                                value={formData.lead_date}
                                onChange={(e) => setFormData({...formData, lead_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Company Name *</Label>
                            <Input
                                value={formData.company_name}
                                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Contact Person *</Label>
                            <Input
                                value={formData.contact_person}
                                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Phone *</Label>
                            <Input
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Mobile</Label>
                            <Input
                                value={formData.mobile}
                                onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Industry</Label>
                            <Select 
                                value={formData.industry} 
                                onValueChange={(val) => setFormData({...formData, industry: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                    <SelectItem value="construction">Construction</SelectItem>
                                    <SelectItem value="retail">Retail</SelectItem>
                                    <SelectItem value="services">Services</SelectItem>
                                    <SelectItem value="government">Government</SelectItem>
                                    <SelectItem value="healthcare">Healthcare</SelectItem>
                                    <SelectItem value="education">Education</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Lead Source</Label>
                            <Select 
                                value={formData.lead_source} 
                                onValueChange={(val) => setFormData({...formData, lead_source: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="website">Website</SelectItem>
                                    <SelectItem value="referral">Referral</SelectItem>
                                    <SelectItem value="cold_call">Cold Call</SelectItem>
                                    <SelectItem value="exhibition">Exhibition</SelectItem>
                                    <SelectItem value="social_media">Social Media</SelectItem>
                                    <SelectItem value="email_campaign">Email Campaign</SelectItem>
                                    <SelectItem value="partner">Partner</SelectItem>
                                    <SelectItem value="walk_in">Walk-in</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Estimated Value (SAR)</Label>
                            <Input
                                type="number"
                                value={formData.estimated_value}
                                onChange={(e) => setFormData({...formData, estimated_value: parseFloat(e.target.value) || 0})}
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>Lead Score (0-100)</Label>
                            <Input
                                type="number"
                                value={formData.lead_score}
                                onChange={(e) => setFormData({...formData, lead_score: parseInt(e.target.value) || 0})}
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Products/Services Interested</Label>
                        <Input
                            value={formData.products_interested}
                            onChange={(e) => setFormData({...formData, products_interested: e.target.value})}
                        />
                    </div>

                    <div>
                        <Label>Requirements</Label>
                        <Textarea
                            value={formData.requirements}
                            onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Assigned To</Label>
                            <Input
                                value={formData.assigned_to}
                                onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Qualification Status</Label>
                            <Select 
                                value={formData.qualification_status} 
                                onValueChange={(val) => setFormData({...formData, qualification_status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="qualified">Qualified</SelectItem>
                                    <SelectItem value="unqualified">Unqualified</SelectItem>
                                    <SelectItem value="disqualified">Disqualified</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isGeneratingNumber}>
                            {isGeneratingNumber ? 'Generating Number...' : item ? 'Update' : 'Create'} Lead
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}