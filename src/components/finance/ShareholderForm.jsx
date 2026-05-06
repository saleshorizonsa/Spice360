import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function ShareholderForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [formData, setFormData] = useState(item || {
        shareholder_id: `SH-${Date.now()}`,
        status: 'active',
        is_saudi_gcc: false,
        effective_from: new Date().toISOString().split('T')[0]
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.Shareholder.update(item.id, data);
            }
            return base44.entities.Shareholder.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['shareholders']);
            toast({
                title: "Success",
                description: `Shareholder ${item ? 'updated' : 'created'} successfully`
            });
            onClose();
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.shareholder_name || !formData.ownership_percentage) {
            toast({
                title: "Validation Error",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }
        saveMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit' : 'New'} Shareholder</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="shareholder_id">Shareholder ID *</Label>
                            <Input
                                id="shareholder_id"
                                value={formData.shareholder_id}
                                onChange={(e) => setFormData({ ...formData, shareholder_id: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="id_number">National ID / Iqama / CR</Label>
                            <Input
                                id="id_number"
                                value={formData.id_number || ''}
                                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="shareholder_name">Shareholder Name *</Label>
                            <Input
                                id="shareholder_name"
                                value={formData.shareholder_name || ''}
                                onChange={(e) => setFormData({ ...formData, shareholder_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="shareholder_name_ar">Shareholder Name (Arabic)</Label>
                            <Input
                                id="shareholder_name_ar"
                                value={formData.shareholder_name_ar || ''}
                                onChange={(e) => setFormData({ ...formData, shareholder_name_ar: e.target.value })}
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nationality">Nationality</Label>
                            <Input
                                id="nationality"
                                value={formData.nationality || ''}
                                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ownership_percentage">Ownership Percentage (%) *</Label>
                            <Input
                                id="ownership_percentage"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={formData.ownership_percentage || ''}
                                onChange={(e) => setFormData({ ...formData, ownership_percentage: parseFloat(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="is_saudi_gcc"
                            checked={formData.is_saudi_gcc || false}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_saudi_gcc: checked })}
                        />
                        <Label htmlFor="is_saudi_gcc" className="cursor-pointer">
                            Saudi or GCC National (Subject to Zakat)
                        </Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="effective_from">Effective From *</Label>
                            <Input
                                id="effective_from"
                                type="date"
                                value={formData.effective_from || ''}
                                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="effective_to">Effective To</Label>
                            <Input
                                id="effective_to"
                                type="date"
                                value={formData.effective_to || ''}
                                onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="contact_email">Contact Email</Label>
                            <Input
                                id="contact_email"
                                type="email"
                                value={formData.contact_email || ''}
                                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact_phone">Contact Phone</Label>
                            <Input
                                id="contact_phone"
                                value={formData.contact_phone || ''}
                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Shareholder
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}