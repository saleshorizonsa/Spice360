import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, AlertTriangle } from "lucide-react";
import { useOrganization } from "../utils/OrganizationContext";
import { logAuditTrail } from "../utils/auditTrail";
import { createApprovalRequest } from "../utils/approvalWorkflow";
import { postJournalEntry } from "../utils/journalService";
import { useGLAccounts } from "../../hooks/useGLAccounts";

export default function AssetDisposalForm({ asset, onClose }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { currentOrg } = useOrganization();
    const gl = useGLAccounts();
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

    // Fetch maintenance history for this asset
    const { data: maintenanceHistory = [] } = useQuery({
        queryKey: ['maintenance', asset?.asset_number],
        queryFn: async () => {
            if (!asset) return [];
            return await matrixSales.entities.AssetMaintenance.filter({ 
                asset_number: asset.asset_number 
            });
        },
        enabled: !!asset
    });

    const totalMaintenanceCost = maintenanceHistory.reduce((sum, m) => sum + (m.total_cost || 0), 0);
    const maintenanceCount = maintenanceHistory.length;

    // Calculate lifecycle metrics
    const acquisitionDate = new Date(asset?.acquisition_date || Date.now());
    const currentDate = new Date();
    const monthsInUse = Math.floor((currentDate - acquisitionDate) / (1000 * 60 * 60 * 24 * 30));
    const yearsInUse = (monthsInUse / 12).toFixed(1);

    const [formData, setFormData] = useState({
        disposal_id: `DIS-${Date.now()}`,
        asset_number: asset?.asset_number || '',
        asset_name: asset?.asset_name || '',
        asset_tag: asset?.asset_tag || '',
        disposal_type: 'sale',
        disposal_date: new Date().toISOString().split('T')[0],
        original_acquisition_cost: asset?.acquisition_cost || 0,
        accumulated_depreciation: asset?.accumulated_depreciation || 0,
        net_book_value: asset?.net_book_value || 0,
        disposal_value: 0,
        gain_loss: 0,
        buyer_name: '',
        buyer_contact: '',
        disposal_method: 'direct_sale',
        reason_for_disposal: '',
        condition_at_disposal: 'fair',
        total_maintenance_cost: totalMaintenanceCost,
        useful_life_months_utilized: monthsInUse,
        roi_percentage: 0,
        invoice_number: '',
        payment_received: 0,
        payment_status: 'na',
        tax_implications: '',
        environmental_disposal: false,
        certificate_of_destruction: '',
        status: 'pending_approval',
        requested_by: currentUser?.email || '',
        notes: ''
    });

    useEffect(() => {
        if (asset) {
            setFormData(prev => ({
                ...prev,
                asset_number: asset.asset_number,
                asset_name: asset.asset_name,
                asset_tag: asset.asset_tag,
                original_acquisition_cost: asset.acquisition_cost,
                accumulated_depreciation: asset.accumulated_depreciation || 0,
                net_book_value: asset.net_book_value || asset.acquisition_cost,
                total_maintenance_cost: totalMaintenanceCost,
                useful_life_months_utilized: monthsInUse
            }));
        }
    }, [asset, totalMaintenanceCost, monthsInUse]);

    // Auto-calculate gain/loss and ROI
    useEffect(() => {
        const disposalValue = parseFloat(formData.disposal_value) || 0;
        const nbv = parseFloat(formData.net_book_value) || 0;
        const gainLoss = disposalValue - nbv;
        
        // ROI = ((Disposal Value - Total Cost) / Total Cost) * 100
        const totalCost = parseFloat(formData.original_acquisition_cost) + parseFloat(formData.total_maintenance_cost);
        const roi = totalCost > 0 ? ((disposalValue - totalCost) / totalCost) * 100 : 0;

        setFormData(prev => ({
            ...prev,
            gain_loss: gainLoss,
            roi_percentage: roi
        }));
    }, [formData.disposal_value, formData.net_book_value, formData.original_acquisition_cost, formData.total_maintenance_cost]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            // Create disposal record
            const disposal = await matrixSales.entities.AssetDisposal.create(data);

            // Update asset status
            await matrixSales.entities.FixedAsset.update(asset.id, {
                status: data.disposal_type === 'sale' ? 'sold' : 
                        data.disposal_type === 'scrap' ? 'retired' : 'disposed',
                disposal_date: data.disposal_date,
                disposal_amount: data.disposal_value
            });

            // Log audit trail
            await logAuditTrail({
                entityType: 'asset_disposal',
                entityId: disposal.id,
                documentNumber: data.disposal_id,
                actionType: 'create',
                afterData: data,
                user: currentUser,
                severity: 'critical',
                relatedDocumentType: 'fixed_asset',
                relatedDocumentId: asset.id
            });

            // Post GL journal entry for asset disposal
            if (currentOrg?.id) {
                const cost = parseFloat(data.original_acquisition_cost) || 0;
                const accumDep = parseFloat(data.accumulated_depreciation) || 0;
                const proceeds = parseFloat(data.disposal_value) || 0;
                const gainLoss = proceeds - (cost - accumDep);

                const lines = [
                    ...(accumDep > 0 ? [{
                        account_code: gl.accum_depreciation,
                        account_name: "Accumulated Depreciation",
                        debit: accumDep, credit: 0,
                        description: `Disposal: ${data.asset_name}`
                    }] : []),
                    ...(proceeds > 0 ? [{
                        account_code: gl.cash_bank,
                        account_name: "Cash / Bank",
                        debit: proceeds, credit: 0,
                        description: `Disposal proceeds: ${data.asset_name}`
                    }] : []),
                    ...(gainLoss < 0 ? [{
                        account_code: gl.loss_on_disposal,
                        account_name: "Loss on Asset Disposal",
                        debit: Math.abs(gainLoss), credit: 0,
                        description: `Loss on disposal: ${data.asset_name}`
                    }] : []),
                    {
                        account_code: gl.fixed_asset_cost,
                        account_name: "Fixed Assets at Cost",
                        debit: 0, credit: cost,
                        description: `Disposal: ${data.asset_name}`
                    },
                    ...(gainLoss > 0 ? [{
                        account_code: gl.gain_on_disposal,
                        account_name: "Gain on Asset Disposal",
                        debit: 0, credit: gainLoss,
                        description: `Gain on disposal: ${data.asset_name}`
                    }] : []),
                ];

                if (lines.length >= 2) {
                    await postJournalEntry({
                        lines,
                        referenceType: 'asset_disposal',
                        referenceId: data.disposal_id,
                        description: `Asset disposal: ${data.asset_name} (${data.disposal_type})`,
                        entryDate: data.disposal_date,
                        entryType: 'disposal',
                        createdBy: currentUser?.email || '',
                        orgId: currentOrg.id,
                        area: "assets"
                    });
                }
            }

            // Create approval request if disposal value is significant
            if (data.disposal_value > 10000 || data.net_book_value > 50000) {
                await createApprovalRequest({
                    documentType: 'asset_disposal',
                    documentNumber: data.disposal_id,
                    documentId: disposal.id,
                    amount: data.disposal_value,
                    requestedBy: currentUser,
                    branch: currentOrg?.branch_code,
                    notes: `Asset disposal: ${data.asset_name} - ${data.disposal_type}`
                });
            }

            return disposal;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['disposals'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
            queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
            toast({
                title: "Success",
                description: "Asset disposal request submitted for approval",
            });
            onClose();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to submit disposal request",
                variant: "destructive"
            });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.reason_for_disposal) {
            toast({
                title: "Missing Information",
                description: "Please provide reason for disposal",
                variant: "destructive"
            });
            return;
        }
        saveMutation.mutate(formData);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const totalCost = parseFloat(formData.original_acquisition_cost) + parseFloat(formData.total_maintenance_cost);

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-600" />
                        Asset Disposal Request
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Asset Information */}
                    <Card className="bg-gray-50">
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Asset Number</p>
                                    <p className="font-bold">{asset?.asset_number}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Asset Name</p>
                                    <p className="font-bold">{asset?.asset_name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Asset Tag</p>
                                    <p className="font-mono text-xs font-bold">{asset?.asset_tag}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Years in Service</p>
                                    <p className="font-bold">{yearsInUse} years ({monthsInUse} months)</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-4 gap-4">
                        <Card className="bg-blue-50">
                            <CardContent className="pt-4">
                                <p className="text-xs text-blue-700">Original Cost</p>
                                <p className="text-lg font-bold text-blue-900">
                                    LKR {formData.original_acquisition_cost.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-50">
                            <CardContent className="pt-4">
                                <p className="text-xs text-red-700">Accumulated Dep.</p>
                                <p className="text-lg font-bold text-red-900">
                                    LKR {formData.accumulated_depreciation.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-50">
                            <CardContent className="pt-4">
                                <p className="text-xs text-emerald-700">Current NBV</p>
                                <p className="text-lg font-bold text-emerald-900">
                                    LKR {formData.net_book_value.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-purple-50">
                            <CardContent className="pt-4">
                                <p className="text-xs text-purple-700">Maintenance Cost</p>
                                <p className="text-lg font-bold text-purple-900">
                                    LKR {totalMaintenanceCost.toLocaleString()}
                                </p>
                                <p className="text-xs text-purple-600">{maintenanceCount} services</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Disposal Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Disposal Details</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Disposal ID *</Label>
                                <Input
                                    value={formData.disposal_id}
                                    onChange={(e) => handleChange('disposal_id', e.target.value)}
                                    required
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <Label>Disposal Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.disposal_date}
                                    onChange={(e) => handleChange('disposal_date', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Disposal Type *</Label>
                                <Select 
                                    value={formData.disposal_type} 
                                    onValueChange={(val) => handleChange('disposal_type', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sale">Sale</SelectItem>
                                        <SelectItem value="scrap">Scrap</SelectItem>
                                        <SelectItem value="donation">Donation</SelectItem>
                                        <SelectItem value="trade_in">Trade-In</SelectItem>
                                        <SelectItem value="write_off">Write-Off</SelectItem>
                                        <SelectItem value="transfer">Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Disposal Method</Label>
                                <Select 
                                    value={formData.disposal_method} 
                                    onValueChange={(val) => handleChange('disposal_method', val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auction">Auction</SelectItem>
                                        <SelectItem value="direct_sale">Direct Sale</SelectItem>
                                        <SelectItem value="trade_in">Trade-In</SelectItem>
                                        <SelectItem value="donation">Donation</SelectItem>
                                        <SelectItem value="scrap_yard">Scrap Yard</SelectItem>
                                        <SelectItem value="internal_transfer">Internal Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Condition at Disposal *</Label>
                            <Select 
                                value={formData.condition_at_disposal} 
                                onValueChange={(val) => handleChange('condition_at_disposal', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="excellent">Excellent</SelectItem>
                                    <SelectItem value="good">Good</SelectItem>
                                    <SelectItem value="fair">Fair</SelectItem>
                                    <SelectItem value="poor">Poor</SelectItem>
                                    <SelectItem value="non_functional">Non-Functional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Reason for Disposal *</Label>
                            <Textarea
                                value={formData.reason_for_disposal}
                                onChange={(e) => handleChange('reason_for_disposal', e.target.value)}
                                required
                                rows={2}
                                placeholder="End of useful life, obsolete, damaged beyond repair, etc."
                            />
                        </div>
                    </div>

                    {/* Financial Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Financial Details</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Disposal Value (LKR) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.disposal_value}
                                    onChange={(e) => handleChange('disposal_value', parseFloat(e.target.value) || 0)}
                                    required
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <Label>Invoice Number</Label>
                                <Input
                                    value={formData.invoice_number}
                                    onChange={(e) => handleChange('invoice_number', e.target.value)}
                                    placeholder="INV-2025-001"
                                />
                            </div>
                        </div>

                        {/* Calculated Metrics */}
                        <div className="grid grid-cols-3 gap-4">
                            <Card className={formData.gain_loss >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                                <CardContent className="pt-4">
                                    <p className="text-xs text-gray-700">Gain/Loss on Disposal</p>
                                    <p className={`text-xl font-bold ${formData.gain_loss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {formData.gain_loss >= 0 ? '+' : ''}LKR {formData.gain_loss.toLocaleString()}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-purple-50 border-purple-200">
                                <CardContent className="pt-4">
                                    <p className="text-xs text-purple-700">Total Investment</p>
                                    <p className="text-xl font-bold text-purple-900">
                                        LKR {totalCost.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-purple-600">Cost + Maintenance</p>
                                </CardContent>
                            </Card>

                            <Card className={formData.roi_percentage >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}>
                                <CardContent className="pt-4">
                                    <p className="text-xs text-gray-700">ROI</p>
                                    <p className={`text-xl font-bold ${formData.roi_percentage >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                                        {formData.roi_percentage >= 0 ? '+' : ''}{formData.roi_percentage.toFixed(1)}%
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {formData.disposal_type === 'sale' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Payment Received (LKR)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formData.payment_received}
                                        onChange={(e) => handleChange('payment_received', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <Label>Payment Status</Label>
                                    <Select 
                                        value={formData.payment_status} 
                                        onValueChange={(val) => handleChange('payment_status', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="partial">Partial</SelectItem>
                                            <SelectItem value="full">Full</SelectItem>
                                            <SelectItem value="na">N/A</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Buyer/Recipient Information */}
                    {(formData.disposal_type === 'sale' || formData.disposal_type === 'donation') && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">
                                {formData.disposal_type === 'sale' ? 'Buyer' : 'Recipient'} Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Name</Label>
                                    <Input
                                        value={formData.buyer_name}
                                        onChange={(e) => handleChange('buyer_name', e.target.value)}
                                        placeholder="Company or individual name"
                                    />
                                </div>
                                <div>
                                    <Label>Contact</Label>
                                    <Input
                                        value={formData.buyer_contact}
                                        onChange={(e) => handleChange('buyer_contact', e.target.value)}
                                        placeholder="Phone or email"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Additional Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Additional Details</h3>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <Label className="mb-0">Requires Environmental Disposal</Label>
                            </div>
                            <Switch
                                checked={formData.environmental_disposal}
                                onCheckedChange={(val) => handleChange('environmental_disposal', val)}
                            />
                        </div>

                        {formData.environmental_disposal && (
                            <div>
                                <Label>Certificate of Destruction</Label>
                                <Input
                                    value={formData.certificate_of_destruction}
                                    onChange={(e) => handleChange('certificate_of_destruction', e.target.value)}
                                    placeholder="Certificate reference number"
                                />
                            </div>
                        )}

                        <div>
                            <Label>Tax Implications / Notes</Label>
                            <Textarea
                                value={formData.tax_implications}
                                onChange={(e) => handleChange('tax_implications', e.target.value)}
                                rows={2}
                                placeholder="VAT considerations, tax deductions, etc."
                            />
                        </div>

                        <div>
                            <Label>Additional Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                                placeholder="Any other relevant information..."
                            />
                        </div>
                    </div>

                    {/* Maintenance History Summary */}
                    {maintenanceHistory.length > 0 && (
                        <Card className="bg-yellow-50 border-yellow-200">
                            <CardContent className="pt-4">
                                <h4 className="font-semibold text-sm mb-2">Maintenance History Impact</h4>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600">Total Services</p>
                                        <p className="font-bold">{maintenanceCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Total Maintenance Cost</p>
                                        <p className="font-bold">LKR {totalMaintenanceCost.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Cost per Year</p>
                                        <p className="font-bold">
                                            LKR {yearsInUse > 0 ? (totalMaintenanceCost / yearsInUse).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Warning for significant disposal */}
                    {(formData.disposal_value > 10000 || formData.net_book_value > 50000) && (
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="pt-4">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-blue-900">Approval Required</p>
                                        <p className="text-sm text-blue-700">
                                            This disposal will be submitted for approval due to its significant value
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="bg-red-600 hover:bg-red-700"
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Submitting...' : 'Submit Disposal Request'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}