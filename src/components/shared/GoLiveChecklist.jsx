import React, { useState, useEffect } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
    CheckCircle2, 
    Circle, 
    AlertTriangle,
    Rocket,
    Database,
    Users,
    Shield,
    FileText,
    Settings
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function GoLiveChecklist() {
    const [checklistStatus, setChecklistStatus] = useState({});

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list(),
        initialData: []
    });

    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: () => matrixSales.entities.Role.list(),
        initialData: []
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => matrixSales.entities.User.list(),
        initialData: []
    });

    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => matrixSales.entities.Organization.list(),
        initialData: []
    });

    const { data: locations = [] } = useQuery({
        queryKey: ['locations'],
        queryFn: () => matrixSales.entities.Location.list(),
        initialData: []
    });

    const { data: approvalMatrix = [] } = useQuery({
        queryKey: ['approvalMatrix'],
        queryFn: () => matrixSales.entities.ApprovalMatrix.list(),
        initialData: []
    });

    useEffect(() => {
        const checks = {
            // Data Preparation
            hasAssets: assets.length > 0,
            assetsHaveTags: assets.every(a => a.asset_tag),
            assetsHaveDepreciation: assets.every(a => a.depreciation_method && a.useful_life_years),
            
            // Organization Setup
            hasOrganization: organizations.length > 0,
            hasLocations: locations.length > 0,
            
            // Security & Access
            hasRoles: roles.length >= 3, // At least 3 roles beyond admin
            usersHaveRoles: users.filter(u => u.role !== 'admin').every(u => u.assigned_roles?.length > 0),
            hasApprovalMatrix: approvalMatrix.filter(a => a.document_type === 'asset_disposal').length > 0,
            
            // Users
            hasMultipleUsers: users.length >= 3,
            usersActive: users.every(u => u.is_active !== false),
        };

        setChecklistStatus(checks);
    }, [assets, roles, users, organizations, locations, approvalMatrix]);

    const checklistItems = [
        {
            category: "Data Preparation",
            icon: Database,
            items: [
                {
                    label: "Master asset data loaded",
                    key: "hasAssets",
                    requirement: "At least one asset registered",
                    critical: true
                },
                {
                    label: "All assets have unique tags",
                    key: "assetsHaveTags",
                    requirement: "Asset tags generated for tracking",
                    critical: true
                },
                {
                    label: "Depreciation parameters configured",
                    key: "assetsHaveDepreciation",
                    requirement: "Method and useful life set for all assets",
                    critical: true
                }
            ]
        },
        {
            category: "Organization Setup",
            icon: Settings,
            items: [
                {
                    label: "Organization profile created",
                    key: "hasOrganization",
                    requirement: "Company information configured",
                    critical: true
                },
                {
                    label: "Locations defined",
                    key: "hasLocations",
                    requirement: "At least one location/warehouse",
                    critical: false
                }
            ]
        },
        {
            category: "Security & Access Control",
            icon: Shield,
            items: [
                {
                    label: "Custom roles created",
                    key: "hasRoles",
                    requirement: "At least 3 roles defined (e.g., Asset Manager, Custodian, Controller)",
                    critical: true
                },
                {
                    label: "Users assigned to roles",
                    key: "usersHaveRoles",
                    requirement: "All non-admin users have assigned roles",
                    critical: true
                },
                {
                    label: "Approval matrix configured",
                    key: "hasApprovalMatrix",
                    requirement: "Disposal approval workflow defined",
                    critical: false
                }
            ]
        },
        {
            category: "User Management",
            icon: Users,
            items: [
                {
                    label: "Multiple users invited",
                    key: "hasMultipleUsers",
                    requirement: "At least 3 users for segregation of duties",
                    critical: false
                },
                {
                    label: "All users are active",
                    key: "usersActive",
                    requirement: "No inactive users in system",
                    critical: false
                }
            ]
        }
    ];

    const totalItems = checklistItems.reduce((sum, cat) => sum + cat.items.length, 0);
    const completedItems = Object.values(checklistStatus).filter(Boolean).length;
    const completionPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    const criticalItems = checklistItems.flatMap(cat => 
        cat.items.filter(item => item.critical)
    );
    const criticalComplete = criticalItems.every(item => checklistStatus[item.key]);

    const readyForGoLive = completionPercent >= 80 && criticalComplete;

    return (
        <div className="space-y-6">
            {/* Overall Status */}
            <Card className={readyForGoLive ? "border-green-300 bg-green-50" : "border-yellow-300 bg-yellow-50"}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Rocket className={`w-6 h-6 ${readyForGoLive ? 'text-green-600' : 'text-yellow-600'}`} />
                            Go-Live Readiness
                        </CardTitle>
                        <Badge className={readyForGoLive ? "bg-green-600" : "bg-yellow-600"}>
                            {completedItems} / {totalItems} Complete
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium">Overall Progress</span>
                            <span className="font-bold">{Math.round(completionPercent)}%</span>
                        </div>
                        <Progress value={completionPercent} className="h-3" />
                    </div>

                    {readyForGoLive ? (
                        <Alert className="bg-green-100 border-green-300">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-900">
                                <strong>System Ready for Go-Live!</strong> All critical requirements are met.
                                Review remaining items and proceed when ready.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert className="bg-yellow-100 border-yellow-300">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                                <strong>Not Ready Yet.</strong> Please complete critical items before going live.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Detailed Checklist */}
            <div className="space-y-4">
                {checklistItems.map((category, idx) => {
                    const Icon = category.icon;
                    const categoryComplete = category.items.every(item => checklistStatus[item.key]);
                    const categoryProgress = (category.items.filter(item => 
                        checklistStatus[item.key]
                    ).length / category.items.length) * 100;

                    return (
                        <Card key={idx}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Icon className="w-5 h-5 text-emerald-600" />
                                        {category.category}
                                    </CardTitle>
                                    <Badge variant={categoryComplete ? "default" : "secondary"}>
                                        {Math.round(categoryProgress)}%
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {category.items.map((item, itemIdx) => {
                                    const isComplete = checklistStatus[item.key];
                                    
                                    return (
                                        <div 
                                            key={itemIdx}
                                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                                                isComplete 
                                                    ? 'bg-green-50 border-green-200' 
                                                    : item.critical 
                                                    ? 'bg-red-50 border-red-200'
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            {isComplete ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <Circle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{item.label}</p>
                                                    {item.critical && !isComplete && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Critical
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {item.requirement}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Recommendations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        Go-Live Recommendations
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>Backup Your Data:</strong> Create a complete backup before going live
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>User Training:</strong> Ensure all users are trained on their specific roles and workflows
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>Test Workflows:</strong> Complete end-to-end testing of asset verification, depreciation run, and disposal workflows
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>Physical Verification:</strong> Run an initial asset verification to ensure data accuracy
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>Approval Workflows:</strong> Test approval matrix with sample transactions
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>Print Asset Tags:</strong> Print and attach physical tags to all assets
                            </p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p>
                                <strong>Establish Support:</strong> Set up internal support channels for user questions
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}