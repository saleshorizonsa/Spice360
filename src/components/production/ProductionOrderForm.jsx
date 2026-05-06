
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
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { RefreshCw } from "lucide-react";

export default function ProductionOrderForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: products = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const { data: workCenters = [] } = useQuery({
        queryKey: ['workCenters'],
        queryFn: () => base44.entities.WorkCenter.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        order_number: '',
        product_code: '',
        product_name: '',
        quantity_ordered: 0,
        quantity_produced: 0,
        start_date: '',
        end_date: '',
        status: 'planned',
        machine_id: '',
        operator_name: '',
        shift: 'day',
        notes: ''
    });

    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    const generateOrderNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('production_order');
            setFormData(prev => ({ ...prev, order_number: number }));
        } catch (error) {
            console.error("Error generating production order number:", error);
            toast({
                title: "Warning",
                description: "Could not auto-generate order number.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateOrderNumber();
        }
    }, [item]);

    const handleProductSelect = (productCode) => {
        const product = products.find(p => p.material_code === productCode);
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
                return base44.entities.ProductionOrder.update(item.id, data);
            }
            return base44.entities.ProductionOrder.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productions'] });
            toast({
                title: "Success",
                description: `Production order ${item ? 'updated' : 'created'} successfully`,
                variant: "default"
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${item ? 'update' : 'create'} production order: ${error.message}`,
                variant: "destructive",
            });
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {item ? 'Edit Production Order' : 'New Production Order'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Order Number *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formData.order_number}
                                    onChange={(e) => handleChange('order_number', e.target.value)}
                                    required
                                    placeholder="PROD-2025-0001"
                                    disabled={isGeneratingNumber || !!item}
                                />
                                {!item && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={generateOrderNumber}
                                        disabled={isGeneratingNumber}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                            </div>
                        </div>
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
                                    {products.filter(p => p.material_type === 'finished_product').map(p => (
                                        <SelectItem key={p.id} value={p.material_code}>
                                            {p.material_code} - {p.material_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantity Ordered *</Label>
                            <Input 
                                type="number"
                                value={formData.quantity_ordered}
                                onChange={(e) => handleChange('quantity_ordered', parseFloat(e.target.value) || 0)}
                                required
                                min="0"
                            />
                        </div>
                        <div>
                            <Label>Quantity Produced</Label>
                            <Input 
                                type="number"
                                value={formData.quantity_produced}
                                onChange={(e) => handleChange('quantity_produced', parseFloat(e.target.value) || 0)}
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                            <Label>End Date *</Label>
                            <Input 
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => handleChange('end_date', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Work Center</Label>
                            <Select 
                                value={formData.machine_id} 
                                onValueChange={(val) => handleChange('machine_id', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select work center" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workCenters.map(wc => (
                                        <SelectItem key={wc.id} value={wc.work_center_code}>
                                            {wc.work_center_code} - {wc.work_center_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Operator</Label>
                            <Input 
                                value={formData.operator_name}
                                onChange={(e) => handleChange('operator_name', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Shift</Label>
                            <Select 
                                value={formData.shift} 
                                onValueChange={(val) => handleChange('shift', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day</SelectItem>
                                    <SelectItem value="night">Night</SelectItem>
                                    <SelectItem value="both">Both</SelectItem>
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
                                    <SelectItem value="planned">Planned</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
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

                    <div className="flex justify-end gap-3">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={onClose}
                            disabled={saveMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saveMutation.isPending || isGeneratingNumber}
                        >
                            {saveMutation.isPending ? 'Saving...' : (item ? 'Update' : 'Create') + ' Order'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
