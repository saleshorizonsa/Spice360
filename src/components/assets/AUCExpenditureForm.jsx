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
import { useOrganization } from "../utils/OrganizationContext";
import { Receipt } from "lucide-react";
import { logAuditTrail } from "../utils/auditTrail";

export default function AUCExpenditureForm({ aucNumber, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [currentUser, setCurrentUser] = useState(null);
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: aucs = [] } = useQuery({
        queryKey: ['aucs', currentOrg?.id],
        queryFn: () => matrixSales.entities.AssetUnderConstruction.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        expenditure_id: `EXP-${Date.now()}`,
        auc_number: aucNumber || '',
        auc_name: '',
        expenditure_date: new Date().toISOString().split('T')[0],
        expenditure_type: 'materials',
        description: '',
        vendor_name: '',
        invoice_number: '',
        po_number: '',
        amount: 0,
        vat_amount: 0,
        total_amount: 0,
        payment_status: 'pending',
        payment_date: '',
        gl_account: '',
        gl_posted: false,
        journal_entry_number: '',
        cost_center: '',
        approved_by: '',
        notes: ''
    });

    useEffect(() => {
        if (aucNumber) {
            const auc = aucs.find(a => a.auc_number === aucNumber);
            if (auc) {
                setFormData(prev => ({
                    ...prev,
                    auc_number: aucNumber,
                    auc_name: auc.auc_name,
                    cost_center: auc.cost_center
                }));
            }
        }
    }, [aucNumber, aucs]);

    useEffect(() => {
        const vat = formData.amount * 0.15;
        const total = formData.amount + vat;
        setFormData(prev => ({
            ...prev,
            vat_amount: vat,
            total_amount: total
        }));
    }, [formData.amount]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const expenditure = await matrixSales.entities.AUCExpenditure.create(data);
            
            // Update AUC total actual cost
            const auc = aucs.find(a => a.auc_number === data.auc_number);
            if (auc) {
                const updatedCost = {
                    total_actual_cost: (auc.total_actual_cost || 0) + data.total_amount
                };
                
                // Update specific cost category
                if (data.expenditure_type === 'materials') {
                    updatedCost.materials_cost = (auc.materials_cost || 0) + data.total_amount;
                } else if (data.expenditure_type === 'labor') {
                    updatedCost.labor_cost = (auc.labor_cost || 0) + data.total_amount;
                } else if (data.expenditure_type === 'contractor') {
                    updatedCost.contractor_cost = (auc.contractor_cost || 0) + data.total_amount;
                } else {
                    updatedCost.other_costs = (auc.other_costs || 0) + data.total_amount;
                }
                
                await matrixSales.entities.AssetUnderConstruction.update(auc.id, updatedCost);
            }
            
            await logAuditTrail({
                entityType: 'auc_expenditure',
                entityId: expenditure.id,
                documentNumber: data.expenditure_id,
                actionType: 'create',
                afterData: data,
                user: currentUser,
                severity: data.amount > 50000 ? 'warning' : 'info',
                relatedDocumentType: 'auc',
                relatedDocumentId: data.auc_number
            });

            return expenditure;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['aucExpenditures'] });
            queryClient.invalidateQueries({ queryKey: ['aucs'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: "AUC expenditure recorded",
            });
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

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-emerald-600" />
                        Record AUC Expenditure
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Expenditure Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Expenditure ID *</Label>
                                <Input
                                    value={formData.expenditure_id}
                                    onChange={(e) => handleChange('expenditure_id', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Expenditure Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.expenditure_date}
                                    onChange={(e) => handleChange('expenditure_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label>AUC Project</Label>
                            <Input
                                value={`${formData.auc_number} - ${formData.auc_name}`}
                                disabled
                                className="bg-gray-50"
                            />
                        </div>

                        <div>
                            <Label>Expenditure Type *</Label>
                            <Select 
                                value={formData.expenditure_type} 
                                onValueChange={(val) => handleChange('expenditure_type', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="materials">Materials</SelectItem>
                                    <SelectItem value="labor">Labor</SelectItem>
                                    <SelectItem value="contractor">Contractor Payments</SelectItem>
                                    <SelectItem value="equipment_rental">Equipment Rental</SelectItem>
                                    <SelectItem value="permits">Permits & Licenses</SelectItem>
                                    <SelectItem value="professional_fees">Professional Fees</SelectItem>
                                    <SelectItem value="overhead">Overhead Allocation</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Description *</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                required
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Vendor & Invoice</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Vendor Name</Label>
                                <Input
                                    value={formData.vendor_name}
                                    onChange={(e) => handleChange('vendor_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Invoice Number</Label>
                                <Input
                                    value={formData.invoice_number}
                                    onChange={(e) => handleChange('invoice_number', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>PO Number</Label>
                                <Input
                                    value={formData.po_number}
                                    onChange={(e) => handleChange('po_number', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Amount</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Amount (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>VAT Amount (15%)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.vat_amount}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label>Total Amount</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.total_amount}
                                    disabled
                                    className="bg-gray-50 font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Payment Status</Label>
                                <Select 
                                    value={formData.payment_status} 
                                    onValueChange={(val) => handleChange('payment_status', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Payment Date</Label>
                                <Input
                                    type="date"
                                    value={formData.payment_date}
                                    onChange={(e) => handleChange('payment_date', e.target.value)}
                                />
                            </div>
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

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            Record Expenditure
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}