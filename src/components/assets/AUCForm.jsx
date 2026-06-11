import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "../utils/OrganizationContext";
import { Construction } from "lucide-react";
import { logAuditTrail } from "../utils/auditTrail";

export default function AUCForm({ item, onClose }) {
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

    const { data: locations = [] } = useQuery({
        queryKey: ['locations', currentOrg?.id],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters', currentOrg?.id],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        auc_number: `AUC-${Date.now()}`,
        auc_name: '',
        auc_description: '',
        asset_class: 'building',
        project_code: '',
        start_date: new Date().toISOString().split('T')[0],
        expected_completion_date: '',
        actual_completion_date: '',
        capitalized_date: '',
        total_budgeted_cost: 0,
        total_actual_cost: 0,
        materials_cost: 0,
        labor_cost: 0,
        contractor_cost: 0,
        other_costs: 0,
        location_code: '',
        cost_center: '',
        contractor_name: '',
        contractor_contract_value: 0,
        project_manager: '',
        status: 'planned',
        completion_percentage: 0,
        capitalized_asset_number: '',
        useful_life_years: 0,
        depreciation_method: 'straight_line',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...item });
        }
    }, [item]);

    useEffect(() => {
        const totalActual = (formData.materials_cost || 0) + (formData.labor_cost || 0) + 
                           (formData.contractor_cost || 0) + (formData.other_costs || 0);
        setFormData(prev => ({ ...prev, total_actual_cost: totalActual }));
    }, [formData.materials_cost, formData.labor_cost, formData.contractor_cost, formData.other_costs]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let auc;
            const beforeData = item ? { ...item } : null;

            if (item) {
                auc = await matrixSales.entities.AssetUnderConstruction.update(item.id, data);
                
                await logAuditTrail({
                    entityType: 'auc',
                    entityId: item.id,
                    documentNumber: data.auc_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                auc = await matrixSales.entities.AssetUnderConstruction.create(data);
                
                await logAuditTrail({
                    entityType: 'auc',
                    entityId: auc.id,
                    documentNumber: data.auc_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            }

            return auc;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['aucs'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "AUC updated" : "AUC created",
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

    const costVariance = formData.total_actual_cost - formData.total_budgeted_cost;
    const costVariancePercent = formData.total_budgeted_cost > 0 
        ? (costVariance / formData.total_budgeted_cost) * 100 
        : 0;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Construction className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Asset Under Construction' : 'New Asset Under Construction'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">AUC Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>AUC Number *</Label>
                                <Input
                                    value={formData.auc_number}
                                    onChange={(e) => handleChange('auc_number', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Project Code</Label>
                                <Input
                                    value={formData.project_code}
                                    onChange={(e) => handleChange('project_code', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>AUC Name *</Label>
                            <Input
                                value={formData.auc_name}
                                onChange={(e) => handleChange('auc_name', e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={formData.auc_description}
                                onChange={(e) => handleChange('auc_description', e.target.value)}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Asset Class *</Label>
                                <Select 
                                    value={formData.asset_class} 
                                    onValueChange={(val) => handleChange('asset_class', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="land">Land</SelectItem>
                                        <SelectItem value="building">Building</SelectItem>
                                        <SelectItem value="machinery">Machinery</SelectItem>
                                        <SelectItem value="equipment">Equipment</SelectItem>
                                        <SelectItem value="infrastructure">Infrastructure</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Status *</Label>
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
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="capitalized">Capitalized</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Timeline</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Start Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => handleChange('start_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Expected Completion</Label>
                                <Input
                                    type="date"
                                    value={formData.expected_completion_date}
                                    onChange={(e) => handleChange('expected_completion_date', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Actual Completion</Label>
                                <Input
                                    type="date"
                                    value={formData.actual_completion_date}
                                    onChange={(e) => handleChange('actual_completion_date', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Completion Percentage: {formData.completion_percentage}%</Label>
                            <div className="flex items-center gap-4 mt-2">
                                <Progress value={formData.completion_percentage} className="flex-1" />
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.completion_percentage}
                                    onChange={(e) => handleChange('completion_percentage', parseInt(e.target.value) || 0)}
                                    className="w-20"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Cost Breakdown</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Total Budgeted Cost (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.total_budgeted_cost}
                                    onChange={(e) => handleChange('total_budgeted_cost', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div className="bg-gray-50 p-3 rounded">
                                <Label>Total Actual Cost</Label>
                                <div className="text-2xl font-bold text-emerald-600 mt-1">
                                    LKR {formData.total_actual_cost.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <Label>Materials Cost</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.materials_cost}
                                    onChange={(e) => handleChange('materials_cost', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Labor Cost</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.labor_cost}
                                    onChange={(e) => handleChange('labor_cost', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Contractor Cost</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.contractor_cost}
                                    onChange={(e) => handleChange('contractor_cost', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Other Costs</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.other_costs}
                                    onChange={(e) => handleChange('other_costs', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {costVariance !== 0 && (
                            <div className={`p-3 rounded ${costVariance > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                                <div className="flex justify-between">
                                    <span className="font-semibold">Cost Variance:</span>
                                    <span className={`font-bold ${costVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        LKR {Math.abs(costVariance).toLocaleString()} ({costVariancePercent.toFixed(1)}%)
                                        {costVariance > 0 ? ' Over Budget' : ' Under Budget'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Contractor & Location</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Contractor Name</Label>
                                <Input
                                    value={formData.contractor_name}
                                    onChange={(e) => handleChange('contractor_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Contract Value (LKR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.contractor_contract_value}
                                    onChange={(e) => handleChange('contractor_contract_value', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Project Manager</Label>
                                <Input
                                    value={formData.project_manager}
                                    onChange={(e) => handleChange('project_manager', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Location</Label>
                                <Select 
                                    value={formData.location_code} 
                                    onValueChange={(val) => handleChange('location_code', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.location_code}>
                                                {loc.location_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Cost Center</Label>
                                <Select 
                                    value={formData.cost_center} 
                                    onValueChange={(val) => handleChange('cost_center', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select cost center" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {costCenters.map(cc => (
                                            <SelectItem key={cc.id} value={cc.cost_center_code}>
                                                {cc.cost_center_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Capitalization Details</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Capitalized Date</Label>
                                <Input
                                    type="date"
                                    value={formData.capitalized_date}
                                    onChange={(e) => handleChange('capitalized_date', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Capitalized Asset #</Label>
                                <Input
                                    value={formData.capitalized_asset_number}
                                    onChange={(e) => handleChange('capitalized_asset_number', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Useful Life (Years)</Label>
                                <Input
                                    type="number"
                                    value={formData.useful_life_years}
                                    onChange={(e) => handleChange('useful_life_years', parseInt(e.target.value) || 0)}
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
                            {item ? 'Update' : 'Create'} AUC
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}