import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";

export default function ZATCAConfigForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        config_id: 'zatca_config_1',
        environment: 'sandbox',
        organization_name: '',
        organization_name_ar: '',
        vat_registration_number: '',
        cr_number: '',
        branch_name: '',
        building_number: '',
        street_name: '',
        district: '',
        city: '',
        postal_code: '',
        device_name: 'EGS_Device_1',
        device_serial_number: '',
        auto_submit: true,
        retry_failed: true,
        max_retries: 3,
        status: 'active'
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        }
    }, [item]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (item) {
                return base44.entities.ZATCAConfiguration.update(item.id, data);
            }
            return base44.entities.ZATCAConfiguration.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zatcaConfigs'] });
            toast({
                title: "Success",
                description: "ZATCA configuration saved successfully"
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
                    <DialogTitle>ZATCA Configuration</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="address">Address</TabsTrigger>
                            <TabsTrigger value="device">Device</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4">
                            <div>
                                <Label>Environment *</Label>
                                <Select 
                                    value={formData.environment} 
                                    onValueChange={(val) => setFormData({...formData, environment: val})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sandbox">Sandbox</SelectItem>
                                        <SelectItem value="simulation">Simulation</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Organization Name (English) *</Label>
                                    <Input
                                        value={formData.organization_name}
                                        onChange={(e) => setFormData({...formData, organization_name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Organization Name (Arabic) *</Label>
                                    <Input
                                        value={formData.organization_name_ar}
                                        onChange={(e) => setFormData({...formData, organization_name_ar: e.target.value})}
                                        required
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>VAT Registration Number (15 digits) *</Label>
                                    <Input
                                        value={formData.vat_registration_number}
                                        onChange={(e) => setFormData({...formData, vat_registration_number: e.target.value})}
                                        required
                                        maxLength={15}
                                        placeholder="3##########00003"
                                    />
                                </div>
                                <div>
                                    <Label>CR Number *</Label>
                                    <Input
                                        value={formData.cr_number}
                                        onChange={(e) => setFormData({...formData, cr_number: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Branch Name</Label>
                                <Input
                                    value={formData.branch_name}
                                    onChange={(e) => setFormData({...formData, branch_name: e.target.value})}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="address" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Building Number *</Label>
                                    <Input
                                        value={formData.building_number}
                                        onChange={(e) => setFormData({...formData, building_number: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Street Name *</Label>
                                    <Input
                                        value={formData.street_name}
                                        onChange={(e) => setFormData({...formData, street_name: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>District *</Label>
                                    <Input
                                        value={formData.district}
                                        onChange={(e) => setFormData({...formData, district: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>City *</Label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Postal Code</Label>
                                <Input
                                    value={formData.postal_code}
                                    onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                                    maxLength={5}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="device" className="space-y-4">
                            <div>
                                <Label>Device Name *</Label>
                                <Input
                                    value={formData.device_name}
                                    onChange={(e) => setFormData({...formData, device_name: e.target.value})}
                                    required
                                />
                            </div>

                            <div>
                                <Label>Device Serial Number *</Label>
                                <Input
                                    value={formData.device_serial_number}
                                    onChange={(e) => setFormData({...formData, device_serial_number: e.target.value})}
                                    required
                                    placeholder="1-TST|2-TST|3-##########"
                                />
                            </div>

                            <div className="p-4 bg-blue-50 rounded">
                                <p className="text-sm text-blue-900">
                                    <strong>Note:</strong> Device serial number format should be: 
                                    1-Solution_Name|2-Model_or_Version|3-Serial_Number
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                                <div>
                                    <Label>Auto Submit Invoices</Label>
                                    <p className="text-sm text-gray-600">Automatically submit invoices to ZATCA</p>
                                </div>
                                <Switch 
                                    checked={formData.auto_submit}
                                    onCheckedChange={(val) => setFormData({...formData, auto_submit: val})}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                                <div>
                                    <Label>Auto Retry Failed Submissions</Label>
                                    <p className="text-sm text-gray-600">Retry failed submissions automatically</p>
                                </div>
                                <Switch 
                                    checked={formData.retry_failed}
                                    onCheckedChange={(val) => setFormData({...formData, retry_failed: val})}
                                />
                            </div>

                            <div>
                                <Label>Maximum Retry Attempts</Label>
                                <Input
                                    type="number"
                                    value={formData.max_retries}
                                    onChange={(e) => setFormData({...formData, max_retries: parseInt(e.target.value) || 3})}
                                    min={1}
                                    max={10}
                                />
                            </div>

                            <div>
                                <Label>Status</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => setFormData({...formData, status: val})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            {item ? 'Update' : 'Create'} Configuration
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}