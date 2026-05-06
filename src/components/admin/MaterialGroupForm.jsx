import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function MaterialGroupForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        group_code: '',
        group_name: '',
        group_name_ar: '',
        description: '',
        status: 'active',
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.MaterialGroup.update(item.id, data);
            }
            return base44.entities.MaterialGroup.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialGroups'] });
            toast({
                title: "Success",
                description: `Material Group ${item ? 'updated' : 'created'} successfully`,
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
                    <DialogTitle>{item ? 'Edit Material Group' : 'New Material Group'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Group Code *</Label>
                            <Input
                                value={formData.group_code}
                                onChange={(e) => handleChange('group_code', e.target.value.toUpperCase())}
                                required
                                placeholder="PIPE, FITTING, etc."
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Group Name (English) *</Label>
                            <Input
                                value={formData.group_name}
                                onChange={(e) => handleChange('group_name', e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>Group Name (Arabic)</Label>
                            <Input
                                value={formData.group_name_ar}
                                onChange={(e) => handleChange('group_name_ar', e.target.value)}
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={2}
                        />
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
                            {item ? 'Update' : 'Create'} Group
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}