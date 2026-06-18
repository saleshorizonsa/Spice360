
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
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { createNotification } from "../utils/notificationService";
import { RefreshCw } from "lucide-react";

export default function PurchaseRequisitionForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    useEffect(() => {
        matrixSales.auth.me().then(u => setCurrentUser(u)).catch(() => {});
    }, []);

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters'],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        pr_number: '',
        pr_date: new Date().toISOString().split('T')[0],
        requested_by: '',
        department: '',
        cost_center: '',
        material_code: '',
        material_name: '',
        quantity_required: 0,
        unit_of_measure: 'kg',
        required_date: '',
        estimated_cost: 0,
        purpose: '',
        priority: 'medium',
        status: 'draft',
        notes: ''
    });

    const generatePRNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('purchase_requisition');
            setFormData(prev => ({ ...prev, pr_number: number }));
        } catch (error) {
            console.error("Error generating PR number:", error);
            toast({
                title: "Warning",
                description: "Could not auto-generate PR number. Please enter manually.",
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
            generatePRNumber();
        }
    }, [item]);

    const handleMaterialSelect = (materialCode) => {
        const material = materials.find(m => m.material_code === materialCode);
        if (material) {
            setFormData(prev => ({
                ...prev,
                material_code: materialCode,
                material_name: material.material_name,
                unit_of_measure: material.unit_of_measure
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const prevStatus = item?.status;
            let pr;
            if (item) {
                pr = await matrixSales.entities.PurchaseRequisition.update(item.id, data);
            } else {
                pr = await matrixSales.entities.PurchaseRequisition.create(data);
            }

            // Auto-create RFQ draft when PR transitions to approved (non-fatal)
            const isApproval = prevStatus !== 'approved' && data.status === 'approved';
            if (isApproval) {
                try {
                    const rfqNumber = await getNextDocumentNumber('rfq');
                    const closingDate = data.required_date ||
                        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    await matrixSales.entities.RFQ.create({
                        rfq_number:        rfqNumber,
                        rfq_date:          new Date().toISOString().slice(0, 10),
                        pr_reference:      data.pr_number,
                        material_code:     data.material_code,
                        material_name:     data.material_name,
                        quantity:          data.quantity_required,
                        unit_of_measure:   data.unit_of_measure,
                        required_date:     data.required_date,
                        closing_date:      closingDate,
                        suppliers_invited: [],
                        specifications:    data.purpose || '',
                        status:            'draft',
                        notes:             `Auto-created from PR ${data.pr_number}`,
                    });
                    await matrixSales.entities.PurchaseRequisition.update(pr.id, { status: 'converted_to_rfq' });
                    toast({ title: "RFQ Auto-Created", description: `${rfqNumber} created as draft in Purchasing` });
                    if (currentUser?.email) {
                        createNotification({ userEmail: currentUser.email, notificationType: 'rfq_auto_created', priority: 'medium', title: 'RFQ Auto-Created', message: `${rfqNumber} was automatically created from PR ${data.pr_number}`, relatedEntity: 'RFQ', relatedDocumentNumber: rfqNumber, actionUrl: '/Purchasing' }).catch(() => {});
                    }
                } catch (_) { /* non-fatal */ }
            }

            return pr;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requisitions'] });
            queryClient.invalidateQueries({ queryKey: ['rfqs'] });
            toast({
                title: "Success",
                description: `Purchase requisition ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            console.error("Error saving purchase requisition:", error);
            toast({
                title: "Error",
                description: `Failed to save purchase requisition: ${error.message || 'Unknown error'}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="pr_number">PR Number *</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="pr_number"
                                    value={formData.pr_number}
                                    onChange={(e) => handleChange('pr_number', e.target.value)}
                                    required
                                    disabled={isGeneratingNumber}
                                    placeholder="PR-2025-0001"
                                />
                                {!item && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generatePRNumber}
                                        disabled={isGeneratingNumber}
                                        aria-label="Generate PR Number"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="pr_date">PR Date *</Label>
                            <Input
                                id="pr_date"
                                type="date"
                                value={formData.pr_date}
                                onChange={(e) => handleChange('pr_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="requested_by">Requested By *</Label>
                            <Input
                                id="requested_by"
                                value={formData.requested_by}
                                onChange={(e) => handleChange('requested_by', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="department">Department</Label>
                            <Input
                                id="department"
                                value={formData.department}
                                onChange={(e) => handleChange('department', e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="cost_center_select">Cost Center</Label>
                        <Select 
                            value={formData.cost_center} 
                            onValueChange={(val) => handleChange('cost_center', val)}
                        >
                            <SelectTrigger id="cost_center_select">
                                <SelectValue placeholder="Select cost center" />
                            </SelectTrigger>
                            <SelectContent>
                                {costCenters.map(cc => (
                                    <SelectItem key={cc.id} value={cc.cost_center_code}>
                                        {cc.cost_center_code} - {cc.cost_center_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="material_select">Material *</Label>
                        <Select 
                            value={formData.material_code} 
                            onValueChange={handleMaterialSelect}
                            required
                        >
                            <SelectTrigger id="material_select">
                                <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                                {materials.map(m => (
                                    <SelectItem key={m.id} value={m.material_code}>
                                        {m.material_code} - {m.material_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="quantity_required">Quantity Required *</Label>
                            <Input
                                id="quantity_required"
                                type="number"
                                value={formData.quantity_required}
                                onChange={(e) => handleChange('quantity_required', parseFloat(e.target.value))}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                            <Input
                                id="unit_of_measure"
                                value={formData.unit_of_measure}
                                disabled
                            />
                        </div>
                        <div>
                            <Label htmlFor="estimated_cost">Estimated Cost (LKR)</Label>
                            <Input
                                id="estimated_cost"
                                type="number"
                                value={formData.estimated_cost}
                                onChange={(e) => handleChange('estimated_cost', parseFloat(e.target.value))}
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="required_date">Required Date *</Label>
                            <Input
                                id="required_date"
                                type="date"
                                value={formData.required_date}
                                onChange={(e) => handleChange('required_date', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="priority_select">Priority</Label>
                            <Select 
                                value={formData.priority} 
                                onValueChange={(val) => handleChange('priority', val)}
                            >
                                <SelectTrigger id="priority_select">
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
                    </div>

                    <div>
                        <Label htmlFor="purpose">Purpose</Label>
                        <Textarea
                            id="purpose"
                            value={formData.purpose}
                            onChange={(e) => handleChange('purpose', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label htmlFor="status_select">Status</Label>
                        <Select 
                            value={formData.status} 
                            onValueChange={(val) => handleChange('status', val)}
                        >
                            <SelectTrigger id="status_select">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="converted_to_rfq">Converted to RFQ</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' PR'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
