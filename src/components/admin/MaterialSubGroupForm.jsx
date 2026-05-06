import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function MaterialSubGroupForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        subgroup_code: '',
        subgroup_name: '',
        subgroup_name_ar: '',
        group_code: '',
        group_name: '',
        description: '',
        status: 'active',
        notes: ''
    });

    const { data: materialGroups = [] } = useQuery({
        queryKey: ['materialGroups'],
        queryFn: () => matrixSales.entities.MaterialGroup.list(),
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
                return matrixSales.entities.MaterialSubGroup.update(item.id, data);
            }
            return matrixSales.entities.MaterialSubGroup.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialSubGroups'] });
            toast({
                title: "Success",
                description: `Material Sub-Group ${item ? 'updated' : 'created'} successfully`,
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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit Material Sub-Group' : 'New Material Sub-Group'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Sub-Group Code *</Label>
                            <Input
                                value={formData.subgroup_code}
                                onChange={(e) => handleChange('subgroup_code', e.target.value.toUpperCase())}
                                required
                                placeholder="PIPE-PVC, FIT-ELBOW, etc."
                            />
                        </div>
                        <div>
                            <Label>Parent Material Group *</Label>
                            <Select 
                                value={formData.group_code} 
                                onValueChange={(val) => {
                                    handleChange('group_code', val);
                                    const group = materialGroups.find(g => g.group_code === val);
                                    if (group) handleChange('group_name', group.group_name);
                                }}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materialGroups.filter(g => g.status === 'active').map(group => (
                                        <SelectItem key={group.group_code} value={group.group_code}>
                                            {group.group_code} - {group.group_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Sub-Group Name (English) *</Label>
                            <Input
                                value={formData.subgroup_name}
                                onChange={(e) => handleChange('subgroup_name', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Sub-Group Name (Arabic)</Label>
                            <Input
                                value={formData.subgroup_name_ar}
                                onChange={(e) => handleChange('subgroup_name_ar', e.target.value)}
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={2}
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
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Sub-Group
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}