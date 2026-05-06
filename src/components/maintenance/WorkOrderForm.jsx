
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

export default function WorkOrderForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        work_order_number: '',
        order_type: 'preventive',
        equipment_code: '',
        equipment_name: '',
        problem_description: '',
        created_date: new Date().toISOString().split('T')[0],
        required_date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        assigned_to: '',
        status: 'open'
    });
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

    const { data: equipment = [] } = useQuery({
        queryKey: ['equipment'],
        queryFn: () => matrixSales.entities.Equipment.list(),
        initialData: []
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateWONumber();
        }
    }, [item]);

    const generateWONumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('work_order');
            setFormData(prev => ({ ...prev, work_order_number: number }));
        } catch (error) {
            console.error("Error generating work order number:", error);
            toast({
                title: "Error",
                description: "Failed to generate work order number.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return matrixSales.entities.WorkOrder.update(item.id, data);
            }
            return matrixSales.entities.WorkOrder.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workOrders'] });
            toast({
                title: "Success",
                description: "Work order saved successfully"
            });
            onClose();
        },
        onError: (error) => {
            console.error("Error saving work order:", error);
            toast({
                title: "Error",
                description: "Failed to save work order. " + (error.message || "Please try again."),
                variant: "destructive",
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Work Order</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Work Order Number</Label>
                            <Input
                                value={formData.work_order_number}
                                onChange={(e) => setFormData({...formData, work_order_number: e.target.value})}
                                required
                                disabled={isGeneratingNumber || !!item} // Disable if generating or for existing items
                                placeholder={isGeneratingNumber ? "Generating..." : ""}
                            />
                        </div>
                        <div>
                            <Label>Order Type</Label>
                            <Select
                                value={formData.order_type}
                                onValueChange={(value) => setFormData({...formData, order_type: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="preventive">Preventive</SelectItem>
                                    <SelectItem value="corrective">Corrective</SelectItem>
                                    <SelectItem value="breakdown">Breakdown</SelectItem>
                                    <SelectItem value="inspection">Inspection</SelectItem>
                                    <SelectItem value="modification">Modification</SelectItem>
                                    <SelectItem value="installation">Installation</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Equipment</Label>
                            <Select
                                value={formData.equipment_code}
                                onValueChange={(value) => {
                                    const selectedEquip = equipment.find(e => e.equipment_code === value);
                                    setFormData({
                                        ...formData, 
                                        equipment_code: value,
                                        equipment_name: selectedEquip?.equipment_name || ''
                                    });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select equipment" />
                                </SelectTrigger>
                                <SelectContent>
                                    {equipment.map(e => (
                                        <SelectItem key={e.equipment_code} value={e.equipment_code}>
                                            {e.equipment_code} - {e.equipment_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Priority</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(value) => setFormData({...formData, priority: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="emergency">Emergency</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Problem Description</Label>
                        <Textarea
                            value={formData.problem_description}
                            onChange={(e) => setFormData({...formData, problem_description: e.target.value})}
                            rows={3}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Created Date</Label>
                            <Input
                                type="date"
                                value={formData.created_date}
                                onChange={(e) => setFormData({...formData, created_date: e.target.value})}
                                required
                            />
                        </div>
                        <div>
                            <Label>Required Date</Label>
                            <Input
                                type="date"
                                value={formData.required_date}
                                onChange={(e) => setFormData({...formData, required_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Assigned To</Label>
                        <Input
                            value={formData.assigned_to}
                            onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saveMutation.isPending || isGeneratingNumber}>
                            {saveMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
