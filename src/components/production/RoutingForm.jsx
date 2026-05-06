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

export default function RoutingForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        routing_number: '',
        routing_name: '',
        product_code: '',
        product_name: '',
        version: '1',
        total_time_minutes: 0,
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
        status: 'draft',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const handleProductSelect = (productCode) => {
        const product = materials.find(m => m.material_code === productCode);
        if (product) {
            setFormData(prev => ({
                ...prev,
                product_code: productCode,
                product_name: product.material_name
            }));
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.Routing.update(item.id, data);
            }
            return base44.entities.Routing.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['routings'] });
            toast({
                title: "Success",
                description: `Routing ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Routing' : 'New Manufacturing Routing'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Routing Number *</Label>
                            <Input 
                                value={formData.routing_number}
                                onChange={(e) => handleChange('routing_number', e.target.value)}
                                required
                                placeholder="ROUTE-001"
                            />
                        </div>
                        <div>
                            <Label>Routing Name *</Label>
                            <Input 
                                value={formData.routing_name}
                                onChange={(e) => handleChange('routing_name', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Product *</Label>
                            <Select 
                                value={formData.product_code} 
                                onValueChange={handleProductSelect}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materials.filter(m => m.material_type === 'finished_product' || m.material_type === 'semi_finished').map(m => (
                                        <SelectItem key={m.id} value={m.material_code}>
                                            {m.material_code} - {m.material_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Version</Label>
                            <Input 
                                value={formData.version}
                                onChange={(e) => handleChange('version', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Total Time (minutes)</Label>
                            <Input 
                                type="number"
                                value={formData.total_time_minutes}
                                onChange={(e) => handleChange('total_time_minutes', parseFloat(e.target.value) || 0)}
                                min="0"
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
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="obsolete">Obsolete</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Valid From *</Label>
                            <Input 
                                type="date"
                                value={formData.valid_from}
                                onChange={(e) => handleChange('valid_from', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Valid To</Label>
                            <Input 
                                type="date"
                                value={formData.valid_to}
                                onChange={(e) => handleChange('valid_to', e.target.value)}
                            />
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

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Routing
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}