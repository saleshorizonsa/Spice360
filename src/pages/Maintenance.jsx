import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Wrench, Calendar, Package, AlertTriangle, BarChart3, Clock } from "lucide-react";
import DataTable from "@/components/erp/DataTable";
import WorkOrderForm from "@/components/maintenance/WorkOrderForm";
import PMPlanForm from "@/components/maintenance/PMPlanForm";
import EquipmentForm from "@/components/maintenance/EquipmentForm";
import SparePartForm from "@/components/maintenance/SparePartForm";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/utils/languageContext";

export default function Maintenance() {
    const [activeTab, setActiveTab] = useState("workorders");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: workOrders = [] } = useQuery({
        queryKey: ['workOrders'],
        queryFn: () => matrixSales.entities.WorkOrder.list('-created_date'),
        initialData: []
    });

    const { data: pmPlans = [] } = useQuery({
        queryKey: ['pmPlans'],
        queryFn: () => matrixSales.entities.PMPlan.list(),
        initialData: []
    });

    const { data: equipment = [] } = useQuery({
        queryKey: ['equipment'],
        queryFn: () => matrixSales.entities.Equipment.list(),
        initialData: []
    });

    const { data: spareParts = [] } = useQuery({
        queryKey: ['spareParts'],
        queryFn: () => matrixSales.entities.SparePart.list(),
        initialData: []
    });

    const { data: downtimes = [] } = useQuery({
        queryKey: ['downtimes'],
        queryFn: () => matrixSales.entities.EquipmentDowntime.list('-downtime_start'),
        initialData: []
    });

    const { data: consumptions = [] } = useQuery({
        queryKey: ['consumptions'],
        queryFn: () => matrixSales.entities.SparePartConsumption.list('-consumption_date'),
        initialData: []
    });

    // KPI Calculations
    const totalWorkOrders = workOrders.length;
    const openWorkOrders = workOrders.filter(wo => wo.status === 'open' || wo.status === 'assigned' || wo.status === 'in_progress').length;
    const completedWorkOrders = workOrders.filter(wo => wo.status === 'completed').length;
    
    // PM Compliance
    const totalPMPlans = pmPlans.filter(p => p.status === 'active').length;
    const pmWorkOrders = workOrders.filter(wo => wo.order_type === 'preventive' && wo.status === 'completed').length;
    const pmCompliance = totalPMPlans > 0 ? Math.round((pmWorkOrders / totalPMPlans) * 100) : 0;
    
    // MTTR (Mean Time To Repair) - average downtime hours
    const totalDowntime = downtimes.reduce((sum, d) => sum + (d.downtime_hours || 0), 0);
    const mttr = downtimes.length > 0 ? (totalDowntime / downtimes.length).toFixed(2) : 0;
    
    // MTBF (Mean Time Between Failures) - would need more complex calculation
    const breakdowns = downtimes.filter(d => d.downtime_type === 'breakdown').length;
    
    // Critical Equipment Down
    const criticalEquipmentDown = equipment.filter(e => 
        e.criticality === 'critical' && 
        (e.status === 'down' || e.status === 'under_maintenance')
    ).length;
    
    // Low Stock Spare Parts
    const lowStockParts = spareParts.filter(sp => 
        (sp.current_stock || 0) <= (sp.minimum_stock || 0)
    ).length;
    
    // Total Maintenance Cost
    const totalMaintenanceCost = workOrders.reduce((sum, wo) => sum + (wo.total_cost || 0), 0);

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({
                title: t('success'),
                description: t('deletedSuccessfully'),
                variant: "default"
            });
        }
    });

    const getBadgeColor = (value) => {
        const colors = {
            // Work Order Status
            open: "bg-gray-100 text-gray-800",
            assigned: "bg-blue-100 text-blue-800",
            in_progress: "bg-indigo-100 text-indigo-800",
            on_hold: "bg-yellow-100 text-yellow-800",
            completed: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
            // Priority
            emergency: "bg-red-100 text-red-800",
            urgent: "bg-orange-100 text-orange-800",
            high: "bg-yellow-100 text-yellow-800",
            medium: "bg-blue-100 text-blue-800",
            low: "bg-gray-100 text-gray-800",
            // Equipment Status
            operational: "bg-green-100 text-green-800",
            under_maintenance: "bg-yellow-100 text-yellow-800",
            down: "bg-red-100 text-red-800",
            standby: "bg-gray-100 text-gray-800",
            retired: "bg-gray-100 text-gray-800",
            // Criticality
            critical: "bg-red-100 text-red-800",
            important: "bg-yellow-100 text-yellow-800",
            normal: "bg-green-100 text-green-800",
            // Order Types
            preventive: "bg-blue-100 text-blue-800",
            corrective: "bg-yellow-100 text-yellow-800",
            breakdown: "bg-red-100 text-red-800",
            inspection: "bg-purple-100 text-purple-800",
            // PM Plan Status
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800",
            suspended: "bg-yellow-100 text-yellow-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const workOrderColumns = [
        { header: "WO #", key: "work_order_number" },
        { header: t('type'), key: "order_type", isBadge: true },
        { header: t('equipment'), key: "equipment_name" },
        { header: t('description'), key: "problem_description" },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: t('assignedTo'), key: "assigned_to" },
        { header: t('created'), key: "created_date" },
        { header: t('requiredBy'), key: "required_date" },
        { header: t('laborHrs'), key: "labor_hours" },
        { header: t('totalCost'), key: "total_cost", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const pmPlanColumns = [
        { header: t('planCode'), key: "pm_plan_code" },
        { header: t('planName'), key: "pm_plan_name" },
        { header: t('equipment'), key: "equipment_name" },
        { header: t('type'), key: "maintenance_type", isBadge: true },
        { header: t('frequency'), key: "frequency_value", render: (val, row) => `${val} ${row.frequency_unit}` },
        { header: t('durationHrs'), key: "estimated_duration_hours" },
        { header: t('lastExecution'), key: "last_execution_date" },
        { header: t('nextExecution'), key: "next_execution_date" },
        { header: t('autoGenerate'), key: "auto_generate_wo", render: (val) => val ? t('yes') : t('no') },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const equipmentColumns = [
        { header: t('equipmentCode'), key: "equipment_code" },
        { header: t('equipmentName'), key: "equipment_name" },
        { header: t('type'), key: "equipment_type", isBadge: true },
        { header: t('location'), key: "location_name" },
        { header: t('criticality'), key: "criticality", isBadge: true },
        { header: t('operatingHrs'), key: "operating_hours" },
        { header: t('lastMaintenance'), key: "last_maintenance_date" },
        { header: t('nextMaintenance'), key: "next_maintenance_date" },
        { header: t('responsible'), key: "responsible_person" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const sparePartColumns = [
        { header: t('partCode'), key: "part_code" },
        { header: t('partName'), key: "part_name" },
        { header: t('category'), key: "part_category", isBadge: true },
        { header: t('manufacturer'), key: "manufacturer" },
        { header: t('currentStock'), key: "current_stock" },
        { header: t('minStock'), key: "minimum_stock" },
        { header: t('unitCost'), key: "unit_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: t('criticality'), key: "criticality", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const downtimeColumns = [
        { header: t('downtimeNumber'), key: "downtime_number" },
        { header: t('equipment'), key: "equipment_name" },
        { header: "WO #", key: "work_order_number" },
        { header: t('start'), key: "downtime_start" },
        { header: t('end'), key: "downtime_end" },
        { header: t('hours'), key: "downtime_hours", render: (val) => val?.toFixed(2) || 0 },
        { header: t('type'), key: "downtime_type", isBadge: true },
        { header: t('productionLoss'), key: "production_loss_value", render: (val) => `SAR ${val?.toLocaleString() || 0}` },
        { header: t('rootCause'), key: "root_cause" }
    ];

    const consumptionColumns = [
        { header: t('consumptionNumber'), key: "consumption_number" },
        { header: "WO #", key: "work_order_number" },
        { header: t('equipment'), key: "equipment_code" },
        { header: t('part'), key: "part_name" },
        { header: t('quantity'), key: "quantity_consumed" },
        { header: t('unitCost'), key: "unit_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: t('totalCost'), key: "total_cost", render: (val) => `SAR ${val?.toFixed(2) || 0}` },
        { header: t('date'), key: "consumption_date" },
        { header: t('consumedBy'), key: "consumed_by" }
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item, type) => {
        setEditingItem(item);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (confirm(t('areYouSure'))) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingItem(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('maintenanceManagement')}</h1>
                    <p className="text-gray-600 mt-1">{t('maintenanceDescription')}</p>
                </div>
            </div>

            {/* KPI Cards */}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="workorders">{t('workOrders')}</TabsTrigger>
                    <TabsTrigger value="pmplans">{t('pmPlans')}</TabsTrigger>
                    <TabsTrigger value="equipment">{t('equipment')}</TabsTrigger>
                    <TabsTrigger value="spareparts">{t('spareParts')}</TabsTrigger>
                    <TabsTrigger value="downtimes">{t('downtimes')}</TabsTrigger>
                    <TabsTrigger value="consumptions">{t('consumptions')}</TabsTrigger>
                </TabsList>

                <TabsContent value="workorders">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('workOrders')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('workorders')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('workOrder')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={workOrders}
                                columns={workOrderColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'workorders')}
                                onDelete={(item) => handleDelete(item, 'WorkOrder')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pmplans">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('preventiveMaintenancePlans')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('pmplans')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('pmPlan')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={pmPlans}
                                columns={pmPlanColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'pmplans')}
                                onDelete={(item) => handleDelete(item, 'PMPlan')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="equipment">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('equipmentRegistry')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('equipment')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('equipment')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={equipment}
                                columns={equipmentColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'equipment')}
                                onDelete={(item) => handleDelete(item, 'Equipment')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="spareparts">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('sparePartsInventory')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('spareparts')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} {t('sparePart')}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={spareParts}
                                columns={sparePartColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'spareparts')}
                                onDelete={(item) => handleDelete(item, 'SparePart')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="downtimes">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('equipmentDowntimeTracking')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={downtimes}
                                columns={downtimeColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="consumptions">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('sparePartsConsumptions')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={consumptions}
                                columns={consumptionColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'workorders' && (
                <WorkOrderForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'pmplans' && (
                <PMPlanForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'equipment' && (
                <EquipmentForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'spareparts' && (
                <SparePartForm item={editingItem} onClose={handleCloseDialog} />
            )}
        </div>
    );
}