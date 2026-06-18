
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
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { Package2, RefreshCw, Tag } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { getNextDocumentNumber } from "../utils/documentNumberGenerator";
import { logAuditTrail } from "../utils/auditTrail";
import { calculateCurrentDepreciationStatus } from "../utils/depreciationCalculator";
import { generateAssetTag } from "../utils/assetTagGenerator";

export default function FixedAssetForm({ item, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDirty, setIsDirty] = useState(false);
    const guardedOpenChange = useUnsavedChangesWarning(isDirty);
    const { currentOrg } = useOrganization();
    const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
    const [isGeneratingTag, setIsGeneratingTag] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await matrixSales.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters'],
        queryFn: () => matrixSales.entities.CostCenter.list(),
        initialData: []
    });

    const { data: locations = [] } = useQuery({
        queryKey: ['locations'],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    // Fetch all assets, ordered by asset_tag descending, to get the last one for tag generation
    const { data: allAssets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list('-asset_tag'), // Order by asset_tag descending
        initialData: []
    });

    const [formData, setFormData] = useState({
        asset_number: '',
        asset_tag: '', // New field for asset tag
        asset_name: '',
        asset_class: 'machinery',
        acquisition_date: new Date().toISOString().split('T')[0],
        acquisition_cost: 0,
        useful_life_years: 5,
        depreciation_method: 'straight_line',
        salvage_value: 0,
        accumulated_depreciation: 0,
        net_book_value: 0,
        location_code: '',
        cost_center: '',
        responsible_person: '',
        serial_number: '',
        status: 'active',
        disposal_date: '',
        disposal_amount: 0,
        notes: ''
    });

    useEffect(() => {
        if (item) {
            setFormData(item);
        } else {
            generateAssetNumber();
            generateAssetTagNumber(); // Generate asset tag for new items
        }
    }, [item]);

    useEffect(() => {
        const nbv = (formData.acquisition_cost || 0) - (formData.accumulated_depreciation || 0);
        setFormData(prev => ({ ...prev, net_book_value: nbv }));
    }, [formData.acquisition_cost, formData.accumulated_depreciation]);

    const generateAssetNumber = async () => {
        setIsGeneratingNumber(true);
        try {
            const number = await getNextDocumentNumber('fixed_asset');
            setFormData(prev => ({ ...prev, asset_number: number }));
        } catch (error) {
            console.error("Error generating asset number:", error);
        } finally {
            setIsGeneratingNumber(false);
        }
    };

    const generateAssetTagNumber = async () => {
        setIsGeneratingTag(true);
        try {
            // Get the last asset tag from the fetched assets (they are already ordered descendingly)
            const lastAsset = allAssets.find(a => a.asset_tag);
            const newTag = generateAssetTag(lastAsset?.asset_tag);
            setFormData(prev => ({ ...prev, asset_tag: newTag }));
        } catch (error) {
            console.error("Error generating asset tag:", error);
        } finally {
            setIsGeneratingTag(false);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            let asset;
            const beforeData = item ? { ...item } : null;

            // Calculate current depreciation if creating new asset
            if (!item && data.status === 'active') {
                const depStatus = calculateCurrentDepreciationStatus(
                    data.acquisition_date,
                    data.acquisition_cost,
                    data.salvage_value,
                    data.useful_life_years,
                    data.depreciation_method
                );
                data.accumulated_depreciation = depStatus.accumulated_depreciation;
                data.net_book_value = depStatus.net_book_value;
            }

            if (item) {
                asset = await matrixSales.entities.FixedAsset.update(item.id, data);
                
                await logAuditTrail({
                    entityType: 'fixed_asset',
                    entityId: item.id,
                    documentNumber: data.asset_number,
                    actionType: 'update',
                    beforeData: beforeData,
                    afterData: data,
                    user: currentUser,
                    severity: 'info'
                });
            } else {
                asset = await matrixSales.entities.FixedAsset.create(data);
                
                await logAuditTrail({
                    entityType: 'fixed_asset',
                    entityId: asset.id,
                    documentNumber: data.asset_number,
                    actionType: 'create',
                    afterData: data,
                    user: currentUser,
                    severity: data.acquisition_cost > 100000 ? 'warning' : 'info'
                });
            }

            return asset;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            toast({
                title: "Success",
                description: `Fixed asset ${item ? 'updated' : 'created'} successfully`,
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
        if (!isDirty) setIsDirty(true);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package2 className="w-5 h-5 text-emerald-600" />
                        {item ? 'Edit Fixed Asset' : 'New Fixed Asset'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Asset Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Asset Number *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.asset_number}
                                        onChange={(e) => handleChange('asset_number', e.target.value)}
                                        required
                                        placeholder="FA-2025-0001"
                                        disabled={isGeneratingNumber}
                                    />
                                    {!item && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateAssetNumber}
                                            title="Generate Asset Number"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isGeneratingNumber ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label>Asset Tag (Barcode/QR) *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.asset_tag}
                                        onChange={(e) => handleChange('asset_tag', e.target.value)}
                                        required
                                        placeholder="AT-2025-00001"
                                        disabled={isGeneratingTag}
                                        className="font-mono"
                                    />
                                    {!item && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={generateAssetTagNumber}
                                            title="Generate Asset Tag"
                                        >
                                            <Tag className={`w-4 h-4 ${isGeneratingTag ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Unique tag for barcode/QR code scanning
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Asset Name *</Label>
                                <Input
                                    value={formData.asset_name}
                                    onChange={(e) => handleChange('asset_name', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Serial Number</Label>
                                <Input
                                    value={formData.serial_number}
                                    onChange={(e) => handleChange('serial_number', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Asset Class *</Label>
                                <Select 
                                    value={formData.asset_class} 
                                    onValueChange={(val) => handleChange('asset_class', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="land">Land</SelectItem>
                                        <SelectItem value="building">Building</SelectItem>
                                        <SelectItem value="machinery">Machinery</SelectItem>
                                        <SelectItem value="equipment">Equipment</SelectItem>
                                        <SelectItem value="vehicles">Vehicles</SelectItem>
                                        <SelectItem value="furniture">Furniture</SelectItem>
                                        <SelectItem value="computers">Computers</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
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
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="disposed">Disposed</SelectItem>
                                        <SelectItem value="sold">Sold</SelectItem>
                                        <SelectItem value="retired">Retired</SelectItem>
                                        <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Acquisition & Depreciation</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Acquisition Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.acquisition_date}
                                    onChange={(e) => handleChange('acquisition_date', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Acquisition Cost (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.acquisition_cost}
                                    onChange={(e) => handleChange('acquisition_cost', parseFloat(e.target.value) || 0)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Useful Life (Years) *</Label>
                                <Input
                                    type="number"
                                    value={formData.useful_life_years}
                                    onChange={(e) => handleChange('useful_life_years', parseInt(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Depreciation Method</Label>
                                <Select 
                                    value={formData.depreciation_method} 
                                    onValueChange={(val) => handleChange('depreciation_method', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="straight_line">Straight Line</SelectItem>
                                        <SelectItem value="declining_balance">Declining Balance</SelectItem>
                                        <SelectItem value="units_of_production">Units of Production</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Salvage Value (LKR)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.salvage_value}
                                    onChange={(e) => handleChange('salvage_value', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Accumulated Depreciation:</span>
                                <span className="font-semibold">LKR {formData.accumulated_depreciation.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-lg border-t pt-2">
                                <span className="font-bold">Net Book Value:</span>
                                <span className="font-bold text-emerald-600">
                                    LKR {formData.net_book_value.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Location & Responsibility</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Location</Label>
                                <Select 
                                    value={formData.location_code} 
                                    onValueChange={(val) => handleChange('location_code', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.location_code}>
                                                {loc.location_code} - {loc.location_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Cost Center</Label>
                                <Select 
                                    value={formData.cost_center} 
                                    onValueChange={(val) => handleChange('cost_center', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select cost center" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {costCenters.map(cc => (
                                            <SelectItem key={cc.id} value={cc.cost_center_code}>
                                                {cc.cost_center_code} - {cc.cost_center_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Responsible Person</Label>
                            <Input
                                value={formData.responsible_person}
                                onChange={(e) => handleChange('responsible_person', e.target.value)}
                            />
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
                            {item ? 'Update' : 'Create'} Asset
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
