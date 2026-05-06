
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
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { RefreshCw } from "lucide-react";

export default function InspectionLotForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        inspection_lot_number: '',
        lot_date: new Date().toISOString().split('T')[0],
        qc_plan_code: '',
        material_code: '',
        material_name: '',
        batch_number: '',
        inspection_type: 'incoming',
        source_document: '',
        source_document_type: 'grn',
        vendor_code: '',
        vendor_name: '',
        quantity_to_inspect: 0,
        sample_size: 0,
        unit_of_measure: 'kg',
        inspector_name: '',
        status: 'created',
        result: 'pending',
        disposition: 'pending',
        notes: ''
    });

    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    const { data: qcPlans = [] } = useQuery({
        queryKey: ['qcPlans'],
        queryFn: () => matrixSales.entities.QCPlan.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => matrixSales.entities.Vendor.list(),
        initialData: []
    });

    const generateLotNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('inspection_lot');
            setFormData(prev => ({ ...prev, inspection_lot_number: number }));
        } catch (error) {
            console.error("Error generating inspection number:", error);
            toast({
                title: "Warning",
                description: "Could not auto-generate lot number.",
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
            generateLotNumber();
        }
    }, [item]);

    const handleQCPlanSelect = (qcPlanCode) => {
        const plan = qcPlans.find(p => p.qc_plan_code === qcPlanCode);
        if (plan) {
            setFormData(prev => ({
                ...prev,
                qc_plan_code: qcPlanCode,
                material_code: plan.material_code,
                material_name: plan.material_name,
                inspection_type: plan.inspection_type,
                sample_size: plan.sample_size || 0
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                qc_plan_code: qcPlanCode, // Clear material details if plan not found or deselected
                material_code: '',
                material_name: '',
                inspection_type: 'incoming', // Default to incoming
                sample_size: 0
            }));
        }
    };

    const handleMaterialSelect = (materialCode) => {
        const material = materials.find(m => m.material_code === materialCode);
        if (material) {
            setFormData(prev => ({
                ...prev,
                material_code: materialCode,
                material_name: material.material_name,
                unit_of_measure: material.unit_of_measure
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                material_code: materialCode, // Clear material name and UOM if not found or deselected
                material_name: '',
                unit_of_measure: 'kg' // Default UOM
            }));
        }
    };

    const handleVendorSelect = (vendorCode) => {
        const vendor = vendors.find(v => v.vendor_code === vendorCode);
        if (vendor) {
            setFormData(prev => ({
                ...prev,
                vendor_code: vendorCode,
                vendor_name: vendor.vendor_name
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                vendor_code: vendorCode, // Clear vendor name if not found or deselected
                vendor_name: ''
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.InspectionLot.update(item.id, data);
            }
            return matrixSales.entities.InspectionLot.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspectionLots'] });
            toast({
                title: "Success",
                description: `Inspection lot ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} inspection lot: ${error.message}`,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Inspection Lot' : 'New Inspection Lot'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Inspection Lot Number *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.inspection_lot_number}
                                    onChange={(e) => setFormData({...formData, inspection_lot_number: e.target.value})}
                                    required
                                    disabled={isGeneratingNumber || item}
                                    placeholder="IL-2025-0001"
                                />
                                {!item && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generateLotNumber}
                                        disabled={isGeneratingNumber}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label>Lot Date *</Label>
                            <Input
                                type="date"
                                value={formData.lot_date}
                                onChange={(e) => setFormData({...formData, lot_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>QC Plan</Label>
                        <Select
                            value={formData.qc_plan_code}
                            onValueChange={handleQCPlanSelect}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select QC Plan (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {qcPlans.map(p => (
                                    <SelectItem key={p.id} value={p.qc_plan_code}>
                                        {p.qc_plan_code} - {p.qc_plan_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material *</Label>
                            <Select
                                value={formData.material_code}
                                onValueChange={handleMaterialSelect}
                                required
                            >
                                <SelectTrigger>
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
                        <div>
                            <Label>Batch Number</Label>
                            <Input
                                value={formData.batch_number}
                                onChange={(e) => setFormData({...formData, batch_number: e.target.value})}
                                placeholder="Batch/Lot number"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                                    <SelectItem value="incoming">Incoming</SelectItem>
                                    <SelectItem value="in_process">In-Process</SelectItem>
                                    <SelectItem value="final">Final</SelectItem>
                                    <SelectItem value="random">Random</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Source Document Type</Label>
                            <Select
                                value={formData.source_document_type}
                                onValueChange={(val) => setFormData({...formData, source_document_type: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="grn">GRN</SelectItem>
                                    <SelectItem value="production">Production Order</SelectItem>
                                    <SelectItem value="stock">Stock</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Source Document #</Label>
                            <Input
                                value={formData.source_document}
                                onChange={(e) => setFormData({...formData, source_document: e.target.value})}
                                placeholder="GRN/PO number"
                            />
                        </div>
                        <div>
                            <Label>Inspector Name *</Label>
                            <Input
                                value={formData.inspector_name}
                                onChange={(e) => setFormData({...formData, inspector_name: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    {formData.inspection_type === 'incoming' && (
                        <div>
                            <Label>Vendor</Label>
                            <Select
                                value={formData.vendor_code}
                                onValueChange={handleVendorSelect}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendors.map(v => (
                                        <SelectItem key={v.id} value={v.vendor_code}>
                                            {v.vendor_code} - {v.vendor_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Quantity to Inspect *</Label>
                            <Input
                                type="number"
                                value={formData.quantity_to_inspect}
                                onChange={(e) => setFormData({...formData, quantity_to_inspect: parseFloat(e.target.value) || 0})}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <Label>Sample Size</Label>
                            <Input
                                type="number"
                                value={formData.sample_size}
                                onChange={(e) => setFormData({...formData, sample_size: parseFloat(e.target.value) || 0})}
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>UOM</Label>
                            <Input
                                value={formData.unit_of_measure}
                                disabled
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
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
                                    <SelectItem value="created">Created</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Result</Label>
                            <Select
                                value={formData.result}
                                onValueChange={(val) => setFormData({...formData, result: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="accepted">Accepted</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="conditional">Conditional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Disposition</Label>
                            <Select
                                value={formData.disposition}
                                onValueChange={(val) => setFormData({...formData, disposition: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="use_as_is">Use As Is</SelectItem>
                                    <SelectItem value="rework">Rework</SelectItem>
                                    <SelectItem value="scrap">Scrap</SelectItem>
                                    <SelectItem value="return_to_vendor">Return to Vendor</SelectItem>
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
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saveMutation.isPending || isGeneratingNumber}
                        >
                            {saveMutation.isPending ? 'Saving...' : item ? 'Update' : 'Create'} Inspection Lot
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
