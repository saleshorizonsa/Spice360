import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "../utils/OrganizationContext";
import { Wrench } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";
import { logAuditTrail } from "../utils/auditTrail";

export default function AssetMaintenanceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [currentUser, setCurrentUser] = useState(null);
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: assets = [] } = useQuery({
        queryKey: ['assets', currentOrg?.id],
        queryFn: () => base44.entities.FixedAsset.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        maintenance_id: `MAINT-${Date.now()}`,
        asset_number: '',
        asset_name: '',
        maintenance_type: 'preventive',
        maintenance_date: new Date().toISOString().split('T')[0],
        next_maintenance_date: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        completed_date: '',
        vendor_name: '',
        technician_name: '',
        work_description: '',
        parts_replaced: '',
        parts_cost: 0,
        labor_cost: 0,
        other_costs: 0,
        total_cost: 0,
        downtime_hours: 0,
        status: 'scheduled',
        priority: 'medium',
        invoice_number: '',
        warranty_claim: false,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...item });
        }
    }, [item]);

    useEffect(() => {
        const total = (formData.parts_cost || 0) + (formData.labor_cost || 0) + (formData.other_costs || 0);
        setFormData(prev => ({ ...prev, total_cost: total }));
    }, [formData.parts_cost, formData.labor_cost, formData.other_costs]);

    const handleAssetSelect = (assetNumber) => {
        const asset = assets.find(a => a.asset_number === assetNumber);
        if (asset) {
            setFormData(prev => ({
                ...prev,
                asset_number: assetNumber,
                asset_name: asset.asset_name
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let maintenance;
            const beforeData = item ? { ...item } : null;

            if (item) {
                maintenance = await base44.entities.AssetMaintenance.update(item.id, data);
                
                await logAuditTrail({
                    entityType: 'asset_maintenance',
                    entityId: item.id,
                    documentNumber: data.maintenance_id,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                maintenance = await base44.entities.AssetMaintenance.create(data);
                
                await logAuditTrail({
                    entityType: 'asset_maintenance',
                    entityId: maintenance.id,
                    documentNumber: data.maintenance_id,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: data.priority === 'critical' ? 'warning' : 'info'
                });
            }

            return maintenance;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maintenance'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "Maintenance record updated" : "Maintenance scheduled",
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

    const assetOptions = assets.map(a => ({
        value: a.asset_number,
        label: `${a.asset_number} - ${a.asset_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Maintenance Record' : 'Schedule Maintenance'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Maintenance Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Maintenance ID *</Label>
                                <Input
                                    value={formData.maintenance_id}
                                    onChange={(e) => handleChange('maintenance_id', e.target.value)}
                                    required
                                />
                            </div>
                            <SearchableSelect
                                label="Asset *"
                                value={formData.asset_number}
                                onValueChange={handleAssetSelect}
                                options={assetOptions}
                                placeholder="Select asset..."
                                searchPlaceholder="Search assets..."
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Type *</Label>
                                <Select 
                                    value={formData.maintenance_type} 
                                    onValueChange={(val) => handleChange('maintenance_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="preventive">Preventive</SelectItem>
                                        <SelectItem value="corrective">Corrective</SelectItem>
                                        <SelectItem value="breakdown">Breakdown</SelectItem>
                                        <SelectItem value="calibration">Calibration</SelectItem>
                                        <SelectItem value="inspection">Inspection</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Priority *</Label>
                                <Select 
                                    value={formData.priority} 
                                    onValueChange={(val) => handleChange('priority', val)}
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
                                <Label>Status *</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => handleChange('status', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Scheduled Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.scheduled_date}
                                    onChange={(e) => handleChange('scheduled_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Completed Date</Label>
                                <Input
                                    type="date"
                                    value={formData.completed_date}
                                    onChange={(e) => handleChange('completed_date', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Next Maintenance</Label>
                                <Input
                                    type="date"
                                    value={formData.next_maintenance_date}
                                    onChange={(e) => handleChange('next_maintenance_date', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Work Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Vendor Name</Label>
                                <Input
                                    value={formData.vendor_name}
                                    onChange={(e) => handleChange('vendor_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Technician Name</Label>
                                <Input
                                    value={formData.technician_name}
                                    onChange={(e) => handleChange('technician_name', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Work Description</Label>
                            <Textarea
                                value={formData.work_description}
                                onChange={(e) => handleChange('work_description', e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div>
                            <Label>Parts Replaced</Label>
                            <Textarea
                                value={formData.parts_replaced}
                                onChange={(e) => handleChange('parts_replaced', e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Costs & Downtime</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <Label>Parts Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.parts_cost}
                                    onChange={(e) => handleChange('parts_cost', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Labor Cost (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.labor_cost}
                                    onChange={(e) => handleChange('labor_cost', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Other Costs (SAR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.other_costs}
                                    onChange={(e) => handleChange('other_costs', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <Label>Downtime (Hours)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={formData.downtime_hours}
                                    onChange={(e) => handleChange('downtime_hours', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <Label className="text-lg">Total Maintenance Cost</Label>
                            <div className="text-2xl font-bold text-emerald-600 mt-2">
                                SAR {formData.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Invoice Number</Label>
                                <Input
                                    value={formData.invoice_number}
                                    onChange={(e) => handleChange('invoice_number', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Checkbox
                                    id="warranty"
                                    checked={formData.warranty_claim}
                                    onCheckedChange={(checked) => handleChange('warranty_claim', checked)}
                                />
                                <label
                                    htmlFor="warranty"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Warranty Claim
                                </label>
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
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Schedule'} Maintenance
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}