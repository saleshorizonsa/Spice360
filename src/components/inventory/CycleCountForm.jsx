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
import { ClipboardCheck, RefreshCw, AlertTriangle } from "lucide-react";
import SearchableSelect from "../shared/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { logAuditTrail } from "../utils/auditTrail";

export default function CycleCountForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    // Get current user
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

    const { data: materials = [] } = useQuery({
        queryKey: ['materials', currentOrg?.id],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: locations = [] } = useQuery({
        queryKey: ['locations', currentOrg?.id],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels', currentOrg?.id],
        queryFn: () => matrixSales.entities.StockLevel.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        count_number: '',
        organization_id: currentOrg?.id || '',
        count_date: new Date().toISOString().split('T')[0],
        warehouse_code: '',
        warehouse_name: '',
        material_code: '',
        material_name: '',
        bin_code: '',
        batch_number: '',
        system_quantity: 0,
        counted_quantity: 0,
        variance_quantity: 0,
        variance_percent: 0,
        variance_value: 0,
        unit_cost: 0,
        counted_by: currentUser?.full_name || '',
        verified_by: '',
        count_type: 'manual',
        status: 'planned',
        adjustment_posted: false,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({
                ...item,
                organization_id: item.organization_id || currentOrg?.id
            });
        } else {
            setFormData(prev => ({ 
                ...prev, 
                organization_id: currentOrg?.id,
                counted_by: currentUser?.full_name || ''
            }));
            generateCountNumber();
        }
    }, [item, currentOrg, currentUser]);

    useEffect(() => {
        // Calculate variance
        const variance = formData.counted_quantity - formData.system_quantity;
        const variancePercent = formData.system_quantity !== 0 
            ? (variance / formData.system_quantity) * 100 
            : 0;
        const varianceValue = variance * formData.unit_cost;

        setFormData(prev => ({
            ...prev,
            variance_quantity: variance,
            variance_percent: variancePercent,
            variance_value: varianceValue
        }));
    }, [formData.counted_quantity, formData.system_quantity, formData.unit_cost]);

    const generateCountNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('cycle_count');
            setFormData(prev => ({ ...prev, count_number: number }));
        } catch (error) {
            console.error("Error generating count number:", error);
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    const handleMaterialSelect = (materialCode) => {
        const material = materials.find(m => m.material_code === materialCode);
        if (material) {
            // Find system quantity for this material in selected warehouse
            const stockLevel = stockLevels.find(s => 
                s.material_code === materialCode && 
                s.warehouse_code === formData.warehouse_code &&
                s.bin_code === formData.bin_code
            );

            setFormData(prev => ({
                ...prev,
                material_code: materialCode,
                material_name: material.material_name,
                system_quantity: stockLevel?.quantity || 0,
                unit_cost: material.unit_cost || 0
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let cycleCount;
            const beforeData = item ? { ...item } : null;

            if (item) {
                cycleCount = await matrixSales.entities.CycleCount.update(item.id, data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'cycle_count',
                    entityId: item.id,
                    documentNumber: data.count_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: Math.abs(data.variance_percent) > 10 ? 'warning' : 'info'
                });
            } else {
                cycleCount = await matrixSales.entities.CycleCount.create(data);
                
                // Log audit trail
                await logAuditTrail({
                    entityType: 'cycle_count',
                    entityId: cycleCount.id,
                    documentNumber: data.count_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            }

            return cycleCount;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cycleCounts'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: item ? "Cycle count updated" : "Cycle count created",
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

    const materialOptions = materials.map(m => ({
        value: m.material_code,
        label: `${m.material_code} - ${m.material_name}`
    }));

    const locationOptions = locations.map(l => ({
        value: l.location_code,
        label: `${l.location_code} - ${l.location_name}`
    }));

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Cycle Count' : 'New Cycle Count'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Count Header */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Count Information</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Count Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.count_number}
                                        onChange={(e) => handleChange('count_number', e.target.value)}
                                        required
                                        disabled={isGeneratingNumber}
                                    />
                                    {!item && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateCountNumber}
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>Count Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.count_date}
                                    onChange={(e) => handleChange('count_date', e.target.value)}
                                    required
                                />
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
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="adjusted">Adjusted</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Location & Material */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Location & Material</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SearchableSelect
                                label="Warehouse *"
                                value={formData.warehouse_code}
                                onValueChange={(val) => {
                                    const loc = locations.find(l => l.location_code === val);
                                    handleChange('warehouse_code', val);
                                    handleChange('warehouse_name', loc?.location_name || '');
                                }}
                                options={locationOptions}
                                placeholder="Select warehouse..."
                                searchPlaceholder="Search warehouses..."
                            />
                            <div>
                                <Label>Bin Code</Label>
                                <Input
                                    value={formData.bin_code}
                                    onChange={(e) => handleChange('bin_code', e.target.value)}
                                />
                            </div>
                        </div>

                        <SearchableSelect
                            label="Material *"
                            value={formData.material_code}
                            onValueChange={handleMaterialSelect}
                            options={materialOptions}
                            placeholder="Select material..."
                            searchPlaceholder="Search materials..."
                        />
                    </div>

                    {/* Count Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Count Details</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>System Quantity</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.system_quantity}
                                    disabled
                                    className="bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label>Counted Quantity *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.counted_quantity}
                                    onChange={(e) => handleChange('counted_quantity', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Variance</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.variance_quantity}
                                    disabled
                                    className={`bg-gray-50 ${formData.variance_quantity !== 0 ? 'text-red-600 font-bold' : ''}`}
                                />
                            </div>
                        </div>

                        {formData.variance_quantity !== 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-amber-900">Variance Detected</p>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <span className="text-sm text-amber-700">Variance %: </span>
                                                <Badge className="bg-amber-600">
                                                    {formData.variance_percent.toFixed(2)}%
                                                </Badge>
                                            </div>
                                            <div>
                                                <span className="text-sm text-amber-700">Variance Value: </span>
                                                <Badge className="bg-amber-600">
                                                    LKR {Math.abs(formData.variance_value).toLocaleString()}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Counted By *</Label>
                                <Input
                                    value={formData.counted_by}
                                    onChange={(e) => handleChange('counted_by', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Verified By</Label>
                                <Input
                                    value={formData.verified_by}
                                    onChange={(e) => handleChange('verified_by', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Count
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}