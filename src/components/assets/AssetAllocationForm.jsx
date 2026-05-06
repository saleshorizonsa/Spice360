import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
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
import { UserCheck } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";
import { logAuditTrail } from "../utils/auditTrail";

export default function AssetAllocationForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
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

    const { data: assets = [] } = useQuery({
        queryKey: ['assets', currentOrg?.id],
        queryFn: () => matrixSales.entities.FixedAsset.filter({ status: 'active' }),
        initialData: []
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees', currentOrg?.id],
        queryFn: () => matrixSales.entities.Employee.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        allocation_id: '',
        asset_number: '',
        asset_name: '',
        allocation_date: new Date().toISOString().split('T')[0],
        return_date: '',
        allocation_type: 'employee',
        allocated_to_employee: '',
        allocated_to_employee_name: '',
        allocated_to_department: '',
        allocated_to_project: '',
        allocated_to_location: '',
        condition_at_allocation: 'good',
        condition_at_return: '',
        status: 'active',
        allocated_by: currentUser?.email || '',
        returned_by: '',
        purpose: '',
        handover_document: '',
        acknowledgement_signed: false,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({ ...item });
        } else {
            setFormData(prev => ({ ...prev, allocated_by: currentUser?.email || '' }));
            generateAllocationNumber();
        }
    }, [item, currentUser]);

    const generateAllocationNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = `ALLOC-${Date.now()}`;
            setFormData(prev => ({ ...prev, allocation_id: number }));
        } catch (error) {
            console.error("Error generating allocation number:", error);
        } finally {
            setIsGeneratingNumber(false);
        }
    };

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

    const handleEmployeeSelect = (employeeNumber) => {
        const employee = employees.find(e => e.employee_number === employeeNumber);
        if (employee) {
            setFormData(prev => ({
                ...prev,
                allocated_to_employee: employeeNumber,
                allocated_to_employee_name: employee.employee_name,
                allocated_to_department: employee.department,
                allocated_to_location: employee.branch_code
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let allocation;
            const beforeData = item ? { ...item } : null;

            if (item) {
                allocation = await matrixSales.entities.AssetAllocation.update(item.id, data);
                
                await logAuditTrail({
                    entityType: 'asset_allocation',
                    entityId: item.id,
                    documentNumber: data.allocation_id,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                allocation = await matrixSales.entities.AssetAllocation.create(data);
                
                await logAuditTrail({
                    entityType: 'asset_allocation',
                    entityId: allocation.id,
                    documentNumber: data.allocation_id,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            }

            return allocation;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allocations'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "Allocation updated" : "Asset allocated",
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

    const employeeOptions = employees.map(e => ({
        value: e.employee_number,
        label: `${e.employee_number} - ${e.employee_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Asset Allocation' : 'Allocate Asset'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Allocation Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Allocation ID *</Label>
                                <Input
                                    value={formData.allocation_id}
                                    onChange={(e) => handleChange('allocation_id', e.target.value)}
                                    required
                                    disabled={isGeneratingNumber}
                                />
                            </div>
                            <div>
                                <Label>Allocation Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.allocation_date}
                                    onChange={(e) => handleChange('allocation_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <SearchableSelect
                            label="Select Asset *"
                            value={formData.asset_number}
                            onValueChange={handleAssetSelect}
                            options={assetOptions}
                            placeholder="Select asset..."
                            searchPlaceholder="Search assets..."
                        />
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Allocate To</h3>
                        <div>
                            <Label>Allocation Type *</Label>
                            <Select 
                                value={formData.allocation_type} 
                                onValueChange={(val) => handleChange('allocation_type', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employee">Employee</SelectItem>
                                    <SelectItem value="department">Department</SelectItem>
                                    <SelectItem value="project">Project</SelectItem>
                                    <SelectItem value="location">Location</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.allocation_type === 'employee' && (
                            <SearchableSelect
                                label="Employee *"
                                value={formData.allocated_to_employee}
                                onValueChange={handleEmployeeSelect}
                                options={employeeOptions}
                                placeholder="Select employee..."
                                searchPlaceholder="Search employees..."
                            />
                        )}

                        {formData.allocation_type === 'department' && (
                            <div>
                                <Label>Department *</Label>
                                <Input
                                    value={formData.allocated_to_department}
                                    onChange={(e) => handleChange('allocated_to_department', e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {formData.allocation_type === 'project' && (
                            <div>
                                <Label>Project Code *</Label>
                                <Input
                                    value={formData.allocated_to_project}
                                    onChange={(e) => handleChange('allocated_to_project', e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {formData.allocation_type === 'location' && (
                            <div>
                                <Label>Location Code *</Label>
                                <Input
                                    value={formData.allocated_to_location}
                                    onChange={(e) => handleChange('allocated_to_location', e.target.value)}
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Condition & Status</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Condition at Allocation *</Label>
                                <Select 
                                    value={formData.condition_at_allocation} 
                                    onValueChange={(val) => handleChange('condition_at_allocation', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="excellent">Excellent</SelectItem>
                                        <SelectItem value="good">Good</SelectItem>
                                        <SelectItem value="fair">Fair</SelectItem>
                                        <SelectItem value="poor">Poor</SelectItem>
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
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="returned">Returned</SelectItem>
                                        <SelectItem value="transferred">Transferred</SelectItem>
                                        <SelectItem value="lost">Lost</SelectItem>
                                        <SelectItem value="damaged">Damaged</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Purpose</Label>
                            <Input
                                value={formData.purpose}
                                onChange={(e) => handleChange('purpose', e.target.value)}
                                placeholder="Purpose of allocation"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="acknowledgement"
                                checked={formData.acknowledgement_signed}
                                onCheckedChange={(checked) => handleChange('acknowledgement_signed', checked)}
                            />
                            <label
                                htmlFor="acknowledgement"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Employee has signed acknowledgement
                            </label>
                        </div>

                        <div>
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Allocate'} Asset
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}