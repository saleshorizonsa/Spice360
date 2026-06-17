
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
import { processProductionReceipt } from "../utils/inventoryIntegration";
import { postJournalEntry } from "../utils/journalService";
import { useOrganization } from "../utils/OrganizationContext";
import { useGLAccounts } from "@/hooks/useGLAccounts";

export default function ProductionOrderForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();

    const { data: products = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: workCenters = [] } = useQuery({
        queryKey: ['workCenters'],
        queryFn: () => matrixSales.entities.WorkCenter.list(),
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
        mutationFn: async (data) => {
            const prevStatus = item?.status;
            let order;

            if (item) {
                order = await matrixSales.entities.ProductionOrder.update(item.id, data);
            } else {
                order = await matrixSales.entities.ProductionOrder.create(data);
            }

            // On completion: post finished-goods inventory and GL (non-fatal)
            const isCompletion = prevStatus !== 'completed' && data.status === 'completed';
            if (isCompletion && (parseFloat(data.quantity_produced) || 0) > 0) {
                try {
                    await processProductionReceipt(data);
                } catch (_) { /* non-fatal */ }

                try {
                    // Look up material cost for GL valuation
                    const mats = await matrixSales.entities.Material.filter({ material_code: data.product_code });
                    const unitCost = parseFloat(mats?.[0]?.unit_cost) || 0;
                    const fgValue = (parseFloat(data.quantity_produced) || 0) * unitCost;

                    if (fgValue > 0) {
                        await postJournalEntry({
                            description: `Production completion — ${data.order_number}`,
                            entryDate: data.end_date || new Date().toISOString().slice(0, 10),
                            referenceType: "production_order",
                            referenceId: order.id,
                            entryType: "production",
                            lines: [
                                { accountCode: gl.inventory,          accountName: "Finished Goods Inventory", debitAmount: fgValue, creditAmount: 0, description: data.product_name },
                                { accountCode: gl.accrued_mfg_costs,  accountName: "Accrued Manufacturing Costs", debitAmount: 0, creditAmount: fgValue, description: data.order_number },
                            ],
                            orgId: currentOrg?.id,
                        });
                    }
                } catch (_) { /* non-fatal */ }
            }

            return order;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productions'] });
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
            queryClient.invalidateQueries({ queryKey: ['movements'] });
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
