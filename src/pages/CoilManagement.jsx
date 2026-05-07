import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Scissors, History, AlertCircle, CheckCircle } from "lucide-react";
import DataTable from "@/components/erp/DataTable";
import CoilForm from "@/components/inventory/CoilForm";
import CoilSlittingForm from "@/components/inventory/CoilSlittingForm";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/utils/languageContext";

export default function CoilManagement() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("coils");
    const [showCoilDialog, setShowCoilDialog] = useState(false);
    const [showSlittingDialog, setShowSlittingDialog] = useState(false);
    const [editingCoil, setEditingCoil] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: coils = [] } = useQuery({
        queryKey: ['coils'],
        queryFn: () => matrixSales.entities.Coil.list('-received_date'),
        initialData: []
    });

    const { data: slittings = [] } = useQuery({
        queryKey: ['coilSlittings'],
        queryFn: () => matrixSales.entities.CoilSlitting.list('-slitting_date'),
        initialData: []
    });

    const totalCoils = coils.length;
    const availableCoils = coils.filter(c => c.status === 'available' && c.qc_status === 'approved');
    const totalWeight = coils.reduce((sum, c) => sum + (c.current_weight || 0), 0);
    const reservedCoils = coils.filter(c => c.status === 'reserved');
    const qcPending = coils.filter(c => c.qc_status === 'pending');

    const deleteMutation = useMutation({
        mutationFn: (id) => matrixSales.entities.Coil.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coils'] });
            toast({ title: "Success", description: "Coil deleted successfully" });
        }
    });

    const coilColumns = [
        { header: "Coil #", key: "coil_number" },
        { header: "Material", key: "material_name" },
        { 
            header: "Weight", 
            key: "current_weight", 
            render: (val, row) => `${val} / ${row.original_weight} kg` 
        },
        { 
            header: "Dimensions", 
            key: "width_mm", 
            render: (val, row) => `${val} × ${row.thickness_mm} mm` 
        },
        { header: "Location", key: "warehouse_bin", render: (val) => val || 'Not assigned' },
        { header: "QC Status", key: "qc_status", isBadge: true },
        { header: "Status", key: "status", isBadge: true },
        { 
            header: "Type", 
            key: "is_parent_coil", 
            render: (val) => val ? (
                <Badge variant="outline">Parent</Badge>
            ) : (
                <Badge variant="outline" className="bg-blue-50">Slit</Badge>
            )
        }
    ];

    const slittingColumns = [
        { header: "Slitting #", key: "slitting_number" },
        { header: "Date", key: "slitting_date", render: (val) => new Date(val).toLocaleDateString() },
        { header: "Parent Coil", key: "parent_coil_number" },
        { header: "New Coil", key: "new_coil_number" },
        { 
            header: "Weight Slit", 
            key: "slit_weight", 
            render: (val) => `${val} kg` 
        },
        { 
            header: "Remaining", 
            key: "parent_weight_after_slitting", 
            render: (val) => `${val} kg` 
        },
        { header: "Reason", key: "slitting_reason", isBadge: true },
        { header: "Performed By", key: "performed_by_name" }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            available: "bg-green-100 text-green-800",
            reserved: "bg-blue-100 text-blue-800",
            in_use: "bg-amber-100 text-amber-800",
            slit: "bg-purple-100 text-purple-800",
            exhausted: "bg-gray-100 text-gray-800",
            quarantine: "bg-orange-100 text-orange-800",
            rejected: "bg-red-100 text-red-800",
            pending: "bg-yellow-100 text-yellow-800",
            approved: "bg-green-100 text-green-800",
            on_hold: "bg-amber-100 text-amber-800",
            production_requirement: "bg-blue-100 text-blue-800",
            quality_segregation: "bg-purple-100 text-purple-800",
            customer_order: "bg-emerald-100 text-emerald-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t('coilManagementSlitting')}</h1>
                <p className="text-gray-600 mt-1">{t('trackCoilsDesc')}</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 w-full max-w-xl">
                    <TabsTrigger value="coils">
                        <Package className="w-4 h-4 mr-2" />
                        {t('coilInventory')}
                    </TabsTrigger>
                    <TabsTrigger value="slittings">
                        <Scissors className="w-4 h-4 mr-2" />
                        {t('slittingOperations')}
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <History className="w-4 h-4 mr-2" />
                        {t('history')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="coils">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('coilInventory')}</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowSlittingDialog(true)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <Scissors className="w-4 h-4 mr-2" />
                                    {t('slitCoil')}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setEditingCoil(null);
                                        setShowCoilDialog(true);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    + {t('registerCoil')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={coils}
                                columns={coilColumns}
                                getBadgeColor={getBadgeColor}
                                searchFields={["coil_number", "material_name", "supplier_batch_number"]}
                                filterOptions={[
                                    {
                                        field: "status",
                                        label: "Status",
                                        options: ["available", "reserved", "in_use", "slit", "exhausted"]
                                    },
                                    {
                                        field: "qc_status",
                                        label: "QC Status",
                                        options: ["pending", "approved", "rejected"]
                                    }
                                ]}
                                onEdit={(item) => {
                                    setEditingCoil(item);
                                    setShowCoilDialog(true);
                                }}
                                onDelete={(item) => {
                                    if (confirm(`Delete coil ${item.coil_number}?`)) {
                                        deleteMutation.mutate(item.id);
                                    }
                                }}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="slittings">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('slittingOperations')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={slittings}
                                columns={slittingColumns}
                                getBadgeColor={getBadgeColor}
                                searchFields={["slitting_number", "parent_coil_number", "new_coil_number"]}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('coilHistory')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {coils.filter(c => !c.is_parent_coil).map(coil => {
                                    const slittingRecord = slittings.find(s => s.new_coil_number === coil.coil_number);
                                    
                                    return (
                                        <div key={coil.id} className="bg-gray-50 p-4 rounded-lg border">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-blue-600">{coil.coil_number}</Badge>
                                                    <span className="text-sm font-medium">{coil.material_name}</span>
                                                </div>
                                                <Badge className={getBadgeColor(coil.status)}>{coil.status}</Badge>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <p>Slit from: <strong>{coil.parent_coil_number}</strong></p>
                                                <p>Slit Weight: <strong>{slittingRecord?.slit_weight} kg</strong></p>
                                                <p>Current Weight: <strong>{coil.current_weight} kg</strong></p>
                                                {slittingRecord && (
                                                    <p className="text-xs text-gray-500">
                                                        Slit on {new Date(slittingRecord.slitting_date).toLocaleString()} by {slittingRecord.performed_by_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {showCoilDialog && (
                <CoilForm
                    item={editingCoil}
                    onClose={() => {
                        setShowCoilDialog(false);
                        setEditingCoil(null);
                    }}
                />
            )}

            {showSlittingDialog && (
                <CoilSlittingForm
                    onClose={() => setShowSlittingDialog(false)}
                />
            )}
        </div>
    );
}