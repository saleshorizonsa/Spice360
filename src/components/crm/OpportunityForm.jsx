
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
import { getNextDocumentNumber } from "../utils/documentNumberGenerator"; // Added import

export default function OpportunityForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: leads = [] } = useQuery({
        queryKey: ['leads'],
        queryFn: () => matrixSales.entities.Lead.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        opportunity_number: '',
        opportunity_name: '',
        opportunity_date: new Date().toISOString().split('T')[0],
        lead_number: '',
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        opportunity_type: 'new_business',
        stage: 'qualification',
        probability: 10,
        estimated_value: 0,
        weighted_value: 0,
        expected_close_date: '',
        products: '',
        assigned_to: '',
        status: 'open',
        notes: ''
    });

    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false); // Added state

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateOpportunityNumber(); // Call for new opportunity
        }
    }, [item]);

    // Added function to generate opportunity number
    const generateOpportunityNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('opportunity');
            setFormData(prev => ({ ...prev, opportunity_number: number }));
        } catch (error) {
            console.error("Error generating opportunity number:", error);
            toast({
                title: "Error",
                description: "Failed to generate opportunity number.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    useEffect(() => {
        const weighted = (formData.estimated_value || 0) * (formData.probability || 0) / 100;
        setFormData(prev => ({ ...prev, weighted_value: weighted }));
    }, [formData.estimated_value, formData.probability]);

    const handleLeadSelect = (leadNumber) => {
        const lead = leads.find(l => l.lead_number === leadNumber);
        if (lead) {
            setFormData(prev => ({
                ...prev,
                lead_number: leadNumber,
                company_name: lead.company_name,
                contact_person: lead.contact_person,
                email: lead.email,
                phone: lead.phone,
                estimated_value: lead.estimated_value || 0,
                products: lead.products_interested || ''
            }));
        } else {
             // If lead is unselected or not found, clear lead-related fields but keep estimated value and products
             setFormData(prev => ({
                ...prev,
                lead_number: '',
                company_name: '',
                contact_person: '',
                email: '',
                phone: '',
                // estimated_value: 0, // Decide if estimated value should be reset
                // products: '' // Decide if products should be reset
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const prevStage = item?.stage;
            let opp;
            if (item) {
                opp = await matrixSales.entities.Opportunity.update(item.id, data);
            } else {
                opp = await matrixSales.entities.Opportunity.create(data);
            }

            // Auto-create Sales Order draft when Opportunity closes as Won (non-fatal)
            const isWon = prevStage !== 'closed_won' && data.stage === 'closed_won';
            if (isWon) {
                try {
                    const soNumber = await getNextDocumentNumber('sales_order');
                    await matrixSales.entities.SalesOrder.create({
                        order_number:     soNumber,
                        order_date:       new Date().toISOString().slice(0, 10),
                        customer_name:    data.company_name,
                        customer_contact: data.contact_person || '',
                        customer_email:   data.email || '',
                        customer_phone:   data.phone || '',
                        delivery_date:    data.expected_close_date || '',
                        total_amount:     data.estimated_value || 0,
                        payment_terms:    'net_30',
                        status:           'pending',
                        notes:            `Auto-created from Opportunity ${data.opportunity_number}`,
                    });
                    toast({ title: "Sales Order Created", description: `${soNumber} created as draft in Sales` });
                } catch (_) { /* non-fatal */ }
            }

            return opp;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
            queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
            toast({
                title: "Success",
                description: `Opportunity ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        },
        onError: (error) => {
            console.error("Error saving opportunity:", error);
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} opportunity.`,
                variant: "destructive",
            });
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
                    <DialogTitle>{item ? 'Edit' : 'New'} Opportunity</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Opportunity Number *</Label>
                            <Input
                                value={formData.opportunity_number}
                                onChange={(e) => setFormData({...formData, opportunity_number: e.target.value})}
                                required
                                placeholder="OPP-2025-0001"
                                disabled={item || isGeneratingNumber} // Disable if editing or generating
                            />
                        </div>
                        <div>
                            <Label>Date *</Label>
                            <Input
                                type="date"
                                value={formData.opportunity_date}
                                onChange={(e) => setFormData({...formData, opportunity_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Opportunity Name *</Label>
                        <Input
                            value={formData.opportunity_name}
                            onChange={(e) => setFormData({...formData, opportunity_name: e.target.value})}
                            required
                        />
                    </div>

                    <div>
                        <Label>Source Lead</Label>
                        <Select 
                            value={formData.lead_number || ""} // Ensure value is a string, default to empty for no selection
                            onValueChange={handleLeadSelect}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select lead (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {/* Option to clear selection */}
                                <SelectItem value={null}>No Lead</SelectItem> 
                                {leads.filter(l => l.status !== 'converted').map(lead => (
                                    <SelectItem key={lead.id} value={lead.lead_number}>
                                        {lead.lead_number} - {lead.company_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            <Label>Contact Person</Label>
                            <Input
                                value={formData.contact_person}
                                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Type</Label>
                            <Select 
                                value={formData.opportunity_type} 
                                onValueChange={(val) => setFormData({...formData, opportunity_type: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new_business">New Business</SelectItem>
                                    <SelectItem value="existing_customer">Existing Customer</SelectItem>
                                    <SelectItem value="upsell">Upsell</SelectItem>
                                    <SelectItem value="cross_sell">Cross-sell</SelectItem>
                                    <SelectItem value="renewal">Renewal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Stage *</Label>
                            <Select 
                                value={formData.stage} 
                                onValueChange={(val) => setFormData({...formData, stage: val})}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="qualification">Qualification</SelectItem>
                                    <SelectItem value="needs_analysis">Needs Analysis</SelectItem>
                                    <SelectItem value="proposal">Proposal</SelectItem>
                                    <SelectItem value="negotiation">Negotiation</SelectItem>
                                    <SelectItem value="closed_won">Closed Won</SelectItem>
                                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Probability (%)</Label>
                            <Input
                                type="number"
                                value={formData.probability}
                                onChange={(e) => setFormData({...formData, probability: parseInt(e.target.value) || 0})}
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Estimated Value (LKR) *</Label>
                            <Input
                                type="number"
                                value={formData.estimated_value}
                                onChange={(e) => setFormData({...formData, estimated_value: parseFloat(e.target.value) || 0})}
                                required
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>Weighted Value (LKR)</Label>
                            <Input
                                type="number"
                                value={formData.weighted_value.toFixed(2)}
                                disabled
                            />
                        </div>
                        <div>
                            <Label>Expected Close Date *</Label>
                            <Input
                                type="date"
                                value={formData.expected_close_date}
                                onChange={(e) => setFormData({...formData, expected_close_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Products/Services</Label>
                        <Input
                            value={formData.products}
                            onChange={(e) => setFormData({...formData, products: e.target.value})}
                        />
                    </div>

                    <div>
                        <Label>Assigned To</Label>
                        <Input
                            value={formData.assigned_to}
                            onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                        />
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
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending || isGeneratingNumber}>
                            {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' Opportunity'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
