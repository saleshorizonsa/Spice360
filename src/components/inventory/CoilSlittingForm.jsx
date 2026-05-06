import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Scissors, AlertTriangle } from "lucide-react";

export default function CoilSlittingForm({ onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            const user = await matrixSales.auth.me();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    const { data: coils = [] } = useQuery({
        queryKey: ['coils'],
        queryFn: () => matrixSales.entities.Coil.list(),
        initialData: []
    });

    const [formData, setFormData] = useState({
        slitting_number: `SLIT-${Date.now()}`,
        parent_coil_number: '',
        slit_weight: 0,
        new_coil_number: '',
        slitting_reason: 'production_requirement',
        production_order_number: '',
        machine_id: '',
        scrap_weight: 0,
        notes: ''
    });

    const [selectedCoil, setSelectedCoil] = useState(null);

    const availableCoils = coils.filter(c => 
        c.status === 'available' && 
        c.qc_status === 'approved' && 
        c.current_weight > 0
    );

    const handleCoilSelect = (coilNumber) => {
        const coil = coils.find(c => c.coil_number === coilNumber);
        if (coil) {
            setSelectedCoil(coil);
            setFormData(prev => ({
                ...prev,
                parent_coil_number: coilNumber
            }));
        }
    };

    const slittingMutation = useMutation({
        mutationFn: async (data) => {
            if (!selectedCoil) throw new Error("No coil selected");
            
            const slitWeight = parseFloat(data.slit_weight);
            const scrapWeight = parseFloat(data.scrap_weight) || 0;
            
            if (slitWeight + scrapWeight > selectedCoil.current_weight) {
                throw new Error("Slit weight + scrap exceeds available weight");
            }

            const newCoilWeight = slitWeight;
            const remainingWeight = selectedCoil.current_weight - slitWeight - scrapWeight;

            const slittingRecord = await matrixSales.entities.CoilSlitting.create({
                slitting_number: data.slitting_number,
                slitting_date: new Date().toISOString(),
                parent_coil_number: selectedCoil.coil_number,
                parent_material_code: selectedCoil.material_code,
                parent_original_weight: selectedCoil.original_weight,
                parent_weight_before_slitting: selectedCoil.current_weight,
                slit_weight: slitWeight,
                parent_weight_after_slitting: remainingWeight,
                new_coil_number: data.new_coil_number,
                new_coil_weight: newCoilWeight,
                slitting_reason: data.slitting_reason,
                production_order_number: data.production_order_number,
                performed_by: currentUser?.email,
                performed_by_name: currentUser?.full_name,
                machine_id: data.machine_id,
                scrap_weight: scrapWeight,
                notes: data.notes
            });

            await matrixSales.entities.Coil.update(selectedCoil.id, {
                current_weight: remainingWeight,
                status: remainingWeight > 0 ? 'slit' : 'exhausted'
            });

            await matrixSales.entities.Coil.create({
                coil_number: data.new_coil_number,
                material_code: selectedCoil.material_code,
                material_name: selectedCoil.material_name,
                supplier_batch_number: selectedCoil.supplier_batch_number,
                grn_number: selectedCoil.grn_number,
                po_number: selectedCoil.po_number,
                received_date: new Date().toISOString().split('T')[0],
                original_weight: newCoilWeight,
                current_weight: newCoilWeight,
                width_mm: selectedCoil.width_mm,
                thickness_mm: selectedCoil.thickness_mm,
                location_code: selectedCoil.location_code,
                warehouse_bin: selectedCoil.warehouse_bin,
                qc_status: 'approved',
                status: data.production_order_number ? 'reserved' : 'available',
                is_parent_coil: false,
                parent_coil_number: selectedCoil.coil_number,
                production_order_number: data.production_order_number,
                reserved_date: data.production_order_number ? new Date().toISOString() : null,
                notes: `Slit from ${selectedCoil.coil_number}`
            });

            return slittingRecord;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coils'] });
            queryClient.invalidateQueries({ queryKey: ['coilSlittings'] });
            toast({
                title: "Success",
                description: "Coil slit successfully",
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        slittingMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-emerald-600" />
                        Slit Coil
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <Label>Slitting Number</Label>
                        <Input
                            value={formData.slitting_number}
                            onChange={(e) => handleChange('slitting_number', e.target.value)}
                            disabled
                        />
                    </div>

                    <div>
                        <Label>Parent Coil *</Label>
                        <Select 
                            value={formData.parent_coil_number} 
                            onValueChange={handleCoilSelect}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select coil to slit" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableCoils.map(c => (
                                    <SelectItem key={c.id} value={c.coil_number}>
                                        {c.coil_number} - {c.material_name} ({c.current_weight} kg available)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedCoil && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <Label className="text-xs text-blue-900">Material</Label>
                                    <p className="font-medium">{selectedCoil.material_name}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-blue-900">Available Weight</Label>
                                    <p className="font-medium">{selectedCoil.current_weight} kg</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-blue-900">Dimensions</Label>
                                    <p className="font-medium">{selectedCoil.width_mm} × {selectedCoil.thickness_mm} mm</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Slit Weight (kg) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.slit_weight}
                                onChange={(e) => handleChange('slit_weight', parseFloat(e.target.value) || 0)}
                                required
                                disabled={!selectedCoil}
                            />
                        </div>
                        <div>
                            <Label>New Coil Number *</Label>
                            <Input
                                value={formData.new_coil_number}
                                onChange={(e) => handleChange('new_coil_number', e.target.value)}
                                required
                                placeholder="COIL-2025-002"
                                disabled={!selectedCoil}
                            />
                        </div>
                        <div>
                            <Label>Scrap Weight (kg)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.scrap_weight}
                                onChange={(e) => handleChange('scrap_weight', parseFloat(e.target.value) || 0)}
                                disabled={!selectedCoil}
                            />
                        </div>
                    </div>

                    {selectedCoil && formData.slit_weight > 0 && (
                        <Alert className={
                            formData.slit_weight + (formData.scrap_weight || 0) > selectedCoil.current_weight 
                                ? "border-red-200 bg-red-50" 
                                : "border-green-200 bg-green-50"
                        }>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription>
                                <div className="text-sm">
                                    <p className="font-semibold mb-1">Slitting Calculation:</p>
                                    <p>Slit Weight: {formData.slit_weight} kg</p>
                                    <p>Scrap Weight: {formData.scrap_weight || 0} kg</p>
                                    <p className="font-bold mt-2">
                                        Remaining: {(selectedCoil.current_weight - formData.slit_weight - (formData.scrap_weight || 0)).toFixed(2)} kg
                                    </p>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Slitting Reason *</Label>
                            <Select 
                                value={formData.slitting_reason} 
                                onValueChange={(val) => handleChange('slitting_reason', val)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="production_requirement">Production Requirement</SelectItem>
                                    <SelectItem value="quality_segregation">Quality Segregation</SelectItem>
                                    <SelectItem value="customer_order">Customer Order</SelectItem>
                                    <SelectItem value="stock_rebalancing">Stock Rebalancing</SelectItem>
                                    <SelectItem value="partial_damage">Partial Damage</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Production Order #</Label>
                            <Input
                                value={formData.production_order_number}
                                onChange={(e) => handleChange('production_order_number', e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Slitting Machine ID</Label>
                        <Input
                            value={formData.machine_id}
                            onChange={(e) => handleChange('machine_id', e.target.value)}
                            placeholder="e.g., SLT-01"
                        />
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
                        <Button 
                            type="submit" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={!selectedCoil || slittingMutation.isPending}
                        >
                            <Scissors className="w-4 h-4 mr-2" />
                            Perform Slitting
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}