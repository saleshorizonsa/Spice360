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

export default function COAForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        coa_number: '',
        coa_date: new Date().toISOString().split('T')[0],
        inspection_lot_number: '',
        material_code: '',
        material_name: '',
        batch_number: '',
        manufacturing_date: new Date().toISOString().split('T')[0],
        quantity: 0,
        unit_of_measure: 'kg',
        customer_name: '',
        sales_order_number: '',
        test_results_summary: '',
        conclusion: 'complies',
        approved_by: '',
        status: 'draft'
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => matrixSales.entities.Material.list(),
        initialData: []
    });

    const { data: inspectionLots = [] } = useQuery({
        queryKey: ['inspectionLots'],
        queryFn: () => matrixSales.entities.InspectionLot.list(),
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
                return matrixSales.entities.CertificateOfAnalysis.update(item.id, data);
            }
            return matrixSales.entities.CertificateOfAnalysis.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coas'] });
            toast({
                title: "Success",
                description: `COA ${item ? 'updated' : 'created'} successfully`
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
                        {item ? 'Edit Certificate of Analysis' : 'Generate Certificate of Analysis'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>COA Number *</Label>
                            <Input
                                value={formData.coa_number}
                                onChange={(e) => setFormData({...formData, coa_number: e.target.value})}
                                required
                                placeholder="COA-2025-0001"
                            />
                        </div>
                        <div>
                            <Label>COA Date *</Label>
                            <Input
                                type="date"
                                value={formData.coa_date}
                                onChange={(e) => setFormData({...formData, coa_date: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Inspection Lot *</Label>
                        <Select 
                            value={formData.inspection_lot_number} 
                            onValueChange={(val) => {
                                const lot = inspectionLots.find(l => l.inspection_lot_number === val);
                                if (lot) {
                                    setFormData({
                                        ...formData,
                                        inspection_lot_number: val,
                                        material_code: lot.material_code,
                                        material_name: lot.material_name,
                                        batch_number: lot.batch_number,
                                        quantity: lot.quantity_to_inspect,
                                        unit_of_measure: lot.unit_of_measure
                                    });
                                }
                            }}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select inspection lot" />
                            </SelectTrigger>
                            <SelectContent>
                                {inspectionLots.filter(l => l.result === 'accepted').map(l => (
                                    <SelectItem key={l.id} value={l.inspection_lot_number}>
                                        {l.inspection_lot_number} - {l.material_name} ({l.batch_number})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Material</Label>
                            <Input
                                value={formData.material_name}
                                disabled
                            />
                        </div>
                        <div>
                            <Label>Batch Number</Label>
                            <Input
                                value={formData.batch_number}
                                disabled
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Manufacturing Date</Label>
                            <Input
                                type="date"
                                value={formData.manufacturing_date}
                                onChange={(e) => setFormData({...formData, manufacturing_date: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Quantity</Label>
                            <Input
                                type="number"
                                value={formData.quantity}
                                disabled
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Customer Name</Label>
                            <Input
                                value={formData.customer_name}
                                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label>Sales Order #</Label>
                            <Input
                                value={formData.sales_order_number}
                                onChange={(e) => setFormData({...formData, sales_order_number: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Test Results Summary</Label>
                        <Textarea
                            value={formData.test_results_summary}
                            onChange={(e) => setFormData({...formData, test_results_summary: e.target.value})}
                            rows={4}
                            placeholder="Summary of all test results"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Conclusion *</Label>
                            <Select 
                                value={formData.conclusion} 
                                onValueChange={(val) => setFormData({...formData, conclusion: val})}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="complies">Complies</SelectItem>
                                    <SelectItem value="does_not_comply">Does Not Comply</SelectItem>
                                    <SelectItem value="conditional">Conditional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Approved By</Label>
                            <Input
                                value={formData.approved_by}
                                onChange={(e) => setFormData({...formData, approved_by: e.target.value})}
                                placeholder="QA Manager"
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
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="issued">Issued</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving...' : item ? 'Update' : 'Generate'} COA
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}