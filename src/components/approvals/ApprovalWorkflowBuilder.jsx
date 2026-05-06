import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, MoveUp, MoveDown, CheckCircle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ApprovalWorkflowBuilder({ documentType, onSave }) {
    const [levels, setLevels] = useState([]);
    const [selectedDocType, setSelectedDocType] = useState(documentType || '');

    const { data: existingMatrices = [] } = useQuery({
        queryKey: ['approvalMatrices', selectedDocType],
        queryFn: () => selectedDocType ? 
            base44.entities.ApprovalMatrix.filter({ document_type: selectedDocType, status: 'active' }) : 
            Promise.resolve([]),
        enabled: !!selectedDocType
    });

    React.useEffect(() => {
        if (existingMatrices.length > 0) {
            setLevels(existingMatrices.sort((a, b) => a.approval_level - b.approval_level));
        }
    }, [existingMatrices]);

    const addLevel = () => {
        const newLevel = {
            matrix_id: `AM-${Date.now()}-${levels.length + 1}`,
            document_type: selectedDocType,
            threshold_min: 0,
            threshold_max: null,
            approval_level: levels.length + 1,
            required_role: '',
            is_mandatory: true,
            notification_required: true,
            escalation_hours: 24,
            status: 'active',
            effective_from: new Date().toISOString().split('T')[0]
        };
        setLevels([...levels, newLevel]);
    };

    const removeLevel = (index) => {
        const newLevels = levels.filter((_, i) => i !== index);
        // Resequence levels
        setLevels(newLevels.map((level, idx) => ({
            ...level,
            approval_level: idx + 1
        })));
    };

    const moveLevel = (index, direction) => {
        const newLevels = [...levels];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= newLevels.length) return;
        
        [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];
        
        // Resequence levels
        setLevels(newLevels.map((level, idx) => ({
            ...level,
            approval_level: idx + 1
        })));
    };

    const updateLevel = (index, field, value) => {
        const newLevels = [...levels];
        newLevels[index] = {
            ...newLevels[index],
            [field]: value
        };
        setLevels(newLevels);
    };

    const handleSave = async () => {
        if (onSave) {
            await onSave(levels);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Workflow Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Document Type</Label>
                        <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                                <SelectItem value="journal_entry">Journal Entry</SelectItem>
                                <SelectItem value="leave_request">Leave Request</SelectItem>
                                <SelectItem value="purchase_requisition">Purchase Requisition</SelectItem>
                                <SelectItem value="vendor_invoice">Vendor Invoice</SelectItem>
                                <SelectItem value="payment">Payment</SelectItem>
                                <SelectItem value="expense">Project Expense</SelectItem>
                                <SelectItem value="loan_advance">Loan/Advance</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedDocType && (
                        <Button onClick={addLevel} className="w-full" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Approval Level
                        </Button>
                    )}
                </CardContent>
            </Card>

            {levels.length > 0 && (
                <div className="space-y-4">
                    {levels.map((level, index) => (
                        <Card key={index} className="border-l-4 border-emerald-500">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Badge className="bg-emerald-600">Level {level.approval_level}</Badge>
                                        <span className="font-semibold">
                                            {level.required_role ? level.required_role.replace('_', ' ').toUpperCase() : 'Not Set'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => moveLevel(index, 'up')}
                                            disabled={index === 0}
                                        >
                                            <MoveUp className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => moveLevel(index, 'down')}
                                            disabled={index === levels.length - 1}
                                        >
                                            <MoveDown className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeLevel(index)}
                                            className="text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Min Amount (SAR)</Label>
                                        <Input
                                            type="number"
                                            value={level.threshold_min}
                                            onChange={(e) => updateLevel(index, 'threshold_min', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Max Amount (SAR)</Label>
                                        <Input
                                            type="number"
                                            value={level.threshold_max || ''}
                                            onChange={(e) => updateLevel(index, 'threshold_max', e.target.value ? parseFloat(e.target.value) : null)}
                                            placeholder="Unlimited"
                                        />
                                    </div>
                                    <div>
                                        <Label>Required Role *</Label>
                                        <Select 
                                            value={level.required_role} 
                                            onValueChange={(val) => updateLevel(index, 'required_role', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sales_manager">Sales Manager</SelectItem>
                                                <SelectItem value="commercial_head">Commercial Head</SelectItem>
                                                <SelectItem value="procurement_manager">Procurement Manager</SelectItem>
                                                <SelectItem value="supply_chain_head">Supply Chain Head</SelectItem>
                                                <SelectItem value="controller">Controller</SelectItem>
                                                <SelectItem value="cfo">CFO</SelectItem>
                                                <SelectItem value="hr_manager">HR Manager</SelectItem>
                                                <SelectItem value="production_manager">Production Manager</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <Label className="text-xs">Mandatory</Label>
                                        <Switch
                                            checked={level.is_mandatory}
                                            onCheckedChange={(val) => updateLevel(index, 'is_mandatory', val)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <Label className="text-xs">Notify</Label>
                                        <Switch
                                            checked={level.notification_required}
                                            onCheckedChange={(val) => updateLevel(index, 'notification_required', val)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Escalation (hrs)</Label>
                                        <Input
                                            type="number"
                                            value={level.escalation_hours}
                                            onChange={(e) => updateLevel(index, 'escalation_hours', parseInt(e.target.value) || 24)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    <Button 
                        onClick={handleSave} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        disabled={levels.some(l => !l.required_role)}
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Save Workflow Configuration
                    </Button>
                </div>
            )}

            {selectedDocType && levels.length === 0 && existingMatrices.length === 0 && (
                <Card className="border-dashed border-2">
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No approval levels configured yet</p>
                        <p className="text-sm text-gray-500 mt-1">Click "Add Approval Level" to start building the workflow</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}