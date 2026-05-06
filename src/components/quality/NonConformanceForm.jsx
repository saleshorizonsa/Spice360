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

export default function NonConformanceForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        nc_number: '',
        nc_date: new Date().toISOString().split('T')[0],
        inspection_lot_number: '',
        material_code: '',
        material_name: '',
        batch_number: '',
        quantity_affected: 0,
        unit_of_measure: 'kg',
        nc_type: 'incoming_material',
        defect_description: '',
        root_cause: '',
        containment_action: '',
        disposition: 'pending',
        vendor_code: '',
        vendor_name: '',
        reported_by: '',
        assigned_to: '',
        priority: 'medium',
        status: 'open',
        capa_required: false,
        notes: ''
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => base44.entities.Vendor.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.NonConformance.update(item.id, data);
            }
            return base44.entities.NonConformance.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['nonConformances'] });
            toast({
                title: "Success",
                description: `Non-conformance ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
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
                        {item ? 'Edit Non-Conformance' : 'New Non-Conformance'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>NC Number *</Label>
                            <Input
                                value={formData.nc_number}
                                onChange={(e) => setFormData({...formData, nc_number: e.target.value})}
                                required
                                placeholder="NC-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>NC Date *</Label>
                            <Input
                                type="date"
                                value={formData.nc_date}
                                onChange={(e) => setFormData({...formData, nc_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>NC Type *</Label>
                            <Select 
                                value={formData.nc_type} 
                                onValueChange={(val) => setFormData({...formData, nc_type: val})}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="incoming_material">Incoming Material</SelectItem>
                                    <SelectItem value="in_process">In-Process</SelectItem>
                                    <SelectItem value="finished_goods">Finished Goods</SelectItem>
                                    <SelectItem value="customer_complaint">Customer Complaint</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Inspection Lot #</Label>
                            <Input
                                value={formData.inspection_lot_number}
                                onChange={(e) => setFormData({...formData, inspection_lot_number: e.target.value})}
                                placeholder="Related inspection lot"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material *</Label>
                            <Select 
                                value={formData.material_code} 
                                onValueChange={(val) => {
                                    const material = materials.find(m => m.material_code === val);
                                    setFormData({
                                        ...formData, 
                                        material_code: val,
                                        material_name: material?.material_name || '',
                                        unit_of_measure: material?.unit_of_measure || 'kg'
                                    });
                                }}
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
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantity Affected *</Label>
                            <Input
                                type="number"
                                value={formData.quantity_affected}
                                onChange={(e) => setFormData({...formData, quantity_affected: parseFloat(e.target.value) || 0})}
                                required
                                min="0"
                                step="0.01"
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

                    {formData.nc_type === 'incoming_material' && (
                        <div>
                            <Label>Vendor</Label>
                            <Select 
                                value={formData.vendor_code} 
                                onValueChange={(val) => {
                                    const vendor = vendors.find(v => v.vendor_code === val);
                                    setFormData({
                                        ...formData, 
                                        vendor_code: val,
                                        vendor_name: vendor?.vendor_name || ''
                                    });
                                }}
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

                    <div>
                        <Label>Defect Description *</Label>
                        <Textarea
                            value={formData.defect_description}
                            onChange={(e) => setFormData({...formData, defect_description: e.target.value})}
                            rows={3}
                            required
                        />
                    </div>

                    <div>
                        <Label>Root Cause</Label>
                        <Textarea
                            value={formData.root_cause}
                            onChange={(e) => setFormData({...formData, root_cause: e.target.value})}
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label>Containment Action</Label>
                        <Textarea
                            value={formData.containment_action}
                            onChange={(e) => setFormData({...formData, containment_action: e.target.value})}
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Disposition *</Label>
                            <Select 
                                value={formData.disposition} 
                                onValueChange={(val) => setFormData({...formData, disposition: val})}
                                required
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
                                    <SelectItem value="sort">Sort</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Priority</Label>
                            <Select 
                                value={formData.priority} 
                                onValueChange={(val) => setFormData({...formData, priority: val})}
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
                            <Label>Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => setFormData({...formData, status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="under_investigation">Under Investigation</SelectItem>
                                    <SelectItem value="action_in_progress">Action In Progress</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Reported By</Label>
                            <Input
                                value={formData.reported_by}
                                onChange={(e) => setFormData({...formData, reported_by: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Assigned To</Label>
                            <Input
                                value={formData.assigned_to}
                                onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : item ? 'Update' : 'Create'} NC
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}