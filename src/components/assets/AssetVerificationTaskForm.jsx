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
import { ClipboardCheck } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { logAuditTrail } from "../utils/auditTrail";

export default function AssetVerificationTaskForm({ item, onClose }) {
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
        queryKey: ['locations'],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        task_id: `VT-${Date.now()}`,
        task_name: '',
        task_type: 'annual',
        scheduled_date: new Date().toISOString().split('T')[0],
        location_code: '',
        location_name: '',
        asset_class_filter: '',
        department_filter: '',
        total_assets: 0,
        verified_count: 0,
        discrepancy_count: 0,
        not_found_count: 0,
        completion_percentage: 0,
        assigned_to: currentUser?.email || '',
        assigned_to_name: currentUser?.full_name || '',
        status: 'scheduled',
        priority: 'normal',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    useEffect(() => {
        if (currentUser && !item) {
            setFormData(prev => ({
                ...prev,
                assigned_to: currentUser.email,
                assigned_to_name: currentUser.full_name
            }));
        }
    }, [currentUser, item]);

    // Calculate total assets based on filters
    useEffect(() => {
        let filtered = assets;

        if (formData.location_code) {
            filtered = filtered.filter(a => a.location_code === formData.location_code);
        }

        if (formData.asset_class_filter) {
            filtered = filtered.filter(a => a.asset_class === formData.asset_class_filter);
        }

        if (formData.department_filter) {
            filtered = filtered.filter(a => a.cost_center === formData.department_filter);
        }

        setFormData(prev => ({
            ...prev,
            total_assets: filtered.length
        }));
    }, [formData.location_code, formData.asset_class_filter, formData.department_filter, assets]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let task;
            const beforeData = item ? { ...item } : null;

            if (item) {
                task = await matrixSales.entities.AssetVerificationTask.update(item.id, data);
                
                await logAuditTrail({
                    entityType: 'asset_verification_task',
                    entityId: item.id,
                    documentNumber: data.task_id,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                task = await matrixSales.entities.AssetVerificationTask.create(data);
                
                await logAuditTrail({
                    entityType: 'asset_verification_task',
                    entityId: task.id,
                    documentNumber: data.task_id,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            }

            return task;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['verificationTasks'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: `Verification task ${item ? 'updated' : 'created'} successfully`,
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

    const handleLocationChange = (locationCode) => {
        const location = locations.find(l => l.location_code === locationCode);
        setFormData(prev => ({
            ...prev,
            location_code: locationCode,
            location_name: location?.location_name || ''
        }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Verification Task' : 'New Verification Task'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Task Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Task ID *</Label>
                                <Input
                                    value={formData.task_id}
                                    onChange={(e) => handleChange('task_id', e.target.value)}
                                    required
                                    disabled={!!item}
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <Label>Task Name *</Label>
                                <Input
                                    value={formData.task_name}
                                    onChange={(e) => handleChange('task_name', e.target.value)}
                                    required
                                    placeholder="e.g., Annual Asset Verification 2025"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Task Type *</Label>
                                <Select 
                                    value={formData.task_type} 
                                    onValueChange={(val) => handleChange('task_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="annual">Annual</SelectItem>
                                        <SelectItem value="quarterly">Quarterly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="spot_check">Spot Check</SelectItem>
                                        <SelectItem value="audit">Audit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                                <Label>Priority</Label>
                                <Select 
                                    value={formData.priority} 
                                    onValueChange={(val) => handleChange('priority', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Scope & Filters</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Location</Label>
                                <Select 
                                    value={formData.location_code} 
                                    onValueChange={handleLocationChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All locations" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>All Locations</SelectItem>
                                        {locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.location_code}>
                                                {loc.location_code} - {loc.location_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Asset Class</Label>
                                <Select 
                                    value={formData.asset_class_filter} 
                                    onValueChange={(val) => handleChange('asset_class_filter', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All classes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>All Classes</SelectItem>
                                        <SelectItem value="land">Land</SelectItem>
                                        <SelectItem value="building">Building</SelectItem>
                                        <SelectItem value="machinery">Machinery</SelectItem>
                                        <SelectItem value="equipment">Equipment</SelectItem>
                                        <SelectItem value="vehicles">Vehicles</SelectItem>
                                        <SelectItem value="furniture">Furniture</SelectItem>
                                        <SelectItem value="computers">Computers</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-blue-900 font-medium">
                                    Assets to Verify:
                                </span>
                                <span className="text-2xl font-bold text-blue-700">
                                    {formData.total_assets}
                                </span>
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                                Based on current filters
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Assignment</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Assigned To *</Label>
                                <Input
                                    value={formData.assigned_to_name}
                                    onChange={(e) => handleChange('assigned_to_name', e.target.value)}
                                    required
                                    placeholder="User name"
                                />
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
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                            placeholder="Add any special instructions or notes for this verification task..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Task
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}