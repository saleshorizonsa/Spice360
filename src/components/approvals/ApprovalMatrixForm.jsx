import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Shield } from "lucide-react";

export default function ApprovalMatrixForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        matrix_id: '',
        document_type: '',
        threshold_min: 0,
        threshold_max: null,
        approval_level: 1,
        required_role: '',
        is_mandatory: true,
        can_skip_if_maker: false,
        parallel_approval: false,
        auto_approve_threshold: null,
        notification_required: true,
        escalation_hours: 24,
        branch_code: null,
        department: null,
        status: 'active',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: null,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            // Generate matrix_id
            setFormData(prev => ({
                ...prev,
                matrix_id: `AM-${Date.now()}`
            }));
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.ApprovalMatrix.update(item.id, data);
            }
            return base44.entities.ApprovalMatrix.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvalMatrices'] });
            toast({
                title: "Success",
                description: `Approval matrix ${item ? 'updated' : 'created'} successfully`,
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
                        <Shield className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Approval Matrix' : 'New Approval Matrix Rule'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Document & Threshold Configuration */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Rule Configuration</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Document Type *</Label>
                                <Select 
                                    value={formData.document_type} 
                                    onValueChange={(val) => handleChange('document_type', val)}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select document type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="quotation">Quotation</SelectItem>
                                        <SelectItem value="sales_order">Sales Order</SelectItem>
                                        <SelectItem value="purchase_requisition">Purchase Requisition</SelectItem>
                                        <SelectItem value="purchase_order">Purchase Order</SelectItem>
                                        <SelectItem value="vendor_invoice">Vendor Invoice</SelectItem>
                                        <SelectItem value="payment">Payment</SelectItem>
                                        <SelectItem value="journal_entry">Journal Entry</SelectItem>
                                        <SelectItem value="leave_request">Leave Request</SelectItem>
                                        <SelectItem value="expense">Project Expense</SelectItem>
                                        <SelectItem value="timesheet">Timesheet</SelectItem>
                                        <SelectItem value="loan_advance">Loan/Advance</SelectItem>
                                        <SelectItem value="eos_settlement">EOS Settlement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Approval Level *</Label>
                                <Input
                                    type="number"
                                    value={formData.approval_level}
                                    onChange={(e) => handleChange('approval_level', parseInt(e.target.value) || 1)}
                                    min="1"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Sequence of approval (1 = first level)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Minimum Amount (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.threshold_min}
                                    onChange={(e) => handleChange('threshold_min', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            <div>
                                <Label>Maximum Amount (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.threshold_max || ''}
                                    onChange={(e) => handleChange('threshold_max', e.target.value ? parseFloat(e.target.value) : null)}
                                    placeholder="Leave empty for unlimited"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Approver Configuration */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Approver Configuration</h3>
                        
                        <div>
                            <Label>Required Approver Role *</Label>
                            <Select 
                                value={formData.required_role} 
                                onValueChange={(val) => handleChange('required_role', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select required role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sales_exec">Sales Executive</SelectItem>
                                    <SelectItem value="sales_supervisor">Sales Supervisor</SelectItem>
                                    <SelectItem value="sales_manager">Sales Manager</SelectItem>
                                    <SelectItem value="commercial_head">Commercial Head</SelectItem>
                                    <SelectItem value="buyer">Buyer</SelectItem>
                                    <SelectItem value="procurement_manager">Procurement Manager</SelectItem>
                                    <SelectItem value="supply_chain_head">Supply Chain Head</SelectItem>
                                    <SelectItem value="storekeeper">Storekeeper</SelectItem>
                                    <SelectItem value="inventory_controller">Inventory Controller</SelectItem>
                                    <SelectItem value="production_planner">Production Planner</SelectItem>
                                    <SelectItem value="production_manager">Production Manager</SelectItem>
                                    <SelectItem value="qa_lead">QA Lead</SelectItem>
                                    <SelectItem value="maintenance_lead">Maintenance Lead</SelectItem>
                                    <SelectItem value="accountant">Accountant</SelectItem>
                                    <SelectItem value="controller">Controller</SelectItem>
                                    <SelectItem value="cfo">CFO</SelectItem>
                                    <SelectItem value="hr_officer">HR Officer</SelectItem>
                                    <SelectItem value="payroll_admin">Payroll Admin</SelectItem>
                                    <SelectItem value="hr_manager">HR Manager</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Branch Code (Optional)</Label>
                                <Input
                                    value={formData.branch_code || ''}
                                    onChange={(e) => handleChange('branch_code', e.target.value || null)}
                                    placeholder="Leave empty for all branches"
                                />
                            </div>

                            <div>
                                <Label>Department (Optional)</Label>
                                <Select 
                                    value={formData.department || ''} 
                                    onValueChange={(val) => handleChange('department', val || null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All departments" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>All Departments</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                        <SelectItem value="sales">Sales</SelectItem>
                                        <SelectItem value="purchasing">Purchasing</SelectItem>
                                        <SelectItem value="quality">Quality</SelectItem>
                                        <SelectItem value="finance">Finance</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="hr">HR</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Approval Settings */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Approval Settings</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <div>
                                    <Label>Mandatory Approval</Label>
                                    <p className="text-xs text-gray-500">Cannot be skipped</p>
                                </div>
                                <Switch
                                    checked={formData.is_mandatory}
                                    onCheckedChange={(val) => handleChange('is_mandatory', val)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <div>
                                    <Label>Can Skip If Maker</Label>
                                    <p className="text-xs text-gray-500">Skip if maker has authority</p>
                                </div>
                                <Switch
                                    checked={formData.can_skip_if_maker}
                                    onCheckedChange={(val) => handleChange('can_skip_if_maker', val)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <div>
                                    <Label>Parallel Approval</Label>
                                    <p className="text-xs text-gray-500">Multiple approvers at same level</p>
                                </div>
                                <Switch
                                    checked={formData.parallel_approval}
                                    onCheckedChange={(val) => handleChange('parallel_approval', val)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <div>
                                    <Label>Send Notification</Label>
                                    <p className="text-xs text-gray-500">Email approver</p>
                                </div>
                                <Switch
                                    checked={formData.notification_required}
                                    onCheckedChange={(val) => handleChange('notification_required', val)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Escalation Hours</Label>
                                <Input
                                    type="number"
                                    value={formData.escalation_hours}
                                    onChange={(e) => handleChange('escalation_hours', parseInt(e.target.value) || 24)}
                                />
                                <p className="text-xs text-gray-500 mt-1">Escalate if not approved within</p>
                            </div>

                            <div>
                                <Label>Auto-Approve Threshold (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.auto_approve_threshold || ''}
                                    onChange={(e) => handleChange('auto_approve_threshold', e.target.value ? parseFloat(e.target.value) : null)}
                                    placeholder="Leave empty to disable"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Validity Period */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Validity Period</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Effective From *</Label>
                                <Input
                                    type="date"
                                    value={formData.effective_from}
                                    onChange={(e) => handleChange('effective_from', e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <Label>Effective To</Label>
                                <Input
                                    type="date"
                                    value={formData.effective_to || ''}
                                    onChange={(e) => handleChange('effective_to', e.target.value || null)}
                                    placeholder="Leave empty for no expiry"
                                />
                            </div>
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
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                            placeholder="Additional notes about this approval rule..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Matrix Rule
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}