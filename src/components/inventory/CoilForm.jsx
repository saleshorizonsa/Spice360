import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Package } from "lucide-react";

export default function CoilForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const { data: locations = [] } = useQuery({
        queryKey: ['locations'],
        queryFn: () => base44.entities.Location.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        coil_number: '',
        material_code: '',
        material_name: '',
        supplier_batch_number: '',
        grn_number: '',
        po_number: '',
        received_date: new Date().toISOString().split('T')[0],
        original_weight: 0,
        current_weight: 0,
        width_mm: 0,
        thickness_mm: 0,
        location_code: '',
        warehouse_bin: '',
        qc_status: 'pending',
        status: 'available',
        is_parent_coil: true,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleMaterialSelect = (materialCode) => {
        const material = materials.find(m => m.material_code === materialCode);
        if (material) {
            setFormData(prev => ({
                ...prev,
                material_code: materialCode,
                material_name: material.material_name
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.Coil.update(item.id, data);
            }
            return base44.entities.Coil.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coils'] });
            toast({
                title: "Success",
                description: `Coil ${item ? 'updated' : 'created'} successfully`,
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
                        <Package className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Coil' : 'Register New Coil'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Coil Number *</Label>
                            <Input
                                value={formData.coil_number}
                                onChange={(e) => handleChange('coil_number', e.target.value)}
                                required
                                placeholder="COIL-2025-001"
                            />
                        </div>
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
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Supplier Batch #</Label>
                            <Input
                                value={formData.supplier_batch_number}
                                onChange={(e) => handleChange('supplier_batch_number', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>GRN Number</Label>
                            <Input
                                value={formData.grn_number}
                                onChange={(e) => handleChange('grn_number', e.target.value)}
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Received Date</Label>
                            <Input
                                type="date"
                                value={formData.received_date}
                                onChange={(e) => handleChange('received_date', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Original Weight (kg) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.original_weight}
                                onChange={(e) => {
                                    const weight = parseFloat(e.target.value) || 0;
                                    handleChange('original_weight', weight);
                                    if (!item) handleChange('current_weight', weight);
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Current Weight (kg)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.current_weight}
                                onChange={(e) => handleChange('current_weight', parseFloat(e.target.value) || 0)}
                                disabled={!item}
                            />
                        </div>
                        <div>
                            <Label>Width (mm)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={formData.width_mm}
                                onChange={(e) => handleChange('width_mm', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <Label>Thickness (mm)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.thickness_mm}
                                onChange={(e) => handleChange('thickness_mm', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Location *</Label>
                            <Select 
                                value={formData.location_code} 
                                onValueChange={(val) => handleChange('location_code', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.location_code}>
                                            {loc.location_code} - {loc.location_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Warehouse Bin</Label>
                            <Input
                                value={formData.warehouse_bin}
                                onChange={(e) => handleChange('warehouse_bin', e.target.value)}
                                placeholder="e.g., A-01-05"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>QC Status</Label>
                            <Select 
                                value={formData.qc_status} 
                                onValueChange={(val) => handleChange('qc_status', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                </SelectContent>
                            </Select>
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
                                    <SelectItem value="available">Available</SelectItem>
                                    <SelectItem value="reserved">Reserved</SelectItem>
                                    <SelectItem value="in_use">In Use</SelectItem>
                                    <SelectItem value="split">Split</SelectItem>
                                    <SelectItem value="exhausted">Exhausted</SelectItem>
                                    <SelectItem value="quarantine">Quarantine</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

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
                            {item ? 'Update' : 'Register'} Coil
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}