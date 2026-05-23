import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Building, Factory, MapPin, Ruler, Activity, Sparkles, Calendar, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matrixSales } from "@/api/matrixSalesClient";
import PlantForm from "../components/admin/PlantForm";
import StorageLocationForm from "../components/admin/StorageLocationForm";
import UnitConversionForm from "../components/admin/UnitConversionForm";
import OrganizationSetupForm from "../components/admin/OrganizationSetupForm";
import RoleManagement from "../components/admin/RoleManagement";
import UserRoleAssignment from "../components/admin/UserRoleAssignment";
import AuditTrailViewer from "../components/admin/AuditTrailViewer";
import SystemSetupTemplates from "../components/admin/SystemSetupTemplates";
import PeriodCloseManagement from "../components/admin/PeriodCloseManagement";
import PrintingPreferences from "../components/admin/PrintingPreferences";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { usePermissions } from "../components/utils/usePermissions";
import { Lock } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";

export default function AdminCenter() {
    const [activeTab, setActiveTab] = useState("setup");
    const [showPlantForm, setShowPlantForm] = useState(false);
    const [showStorageLocationForm, setShowStorageLocationForm] = useState(false);
    const [showUnitConversionForm, setShowUnitConversionForm] = useState(false);
    const [editingPlant, setEditingPlant] = useState(null);
    const [editingStorageLocation, setEditingStorageLocation] = useState(null);
    const [editingUnitConversion, setEditingUnitConversion] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: null, item: null });
    
    const { hasPermission, isAdmin, loading } = usePermissions();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: plants = [] } = useQuery({
        queryKey: ['plants'],
        queryFn: () => matrixSales.entities.Plant.list(),
        initialData: []
    });

    const { data: storageLocations = [] } = useQuery({
        queryKey: ['storageLocations'],
        queryFn: () => matrixSales.entities.StorageLocation.list(),
        initialData: []
    });

    const { data: unitConversions = [] } = useQuery({
        queryKey: ['unitConversions'],
        queryFn: () => matrixSales.entities.UnitConversion.list(),
        initialData: []
    });

    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => matrixSales.entities.Organization.list(),
        initialData: []
    });

    const getOrganizationCode = (org) => org.organization_code || org.company_code || org.id;
    const getOrganizationName = (org) => org.organization_name || org.company_name || org.trade_name || getOrganizationCode(org);

    // Helper to get company name
    const getCompanyName = (companyCode) => {
        const org = organizations.find(o => getOrganizationCode(o) === companyCode || o.id === companyCode);
        return org ? getOrganizationName(org) : companyCode || '-';
    };

    const deletePlantMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.Plant.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            toast({ title: "Success", description: "Plant deleted successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete plant", variant: "destructive" });
        }
    });

    const deleteStorageLocationMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.StorageLocation.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['storageLocations'] });
            toast({ title: "Success", description: "Storage location deleted successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete storage location", variant: "destructive" });
        }
    });

    const bulkDeletePlantsMutation = useMutation({
        mutationFn: async (ids) => {
            await Promise.all(ids.map(id => matrixSales.entities.Plant.delete(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            toast({ title: "Success", description: "Plants deleted successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete plants", variant: "destructive" });
        }
    });

    const bulkDeleteStorageLocationsMutation = useMutation({
        mutationFn: async (ids) => {
            await Promise.all(ids.map(id => matrixSales.entities.StorageLocation.delete(id)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['storageLocations'] });
            toast({ title: "Success", description: "Storage locations deleted successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete storage locations", variant: "destructive" });
        }
    });

    const bulkStatusChangePlantsMutation = useMutation({
        mutationFn: async ({ ids, status }) => {
            const plantsToUpdate = plants.filter(p => ids.includes(p.id));
            await Promise.all(plantsToUpdate.map(plant => 
                matrixSales.entities.Plant.update(plant.id, { ...plant, status })
            ));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            toast({ title: "Success", description: "Plants status updated successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update plants status", variant: "destructive" });
        }
    });

    const bulkStatusChangeStorageLocationsMutation = useMutation({
        mutationFn: async ({ ids, status }) => {
            const locationsToUpdate = storageLocations.filter(l => ids.includes(l.id));
            await Promise.all(locationsToUpdate.map(location => 
                matrixSales.entities.StorageLocation.update(location.id, { ...location, status })
            ));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['storageLocations'] });
            toast({ title: "Success", description: "Storage locations status updated successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update storage locations status", variant: "destructive" });
        }
    });

    const handleEditPlant = (plant) => {
        setEditingPlant(plant);
        setShowPlantForm(true);
    };

    const handleEditStorageLocation = (location) => {
        setEditingStorageLocation(location);
        setShowStorageLocationForm(true);
    };

    const handleEditUnitConversion = (conversion) => {
        setEditingUnitConversion(conversion);
        setShowUnitConversionForm(true);
    };

    const handleClosePlantForm = () => {
        setShowPlantForm(false);
        setEditingPlant(null);
    };

    const handleCloseStorageLocationForm = () => {
        setShowStorageLocationForm(false);
        setEditingStorageLocation(null);
    };

    const handleCloseUnitConversionForm = () => {
        setShowUnitConversionForm(false);
        setEditingUnitConversion(null);
    };

    const handleDeletePlant = (plant) => {
        setDeleteConfirm({
            open: true,
            type: 'plant',
            item: plant,
            title: 'Delete Plant',
            description: `Are you sure you want to delete plant "${plant.plant_name}"? This action cannot be undone.`
        });
    };

    const handleDeleteStorageLocation = (location) => {
        setDeleteConfirm({
            open: true,
            type: 'storage_location',
            item: location,
            title: 'Delete Storage Location',
            description: `Are you sure you want to delete storage location "${location.storage_location_name}"? This action cannot be undone.`
        });
    };

    const handleConfirmDelete = () => {
        if (deleteConfirm.type === 'plant') {
            deletePlantMutation.mutate(deleteConfirm.item.id);
        } else if (deleteConfirm.type === 'storage_location') {
            deleteStorageLocationMutation.mutate(deleteConfirm.item.id);
        }
        setDeleteConfirm({ open: false, type: null, item: null });
    };

    const handleBulkDeletePlants = (ids) => {
        setDeleteConfirm({
            open: true,
            type: 'bulk_plants',
            item: { ids },
            title: 'Delete Plants',
            description: `Are you sure you want to delete ${ids.length} plant${ids.length > 1 ? 's' : ''}? This action cannot be undone.`
        });
    };

    const handleBulkDeleteStorageLocations = (ids) => {
        setDeleteConfirm({
            open: true,
            type: 'bulk_storage_locations',
            item: { ids },
            title: 'Delete Storage Locations',
            description: `Are you sure you want to delete ${ids.length} storage location${ids.length > 1 ? 's' : ''}? This action cannot be undone.`
        });
    };

    const handleBulkConfirmDelete = () => {
        if (deleteConfirm.type === 'bulk_plants') {
            bulkDeletePlantsMutation.mutate(deleteConfirm.item.ids);
        } else if (deleteConfirm.type === 'bulk_storage_locations') {
            bulkDeleteStorageLocationsMutation.mutate(deleteConfirm.item.ids);
        }
        setDeleteConfirm({ open: false, type: null, item: null });
    };

    const handleBulkStatusChangePlants = (ids, status) => {
        bulkStatusChangePlantsMutation.mutate({ ids, status });
    };

    const handleBulkStatusChangeStorageLocations = (ids, status) => {
        bulkStatusChangeStorageLocationsMutation.mutate({ ids, status });
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin && !hasPermission('admin.role_management', 'view')) {
        return (
            <div className="p-6">
                <Card className="border-red-200">
                    <CardContent className="pt-6">
                        <div className="text-center py-12">
                            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                            <p className="text-gray-600 mb-4">
                                You don't have permission to access the Admin Center.
                            </p>
                            <p className="text-sm text-gray-500">
                                Only administrators and authorized users can access this area.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Center</h1>
                <p className="text-gray-600 mt-1">System configuration & security management</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 w-full h-auto">
                    <TabsTrigger value="setup">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Setup
                    </TabsTrigger>
                    <TabsTrigger value="roles">
                        <Shield className="w-4 h-4 mr-2" />
                        Roles
                    </TabsTrigger>
                    <TabsTrigger value="users">
                        <Users className="w-4 h-4 mr-2" />
                        Users
                    </TabsTrigger>
                    <TabsTrigger value="organization">
                        <Building className="w-4 h-4 mr-2" />
                        Organization
                    </TabsTrigger>
                    <TabsTrigger value="unit-conversion">
                        <Ruler className="w-4 h-4 mr-2" />
                        Unit Conversion
                    </TabsTrigger>
                    <TabsTrigger value="period-close">
                        <Calendar className="w-4 h-4 mr-2" />
                        Period Close
                    </TabsTrigger>
                    <TabsTrigger value="printing">
                        <Printer className="w-4 h-4 mr-2" />
                        Printing
                    </TabsTrigger>
                    <TabsTrigger value="plant">
                        <Factory className="w-4 h-4 mr-2" />
                        Plant
                    </TabsTrigger>
                    <TabsTrigger value="storage-location">
                        <MapPin className="w-4 h-4 mr-2" />
                        Storage Location
                    </TabsTrigger>
                    <TabsTrigger value="audit">
                        <Activity className="w-4 h-4 mr-2" />
                        Audit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="setup">
                    <SystemSetupTemplates />
                </TabsContent>

                <TabsContent value="roles">
                    <RoleManagement />
                </TabsContent>

                <TabsContent value="users">
                    <UserRoleAssignment />
                </TabsContent>

                <TabsContent value="organization">
                    <OrganizationSetupForm />
                </TabsContent>

                <TabsContent value="unit-conversion">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Ruler className="w-5 h-5 text-amber-600" />
                                Unit Conversions
                            </CardTitle>
                            <Button
                                onClick={() => setShowUnitConversionForm(true)}
                                size="sm"
                                className="bg-emerald-600"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                New Conversion
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={unitConversions}
                                columns={[
                                    { header: 'Conversion ID', key: 'conversion_id' },
                                    { header: 'Material', key: 'material_name' },
                                    { header: 'From Unit', key: 'from_unit' },
                                    { header: 'To Unit', key: 'to_unit' },
                                    { header: 'Factor', key: 'conversion_factor' },
                                    { header: 'Status', key: 'status', isBadge: true }
                                ]}
                                onEdit={handleEditUnitConversion}
                                enableSorting={true}
                                showSearch={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="period-close">
                    <PeriodCloseManagement />
                </TabsContent>

                <TabsContent value="printing">
                    <PrintingPreferences />
                </TabsContent>

                <TabsContent value="plant">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Factory className="w-5 h-5 text-indigo-600" />
                                Plants
                            </CardTitle>
                            <Button 
                                onClick={() => setShowPlantForm(true)}
                                size="sm"
                                className="bg-emerald-600"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                New Plant
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={plants}
                                columns={[
                                    { header: 'Code', key: 'plant_code' },
                                    { header: 'Name', key: 'plant_name' },
                                    { 
                                        header: 'Company', 
                                        key: 'company_code',
                                        render: (val) => getCompanyName(val)
                                    },
                                    { header: 'Type', key: 'plant_type' },
                                    { header: 'City', key: 'city' },
                                    { header: 'Status', key: 'status', isBadge: true }
                                ]}
                                onEdit={handleEditPlant}
                                onDelete={handleDeletePlant}
                                onBulkDelete={handleBulkDeletePlants}
                                onBulkStatusChange={handleBulkStatusChangePlants}
                                enableBulkActions={true}
                                enableSorting={true}
                                showSearch={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="storage-location">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-blue-600" />
                                Storage Locations
                            </CardTitle>
                            <Button 
                                onClick={() => setShowStorageLocationForm(true)}
                                size="sm"
                                className="bg-emerald-600"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                New Location
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={storageLocations}
                                columns={[
                                    { header: 'Code', key: 'storage_location_code' },
                                    { header: 'Name', key: 'storage_location_name' },
                                    { 
                                        header: 'Company', 
                                        key: 'company_code',
                                        render: (val) => getCompanyName(val)
                                    },
                                    { header: 'Plant', key: 'plant_code' },
                                    { header: 'Type', key: 'location_type' },
                                    { header: 'Status', key: 'status', isBadge: true }
                                ]}
                                onEdit={handleEditStorageLocation}
                                onDelete={handleDeleteStorageLocation}
                                onBulkDelete={handleBulkDeleteStorageLocations}
                                onBulkStatusChange={handleBulkStatusChangeStorageLocations}
                                enableBulkActions={true}
                                enableSorting={true}
                                showSearch={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit">
                    <AuditTrailViewer />
                </TabsContent>
            </Tabs>

            {showPlantForm && (
                <PlantForm 
                    item={editingPlant} 
                    onClose={handleClosePlantForm}
                    open={showPlantForm}
                />
            )}

            {showStorageLocationForm && (
                <StorageLocationForm 
                    item={editingStorageLocation} 
                    onClose={handleCloseStorageLocationForm}
                    open={showStorageLocationForm}
                />
            )}

            {showUnitConversionForm && (
                <UnitConversionForm
                    item={editingUnitConversion}
                    onClose={handleCloseUnitConversionForm}
                    open={showUnitConversionForm}
                />
            )}

            <ConfirmDialog
                open={deleteConfirm.open}
                onOpenChange={(open) => !open && setDeleteConfirm({ open: false, type: null, item: null })}
                onConfirm={deleteConfirm.type?.startsWith('bulk_') ? handleBulkConfirmDelete : handleConfirmDelete}
                title={deleteConfirm.title}
                description={deleteConfirm.description}
            />
        </div>
    );
}
