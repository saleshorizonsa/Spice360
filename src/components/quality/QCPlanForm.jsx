import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "../utils/OrganizationContext";
import SearchableSelect from "../shared/SearchableSelect";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function QCPlanForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();

    const { data: materials = [] } = useQuery({
        queryKey: ['materials', currentOrg?.id],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        qc_plan_code: '',
        qc_plan_name: '',
        organization_id: currentOrg?.id || '',
        material_code: '',
        material_name: '',
        inspection_type: 'incoming',
        sampling_plan: 'aql_2.5',
        sample_size: 0,
        aql_percent: 2.5,
        auto_create_lot: true,
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
        status: 'active',
        notes: ''
    });

    const [testSpecs, setTestSpecs] = useState([]);

    useEffect(() => {
        if (item) {
            setFormData({
                ...item,
                organization_id: item.organization_id || currentOrg?.id
            });
            
            // Load test specifications
            const loadTestSpecs = async () => {
                const specs = await matrixSales.entities.TestSpecification.filter({ 
                    qc_plan_code: item.qc_plan_code 
                });
                setTestSpecs(specs);
            };
            loadTestSpecs();
        } else {
            setFormData(prev => ({ ...prev, organization_id: currentOrg?.id }));
        }
    }, [item, currentOrg]);

    const handleMaterialSelect = (materialCode) => {
        const material = materials.find(m => m.material_code === materialCode);
        if (material) {
            setFormData(prev => ({
                ...prev,
                material_code: materialCode,
                material_name: material.material_name,
                qc_plan_name: `${material.material_name} - ${prev.inspection_type.toUpperCase()}`
            }));
        }
    };

    const handleAddTestSpec = () => {
        const newSpec = {
            test_number: testSpecs.length + 1,
            test_parameter: '',
            test_method: '',
            data_type: 'numeric',
            lower_limit: 0,
            upper_limit: 0,
            target_value: 0,
            unit_of_measure: '',
            is_critical: false,
            mandatory: true,
            notes: ''
        };
        setTestSpecs([...testSpecs, newSpec]);
    };

    const handleRemoveTestSpec = (index) => {
        const updated = testSpecs.filter((_, i) => i !== index);
        // Renumber
        const renumbered = updated.map((spec, i) => ({
            ...spec,
            test_number: i + 1
        }));
        setTestSpecs(renumbered);
    };

    const handleTestSpecChange = (index, field, value) => {
        const updated = [...testSpecs];
        updated[index][field] = value;
        setTestSpecs(updated);
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let qcPlan;
            if (item) {
                qcPlan = await matrixSales.entities.QCPlan.update(item.id, data);
            } else {
                qcPlan = await matrixSales.entities.QCPlan.create(data);
            }

            // Delete existing test specs if editing
            if (item) {
                const existingSpecs = await matrixSales.entities.TestSpecification.filter({ 
                    qc_plan_code: item.qc_plan_code 
                });
                await Promise.all(existingSpecs.map(spec => 
                    matrixSales.entities.TestSpecification.delete(spec.id)
                ));
            }

            // Create new test specifications
            const specsWithPlanCode = testSpecs.map(spec => ({
                ...spec,
                organization_id: currentOrg?.id,
                qc_plan_code: data.qc_plan_code
            }));
            await matrixSales.entities.TestSpecification.bulkCreate(specsWithPlanCode);

            return qcPlan;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qcPlans'] });
            queryClient.invalidateQueries({ queryKey: ['testSpecifications'] });
            toast({
                title: "Success",
                description: `QC Plan ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} QC Plan: ${error.message}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (testSpecs.length === 0) {
            toast({
                title: "Warning",
                description: "Please add at least one test specification",
                variant: "destructive"
            });
            return;
        }

        saveMutation.mutate(formData);
    };

    const materialOptions = materials.map(m => ({
        value: m.material_code,
        label: `${m.material_code} - ${m.material_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit QC Plan' : 'New QC Plan'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Plan Information */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Plan Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>QC Plan Code *</Label>
                                <Input
                                    value={formData.qc_plan_code}
                                    onChange={(e) => setFormData({...formData, qc_plan_code: e.target.value})}
                                    required
                                    placeholder="QC-PLAN-001"
                                    disabled={!!item}
                                />
                            </div>
                            <div>
                                <Label>QC Plan Name *</Label>
                                <Input
                                    value={formData.qc_plan_name}
                                    onChange={(e) => setFormData({...formData, qc_plan_name: e.target.value})}
                                    required
                                    placeholder="Enter plan name"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <SearchableSelect
                                label="Material *"
                                value={formData.material_code}
                                onValueChange={handleMaterialSelect}
                                options={materialOptions}
                                placeholder="Select material..."
                                searchPlaceholder="Search materials..."
                            />
                            <div>
                                <Label>Inspection Type *</Label>
                                <Select 
                                    value={formData.inspection_type} 
                                    onValueChange={(val) => setFormData({...formData, inspection_type: val})}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="incoming">Incoming Inspection</SelectItem>
                                        <SelectItem value="in_process">In-Process Inspection</SelectItem>
                                        <SelectItem value="final">Final Inspection</SelectItem>
                                        <SelectItem value="random">Random Inspection</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Sampling Configuration */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Sampling Configuration</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Sampling Plan *</Label>
                                <Select 
                                    value={formData.sampling_plan} 
                                    onValueChange={(val) => setFormData({...formData, sampling_plan: val})}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="100%">100% Inspection</SelectItem>
                                        <SelectItem value="aql_1.5">AQL 1.5%</SelectItem>
                                        <SelectItem value="aql_2.5">AQL 2.5%</SelectItem>
                                        <SelectItem value="aql_4.0">AQL 4.0%</SelectItem>
                                        <SelectItem value="skip_lot">Skip Lot</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Sample Size</Label>
                                <Input
                                    type="number"
                                    value={formData.sample_size}
                                    onChange={(e) => setFormData({...formData, sample_size: parseFloat(e.target.value) || 0})}
                                    min="0"
                                    placeholder="Enter sample size"
                                />
                            </div>
                            <div>
                                <Label>AQL %</Label>
                                <Input
                                    type="number"
                                    value={formData.aql_percent}
                                    onChange={(e) => setFormData({...formData, aql_percent: parseFloat(e.target.value) || 0})}
                                    min="0"
                                    step="0.1"
                                    placeholder="2.5"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                            <Switch
                                checked={formData.auto_create_lot}
                                onCheckedChange={(checked) => setFormData({...formData, auto_create_lot: checked})}
                            />
                            <div className="flex-1">
                                <Label className="text-sm font-medium">Auto-Create Inspection Lot</Label>
                                <p className="text-xs text-gray-600">Automatically create inspection lots when GRN or Production Order is posted</p>
                            </div>
                        </div>
                    </div>

                    {/* Test Specifications */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-semibold text-lg">Test Specifications</h3>
                            <Button
                                type="button"
                                onClick={handleAddTestSpec}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Test
                            </Button>
                        </div>

                        {testSpecs.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
                                <p className="text-gray-500">No test specifications added yet</p>
                                <p className="text-sm text-gray-400 mt-1">Click "Add Test" to define quality parameters</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-gray-50 sticky top-0">
                                            <TableRow>
                                                <TableHead className="w-8">#</TableHead>
                                                <TableHead className="w-48">Test Parameter *</TableHead>
                                                <TableHead className="w-32">Test Method</TableHead>
                                                <TableHead className="w-24">Type *</TableHead>
                                                <TableHead className="w-24">Lower Limit</TableHead>
                                                <TableHead className="w-24">Target</TableHead>
                                                <TableHead className="w-24">Upper Limit</TableHead>
                                                <TableHead className="w-24">UOM</TableHead>
                                                <TableHead className="w-20">Critical</TableHead>
                                                <TableHead className="w-20">Mandatory</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {testSpecs.map((spec, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{spec.test_number}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={spec.test_parameter}
                                                            onChange={(e) => handleTestSpecChange(index, 'test_parameter', e.target.value)}
                                                            placeholder="e.g., Density"
                                                            required
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={spec.test_method}
                                                            onChange={(e) => handleTestSpecChange(index, 'test_method', e.target.value)}
                                                            placeholder="ASTM D792"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={spec.data_type}
                                                            onValueChange={(val) => handleTestSpecChange(index, 'data_type', val)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="numeric">Numeric</SelectItem>
                                                                <SelectItem value="text">Text</SelectItem>
                                                                <SelectItem value="pass_fail">Pass/Fail</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={spec.lower_limit}
                                                            onChange={(e) => handleTestSpecChange(index, 'lower_limit', parseFloat(e.target.value) || 0)}
                                                            step="0.01"
                                                            disabled={spec.data_type !== 'numeric'}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={spec.target_value}
                                                            onChange={(e) => handleTestSpecChange(index, 'target_value', parseFloat(e.target.value) || 0)}
                                                            step="0.01"
                                                            disabled={spec.data_type !== 'numeric'}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={spec.upper_limit}
                                                            onChange={(e) => handleTestSpecChange(index, 'upper_limit', parseFloat(e.target.value) || 0)}
                                                            step="0.01"
                                                            disabled={spec.data_type !== 'numeric'}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={spec.unit_of_measure}
                                                            onChange={(e) => handleTestSpecChange(index, 'unit_of_measure', e.target.value)}
                                                            placeholder="kg/m³"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch
                                                            checked={spec.is_critical}
                                                            onCheckedChange={(checked) => handleTestSpecChange(index, 'is_critical', checked)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch
                                                            checked={spec.mandatory}
                                                            onCheckedChange={(checked) => handleTestSpecChange(index, 'mandatory', checked)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveTestSpec(index)}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Validity & Status */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Validity & Status</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Valid From *</Label>
                                <Input
                                    type="date"
                                    value={formData.valid_from}
                                    onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Valid To</Label>
                                <Input
                                    type="date"
                                    value={formData.valid_to}
                                    onChange={(e) => setFormData({...formData, valid_to: e.target.value})}
                                />
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => setFormData({...formData, status: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
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
                                placeholder="Additional notes about this QC plan..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="bg-emerald-600 hover:bg-emerald-700" 
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create')} QC Plan
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}