import React, { useState, useEffect, useRef } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Scan, 
    Camera, 
    Search, 
    CheckCircle2, 
    Package2, 
    MapPin, 
    User,
    History,
    X,
    ClipboardCheck
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { parseAssetQRData } from "../utils/assetTagGenerator";
import { logAuditTrail } from "../utils/auditTrail";
import AssetVerificationInterface from "./AssetVerificationInterface";

export default function MobileAssetScanner() {
    const [activeMode, setActiveMode] = useState('lookup'); // 'lookup' or 'verify'
    const [scanMode, setScanMode] = useState('manual'); // 'manual' or 'camera'
    const [scannedTag, setScannedTag] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [scanHistory, setScanHistory] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

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
        
        // Load scan history from localStorage
        const history = localStorage.getItem('asset_scan_history');
        if (history) {
            setScanHistory(JSON.parse(history));
        }
    }, []);

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list(),
        initialData: []
    });

    const { data: verificationTasks = [] } = useQuery({
        queryKey: ['verificationTasks'],
        queryFn: () => matrixSales.entities.AssetVerificationTask.filter({ 
            status: 'in_progress' 
        }),
        initialData: []
    });

    const logScanMutation = useMutation({
        mutationFn: async ({ asset, action }) => {
            // Update asset last scanned info
            await matrixSales.entities.FixedAsset.update(asset.id, {
                last_scanned_date: new Date().toISOString(),
                last_scanned_by: currentUser?.email
            });

            await logAuditTrail({
                entityType: 'fixed_asset',
                entityId: asset.id,
                documentNumber: asset.asset_number,
                actionType: 'scan',
                afterData: { 
                    scanned_via: 'mobile',
                    scan_action: action,
                    asset_tag: asset.asset_tag
                },
                user: currentUser,
                severity: 'info'
            });
        }
    });

    const handleManualScan = async () => {
        if (!scannedTag.trim()) {
            toast({
                title: "Error",
                description: "Please enter an asset tag",
                variant: "destructive"
            });
            return;
        }

        // Try to parse as QR data first
        let searchTag = scannedTag.trim();
        try {
            const qrData = parseAssetQRData(scannedTag);
            if (qrData.asset_tag) {
                searchTag = qrData.asset_tag;
            }
        } catch (e) {
            // Not QR data, use as-is
        }

        // Search for asset
        const found = assets.find(a => 
            a.asset_tag === searchTag || 
            a.asset_number === searchTag ||
            a.serial_number === searchTag
        );

        if (found) {
            setSearchResults(found);
            addToScanHistory(found);
            logScanMutation.mutate({ asset: found, action: 'lookup' });
            toast({
                title: "Asset Found",
                description: `${found.asset_name} located`,
            });
        } else {
            setSearchResults(null);
            toast({
                title: "Not Found",
                description: "No asset found with this tag",
                variant: "destructive"
            });
        }
    };

    const addToScanHistory = (asset) => {
        const newHistory = [
            {
                asset_tag: asset.asset_tag,
                asset_name: asset.asset_name,
                asset_number: asset.asset_number,
                scanned_at: new Date().toISOString()
            },
            ...scanHistory.filter(h => h.asset_tag !== asset.asset_tag).slice(0, 9)
        ];
        
        setScanHistory(newHistory);
        localStorage.setItem('asset_scan_history', JSON.stringify(newHistory));
    };

    const clearHistory = () => {
        setScanHistory([]);
        localStorage.removeItem('asset_scan_history');
        toast({
            title: "History Cleared",
            description: "Scan history has been cleared",
        });
    };

    const startCameraScanning = async () => {
        setScanMode('camera');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (error) {
            console.error('Camera access error:', error);
            toast({
                title: "Camera Error",
                description: "Could not access camera. Please use manual entry.",
                variant: "destructive"
            });
            setScanMode('manual');
        }
    };

    const stopCameraScanning = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setScanMode('manual');
    };

    const captureAndScan = () => {
        const code = prompt("QR code detected! Enter the asset tag:");
        if (code) {
            setScannedTag(code);
            stopCameraScanning();
            setTimeout(() => {
                handleManualScan();
            }, 100);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 p-4">
            <div className="max-w-2xl mx-auto space-y-4">
                {/* Header */}
                <Card className="bg-white shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-600 text-white">
                        <CardTitle className="flex items-center gap-2">
                            <Scan className="w-6 h-6" />
                            Mobile Asset Scanner
                        </CardTitle>
                        <p className="text-sm text-emerald-50 mt-1">
                            Scan assets for lookup or verification
                        </p>
                    </CardHeader>
                </Card>

                {/* Mode Selector */}
                <Tabs value={activeMode} onValueChange={setActiveMode}>
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="lookup">
                            <Search className="w-4 h-4 mr-2" />
                            Quick Lookup
                        </TabsTrigger>
                        <TabsTrigger value="verify">
                            <ClipboardCheck className="w-4 h-4 mr-2" />
                            Verify Assets
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="lookup" className="space-y-4">
                        {/* Scanning Interface */}
                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                {scanMode === 'manual' ? (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                Enter Asset Tag, Number, or Serial
                                            </label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="AT-2025-00001 or scan QR code"
                                                    value={scannedTag}
                                                    onChange={(e) => setScannedTag(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                                                    className="flex-1"
                                                    autoFocus
                                                />
                                                <Button 
                                                    onClick={handleManualScan}
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={startCameraScanning}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <Camera className="w-4 h-4 mr-2" />
                                            Use Camera to Scan QR Code
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative bg-black rounded-lg overflow-hidden">
                                            <video 
                                                ref={videoRef}
                                                className="w-full h-64 object-cover"
                                                autoPlay
                                                playsInline
                                            />
                                            <canvas ref={canvasRef} className="hidden" />
                                            <div className="absolute inset-0 border-4 border-emerald-500 pointer-events-none">
                                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-4 border-white opacity-50"></div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={captureAndScan}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                            >
                                                <Scan className="w-4 h-4 mr-2" />
                                                Capture & Scan
                                            </Button>
                                            <Button
                                                onClick={stopCameraScanning}
                                                variant="outline"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <Alert>
                                            <AlertDescription>
                                                Position the QR code within the frame and click "Capture & Scan"
                                            </AlertDescription>
                                        </Alert>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Search Results */}
                        {searchResults && (
                            <Card className="border-emerald-200 border-2">
                                <CardHeader className="bg-emerald-50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-emerald-900">
                                            <CheckCircle2 className="w-5 h-5" />
                                            Asset Found
                                        </CardTitle>
                                        <Badge className="bg-emerald-600">
                                            {searchResults.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Package2 className="w-5 h-5 text-emerald-600" />
                                            <h3 className="font-semibold text-lg">
                                                {searchResults.asset_name}
                                            </h3>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Asset Tag:</span>
                                                <span className="font-mono font-semibold">{searchResults.asset_tag}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Asset Number:</span>
                                                <span className="font-mono">{searchResults.asset_number}</span>
                                            </div>
                                            {searchResults.serial_number && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Serial Number:</span>
                                                    <span className="font-mono">{searchResults.serial_number}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Class:</span>
                                                <Badge variant="outline">{searchResults.asset_class}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4 space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-600">Location:</span>
                                            <span className="font-semibold">{searchResults.location_code || 'Not set'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-600">Responsible:</span>
                                            <span className="font-semibold">{searchResults.responsible_person || 'Unassigned'}</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-gray-600 text-xs">Acquisition Cost</p>
                                                <p className="font-bold text-lg">
                                                    LKR {searchResults.acquisition_cost?.toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 text-xs">Net Book Value</p>
                                                <p className="font-bold text-lg text-emerald-600">
                                                    LKR {searchResults.net_book_value?.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={() => {
                                            setSearchResults(null);
                                            setScannedTag('');
                                        }}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        Scan Another Asset
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Scan History */}
                        {scanHistory.length > 0 && !searchResults && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <History className="w-4 h-4" />
                                            Recent Scans
                                        </CardTitle>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={clearHistory}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {scanHistory.map((item, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => setScannedTag(item.asset_tag)}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <div>
                                                <p className="font-mono text-xs text-gray-600">{item.asset_tag}</p>
                                                <p className="text-sm font-medium">{item.asset_name}</p>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                {new Date(item.scanned_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="verify" className="space-y-4">
                        {/* Task Selection */}
                        {!selectedTask ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Select Verification Task</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {verificationTasks.length === 0 ? (
                                        <Alert>
                                            <AlertDescription>
                                                No active verification tasks. Create a task from the main app.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        verificationTasks.map(task => (
                                            <div 
                                                key={task.id}
                                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                                            >
                                                <div>
                                                    <h4 className="font-semibold">{task.task_name}</h4>
                                                    <p className="text-sm text-gray-600">
                                                        {task.verified_count || 0} / {task.total_assets} verified
                                                        ({task.completion_percentage || 0}%)
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={() => setSelectedTask(task)}
                                                >
                                                    Start
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedTask(null)}
                                >
                                    ← Change Task
                                </Button>
                                <AssetVerificationInterface 
                                    taskId={selectedTask.task_id}
                                    onComplete={() => {
                                        queryClient.invalidateQueries();
                                        setSelectedTask(null);
                                    }}
                                />
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}