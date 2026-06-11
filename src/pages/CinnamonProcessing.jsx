import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Leaf, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "../components/erp/DataTable";
import CinnamonBatchForm from "../components/cinnamon/CinnamonBatchForm";
import CinnamonProcessStepForm from "../components/cinnamon/CinnamonProcessStepForm";
import CinnamonGradingForm from "../components/cinnamon/CinnamonGradingForm";
import CinnamonMoistureQCForm from "../components/cinnamon/CinnamonMoistureQCForm";
import CinnamonPackagingForm from "../components/cinnamon/CinnamonPackagingForm";
import CinnamonYieldReport from "../components/cinnamon/CinnamonYieldReport";
import { useToast } from "@/components/ui/use-toast";

export default function CinnamonProcessing() {
    const [activeTab, setActiveTab] = useState("batches");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: batches = [] } = useQuery({
        queryKey: ["cinnamonBatches"],
        queryFn: () => matrixSales.entities.CinnamonBatch.list("-created_at"),
        initialData: [],
    });

    const { data: processSteps = [] } = useQuery({
        queryKey: ["cinnamonProcessSteps"],
        queryFn: () => matrixSales.entities.CinnamonProcessStep.list("-started_at"),
        initialData: [],
    });

    const { data: gradingOutputs = [] } = useQuery({
        queryKey: ["cinnamonGradingOutputs"],
        queryFn: () => matrixSales.entities.CinnamonGradingOutput.list(),
        initialData: [],
    });

    const { data: packaging = [] } = useQuery({
        queryKey: ["cinnamonPackaging"],
        queryFn: () => matrixSales.entities.CinnamonPackaging.list("-created_at"),
        initialData: [],
    });

    // KPIs
    const activeBatches   = batches.filter((b) => b.status === "active").length;
    const totalInputKg    = batches.reduce((s, b) => s + (parseFloat(b.input_weight_kg) || 0), 0);
    const totalOutputKg   = gradingOutputs.reduce((s, g) => s + (parseFloat(g.output_weight_kg) || 0), 0);
    const overallYield    = totalInputKg > 0
        ? ((totalOutputKg / totalInputKg) * 100).toFixed(1)
        : "—";

    const deleteMutation = useMutation({
        mutationFn: ({ entity, id }) => matrixSales.entities[entity].delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast({ title: "Success", description: "Deleted successfully" });
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const getBadgeColor = (value) => {
        const colors = {
            active:           "bg-green-100 text-green-800",
            completed:        "bg-blue-100 text-blue-800",
            cancelled:        "bg-red-100 text-red-800",
            intake:           "bg-gray-100 text-gray-800",
            pre_processing:   "bg-yellow-100 text-yellow-800",
            rubbing_peeling:  "bg-orange-100 text-orange-800",
            quill_making:     "bg-purple-100 text-purple-800",
            grading:          "bg-indigo-100 text-indigo-800",
            cutting:          "bg-pink-100 text-pink-800",
            packaging:        "bg-teal-100 text-teal-800",
            moisture_qc:      "bg-cyan-100 text-cyan-800",
            passed:           "bg-green-100 text-green-800",
            above_threshold:  "bg-amber-100 text-amber-800",
            posted:           "bg-blue-100 text-blue-800",
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    // Column definitions
    const batchColumns = [
        { header: "Batch #",        key: "batch_number" },
        { header: "Supplier",       key: "supplier" },
        { header: "Origin",         key: "origin" },
        { header: "Input (kg)",     key: "input_weight_kg",  render: (v) => parseFloat(v || 0).toFixed(3) },
        { header: "Moisture In %",  key: "moisture_in_pct" },
        { header: "Harvest Date",   key: "harvest_date" },
        { header: "Stage",          key: "current_stage",    isBadge: true },
        { header: "Status",         key: "status",           isBadge: true },
    ];

    const stepColumns = [
        { header: "Batch #",    key: "batch_number" },
        { header: "Stage",      key: "stage",            isBadge: true },
        { header: "Input (kg)", key: "input_weight_kg",  render: (v) => parseFloat(v || 0).toFixed(3) },
        { header: "Output (kg)",key: "output_weight_kg", render: (v) => parseFloat(v || 0).toFixed(3) },
        { header: "Waste (kg)", key: "waste_weight_kg",  render: (v) => parseFloat(v || 0).toFixed(3) },
        { header: "Yield %",    key: "yield_pct",        render: (v) => v != null ? `${parseFloat(v).toFixed(1)}%` : "—" },
        { header: "Operator",   key: "operator" },
    ];

    const gradingColumns = [
        { header: "Grading #",   key: "grading_number" },
        { header: "Batch #",     key: "batch_number" },
        { header: "Grade",       key: "grade_code" },
        { header: "Output (kg)", key: "output_weight_kg", render: (v) => parseFloat(v || 0).toFixed(3) },
    ];

    const qcColumns = [
        { header: "Batch #",  key: "batch_number" },
        {
            header: "Moisture %",
            key:    "notes",
            render: (v) => {
                const m = String(v || "").match(/Moisture QC:\s*([\d.]+)%/);
                return m ? `${m[1]}%` : v;
            },
        },
        {
            header: "Date",
            key:    "completed_at",
            render: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
        },
        { header: "Operator", key: "operator" },
    ];

    const packagingColumns = [
        { header: "Packaging #", key: "packaging_number" },
        { header: "Batch #",     key: "batch_number" },
        { header: "Finished SKU",key: "finished_sku" },
        { header: "Pack Size",   key: "pack_size" },
        { header: "Qty (packs)", key: "qty_packs" },
        { header: "Total (kg)",  key: "total_weight_kg", render: (v) => parseFloat(v || 0).toFixed(3) },
        { header: "Location",    key: "location" },
        { header: "Status",      key: "status",          isBadge: true },
    ];

    const handleCreate = (type) => {
        setEditingItem(null);
        setActiveTab(type);
        setShowDialog(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setShowDialog(true);
    };

    const handleDelete = (item, entity) => {
        if (confirm("Delete this record?")) {
            deleteMutation.mutate({ entity, id: item.id });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Leaf className="w-8 h-8 text-emerald-600" />
                        Cinnamon Processing
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Batch intake → 7 processing stages → grading → moisture QC → packaging &amp; stock
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Active Batches</p>
                        <p className="text-2xl font-bold text-emerald-600">{activeBatches}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Total Input (kg)</p>
                        <p className="text-2xl font-bold">{totalInputKg.toFixed(1)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Graded Output (kg)</p>
                        <p className="text-2xl font-bold">{totalOutputKg.toFixed(1)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Overall Yield</p>
                        <p className="text-2xl font-bold text-blue-600">{overallYield}%</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="batches">Batches</TabsTrigger>
                    <TabsTrigger value="steps">Process Steps</TabsTrigger>
                    <TabsTrigger value="grading">Grading</TabsTrigger>
                    <TabsTrigger value="qc">Moisture QC</TabsTrigger>
                    <TabsTrigger value="packaging">Packaging</TabsTrigger>
                    <TabsTrigger value="yield">Yield Report</TabsTrigger>
                </TabsList>

                <TabsContent value="batches">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Cinnamon Batches</CardTitle>
                            <Button
                                onClick={() => handleCreate("batches")}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Batch
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={batches}
                                columns={batchColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, "CinnamonBatch")}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="steps">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Process Steps</CardTitle>
                            <Button
                                onClick={() => handleCreate("steps")}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Record Step
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={processSteps}
                                columns={stepColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, "CinnamonProcessStep")}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="grading">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Grading Outputs</CardTitle>
                            <Button
                                onClick={() => handleCreate("grading")}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Record Grading
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={gradingOutputs}
                                columns={gradingColumns}
                                getBadgeColor={getBadgeColor}
                                onDelete={(item) => handleDelete(item, "CinnamonGradingOutput")}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="qc">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Moisture QC</CardTitle>
                            <Button
                                onClick={() => handleCreate("qc")}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Record QC
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={processSteps.filter((s) => s.stage === "moisture_qc")}
                                columns={qcColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="packaging">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Packaging</CardTitle>
                            <Button
                                onClick={() => handleCreate("packaging")}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Record Packaging
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={packaging}
                                columns={packagingColumns}
                                getBadgeColor={getBadgeColor}
                                onEdit={handleEdit}
                                onDelete={(item) => handleDelete(item, "CinnamonPackaging")}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="yield">
                    <CinnamonYieldReport />
                </TabsContent>
            </Tabs>

            {/* Dialogs — rendered conditionally like Production.jsx */}
            {showDialog && activeTab === "batches" && (
                <CinnamonBatchForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === "steps" && (
                <CinnamonProcessStepForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === "grading" && (
                <CinnamonGradingForm onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === "qc" && (
                <CinnamonMoistureQCForm onClose={() => setShowDialog(false)} />
            )}
            {showDialog && activeTab === "packaging" && (
                <CinnamonPackagingForm item={editingItem} onClose={() => setShowDialog(false)} />
            )}
        </div>
    );
}
