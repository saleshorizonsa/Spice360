import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
    Scan, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle,
    Package2,
    Navigation
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { parseAssetQRData } from "../utils/assetTagGenerator";
import { logAuditTrail } from "../utils/auditTrail";

export default function AssetVerificationInterface({ taskId, onComplete }) {
    const [currentAssetTag, setCurrentAssetTag] = useState('');
    const [currentAsset, setCurrentAsset] = useState(null);
    const [verificationData, setVerificationData] = useState({
        actual_location: '',
        actual_condition: 'good',
        actual_responsible_person: '',
        verification_status: 'verified',
        discrepancy_details: '',
        notes: ''
    });
    const [currentUser, setCurrentUser] = useState(null);
    const [gpsPosition, setGpsPosition] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();

        // Get GPS location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGpsPosition({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => console.log('GPS error:', error)
            );
        }
    }, []);

    const { data: task } = useQuery({
        queryKey: ['verificationTask', taskId],
        queryFn: async () => {
            const tasks = await base44.entities.AssetVerificationTask.filter({ task_id: taskId });
            return tasks[0];
        },
        enabled: !!taskId
    });

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => base44.entities.FixedAsset.list(),
        initialData: []
    });

    const { data: verifications = [] } = useQuery({
        queryKey: ['verifications', taskId],
        queryFn: () => base44.entities.AssetVerification.filter({ task_id: taskId }),
        initialData: [],
        enabled: !!taskId
    });

    const verifyMutation = useMutation({
        mutationFn: async (data) => {
            const verification = await base44.entities.AssetVerification.create(data);
            
            // Update task statistics
            if (task) {
                const newVerifiedCount = verifications.filter(v => v.verification_status === 'verified').length + 
                    (data.verification_status === 'verified' ? 1 : 0);
                const newDiscrepancyCount = verifications.filter(v => v.verification_status === 'discrepancy').length + 
                    (data.verification_status === 'discrepancy' ? 1 : 0);
                const newNotFoundCount = verifications.filter(v => v.verification_status === 'not_found').length + 
                    (data.verification_status === 'not_found' ? 1 : 0);
                const totalVerified = verifications.length + 1;
                const completionPct = (totalVerified / task.total_assets) * 100;

                await base44.entities.AssetVerificationTask.update(task.id, {
                    verified_count: newVerifiedCount,
                    discrepancy_count: newDiscrepancyCount,
                    not_found_count: newNotFoundCount,
                    completion_percentage: Math.round(completionPct),
                    status: completionPct >= 100 ? 'completed' : 'in_progress'
                });
            }

            // Update asset last scanned info
            if (currentAsset) {
                await base44.entities.FixedAsset.update(currentAsset.id, {
                    last_scanned_date: new Date().toISOString(),
                    last_scanned_by: currentUser?.email
                });
            }

            // Log audit trail
            await logAuditTrail({
                entityType: 'asset_verification',
                entityId: verification.id,
                documentNumber: data.verification_id,
                actionType: 'create',
                afterData: data,
                user: currentUser,
                severity: data.verification_status === 'verified' ? 'info' : 'warning',
                relatedDocumentType: 'asset_verification_task',
                relatedDocumentId: taskId
            });

            return verification;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['verifications'] });
            queryClient.invalidateQueries({ queryKey: ['verificationTask'] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['auditTrails'] });
            
            toast({
                title: "Verified",
                description: `Asset ${currentAsset?.asset_tag} verified successfully`,
            });

            // Reset form
            setCurrentAsset(null);
            setCurrentAssetTag('');
            setVerificationData({
                actual_location: '',
                actual_condition: 'good',
                actual_responsible_person: '',
                verification_status: 'verified',
                discrepancy_details: '',
                notes: ''
            });
        }
    });

    const handleScanAsset = () => {
        if (!currentAssetTag.trim()) {
            toast({
                title: "Error",
                description: "Please enter an asset tag",
                variant: "destructive"
            });
            return;
        }

        let searchTag = currentAssetTag.trim();
        try {
            const qrData = parseAssetQRData(currentAssetTag);
            if (qrData.asset_tag) {
                searchTag = qrData.asset_tag;
            }
        } catch (e) {
            // Not QR data
        }

        const found = assets.find(a => 
            a.asset_tag === searchTag || 
            a.asset_number === searchTag ||
            a.serial_number === searchTag
        );

        if (found) {
            setCurrentAsset(found);
            setVerificationData({
                actual_location: found.location_code || '',
                actual_condition: 'good',
                actual_responsible_person: found.responsible_person || '',
                verification_status: 'verified',
                discrepancy_details: '',
                notes: ''
            });
        } else {
            toast({
                title: "Not Found",
                description: "Asset not found in system",
                variant: "destructive"
            });
        }
    };

    const handleSubmitVerification = () => {
        if (!currentAsset) return;

        const locationMatch = verificationData.actual_location === currentAsset.location_code;
        const custodianMatch = verificationData.actual_responsible_person === currentAsset.responsible_person;
        
        const data = {
            verification_id: `VER-${Date.now()}`,
            task_id: taskId,
            asset_tag: currentAsset.asset_tag,
            asset_number: currentAsset.asset_number,
            asset_name: currentAsset.asset_name,
            verification_date: new Date().toISOString(),
            verified_by: currentUser?.email,
            verified_by_name: currentUser?.full_name,
            verification_method: 'physical_inspection',
            verification_status: verificationData.verification_status,
            expected_location: currentAsset.location_code,
            actual_location: verificationData.actual_location,
            location_match: locationMatch,
            actual_condition: verificationData.actual_condition,
            condition_match: verificationData.actual_condition === 'good',
            expected_responsible_person: currentAsset.responsible_person,
            actual_responsible_person: verificationData.actual_responsible_person,
            custodian_match: custodianMatch,
            serial_number_verified: true,
            discrepancy_details: verificationData.discrepancy_details,
            action_required: verificationData.verification_status !== 'verified',
            follow_up_completed: false,
            gps_latitude: gpsPosition?.latitude,
            gps_longitude: gpsPosition?.longitude,
            notes: verificationData.notes
        };

        verifyMutation.mutate(data);
    };

    const alreadyVerified = currentAsset && verifications.some(v => v.asset_tag === currentAsset.asset_tag);
    const progressPct = task ? (verifications.length / task.total_assets) * 100 : 0;

    return (
        <div className="space-y-4">
            {/* Task Header */}
            {task && (
                <Card className="bg-gradient-to-r from-emerald-50 to-green-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-lg">{task.task_name}</h3>
                                <p className="text-sm text-gray-600">
                                    {task.location_name || 'All Locations'} • {task.task_type}
                                </p>
                            </div>
                            <Badge className={
                                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                            }>
                                {task.status}
                            </Badge>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span className="font-semibold">
                                    {verifications.length} / {task.total_assets} assets ({Math.round(progressPct)}%)
                                </span>
                            </div>
                            <Progress value={progressPct} className="h-2" />
                            
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <div className="bg-white p-2 rounded text-center">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto mb-1" />
                                    <p className="text-xs text-gray-600">Verified</p>
                                    <p className="font-bold text-green-700">{task.verified_count || 0}</p>
                                </div>
                                <div className="bg-white p-2 rounded text-center">
                                    <AlertTriangle className="w-4 h-4 text-yellow-600 mx-auto mb-1" />
                                    <p className="text-xs text-gray-600">Discrepancy</p>
                                    <p className="font-bold text-yellow-700">{task.discrepancy_count || 0}</p>
                                </div>
                                <div className="bg-white p-2 rounded text-center">
                                    <XCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
                                    <p className="text-xs text-gray-600">Not Found</p>
                                    <p className="font-bold text-red-700">{task.not_found_count || 0}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Scan Asset */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Scan className="w-5 h-5 text-emerald-600" />
                        Scan Asset
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter or scan asset tag"
                            value={currentAssetTag}
                            onChange={(e) => setCurrentAssetTag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleScanAsset()}
                            className="flex-1"
                            autoFocus
                        />
                        <Button onClick={handleScanAsset} className="bg-emerald-600 hover:bg-emerald-700">
                            <Scan className="w-4 h-4" />
                        </Button>
                    </div>

                    {alreadyVerified && (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                                This asset has already been verified in this task
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Asset Details & Verification */}
            {currentAsset && (
                <Card className="border-emerald-200 border-2">
                    <CardHeader className="bg-emerald-50">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Package2 className="w-5 h-5 text-emerald-600" />
                                {currentAsset.asset_name}
                            </CardTitle>
                            <span className="font-mono text-sm font-bold">{currentAsset.asset_tag}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {/* System Information */}
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                            <h4 className="font-semibold">System Information</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-600">Asset #:</span>
                                    <span className="ml-2 font-medium">{currentAsset.asset_number}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Class:</span>
                                    <span className="ml-2 font-medium">{currentAsset.asset_class}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Location:</span>
                                    <span className="ml-2 font-medium">{currentAsset.location_code || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Custodian:</span>
                                    <span className="ml-2 font-medium">{currentAsset.responsible_person || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Verification Form */}
                        <div className="space-y-4">
                            <h4 className="font-semibold">Physical Verification</h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Actual Location</Label>
                                    <Input
                                        value={verificationData.actual_location}
                                        onChange={(e) => setVerificationData(prev => ({
                                            ...prev,
                                            actual_location: e.target.value
                                        }))}
                                        placeholder="Current physical location"
                                    />
                                </div>
                                <div>
                                    <Label>Condition</Label>
                                    <Select
                                        value={verificationData.actual_condition}
                                        onValueChange={(val) => setVerificationData(prev => ({
                                            ...prev,
                                            actual_condition: val
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="excellent">Excellent</SelectItem>
                                            <SelectItem value="good">Good</SelectItem>
                                            <SelectItem value="fair">Fair</SelectItem>
                                            <SelectItem value="poor">Poor</SelectItem>
                                            <SelectItem value="damaged">Damaged</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label>Actual Custodian</Label>
                                <Input
                                    value={verificationData.actual_responsible_person}
                                    onChange={(e) => setVerificationData(prev => ({
                                        ...prev,
                                        actual_responsible_person: e.target.value
                                    }))}
                                    placeholder="Person currently responsible"
                                />
                            </div>

                            <div>
                                <Label>Verification Status</Label>
                                <Select
                                    value={verificationData.verification_status}
                                    onValueChange={(val) => setVerificationData(prev => ({
                                        ...prev,
                                        verification_status: val
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="verified">✓ Verified - No Issues</SelectItem>
                                        <SelectItem value="discrepancy">⚠ Discrepancy Found</SelectItem>
                                        <SelectItem value="not_found">✗ Not Found</SelectItem>
                                        <SelectItem value="damaged">🔧 Damaged</SelectItem>
                                        <SelectItem value="requires_maintenance">🛠 Requires Maintenance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {verificationData.verification_status !== 'verified' && (
                                <div>
                                    <Label>Discrepancy Details</Label>
                                    <Textarea
                                        value={verificationData.discrepancy_details}
                                        onChange={(e) => setVerificationData(prev => ({
                                            ...prev,
                                            discrepancy_details: e.target.value
                                        }))}
                                        placeholder="Describe the issue or discrepancy..."
                                        rows={3}
                                    />
                                </div>
                            )}

                            <div>
                                <Label>Notes</Label>
                                <Textarea
                                    value={verificationData.notes}
                                    onChange={(e) => setVerificationData(prev => ({
                                        ...prev,
                                        notes: e.target.value
                                    }))}
                                    placeholder="Additional observations..."
                                    rows={2}
                                />
                            </div>
                        </div>

                        {gpsPosition && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Navigation className="w-3 h-3" />
                                GPS: {gpsPosition.latitude.toFixed(6)}, {gpsPosition.longitude.toFixed(6)}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCurrentAsset(null);
                                    setCurrentAssetTag('');
                                }}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitVerification}
                                disabled={alreadyVerified}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Submit Verification
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}