
import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, XCircle, AlertCircle, FileCheck } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import InspectionLotForm from "../components/quality/InspectionLotForm";
import NonConformanceForm from "../components/quality/NonConformanceForm";
import CAPAForm from "../components/quality/CAPAForm";
import COAForm from "../components/quality/COAForm";
import QCPlanForm from "../components/quality/QCPlanForm";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "../components/utils/languageContext";

export default function Quality() {
    const [activeTab, setActiveTab] = useState("inspections");
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: inspectionLots = [] } = useQuery({
        queryKey: ['inspectionLots'],
        queryFn: () => matrixSales.entities.InspectionLot.list('-lot_date'),
        initialData: []
    });

    const { data: nonConformances = [] } = useQuery({
        queryKey: ['nonConformances'],
        queryFn: () => matrixSales.entities.NonConformance.list('-nc_date'),
        initialData: []
    });

    const { data: capas = [] } = useQuery({
        queryKey: ['capas'],
        queryFn: () => matrixSales.entities.CAPA.list('-capa_date'),
        initialData: []
    });

    const { data: coas = [] } = useQuery({
        queryKey: ['coas'],
        queryFn: () => matrixSales.entities.CertificateOfAnalysis.list('-coa_date'),
        initialData: []
    });

    const { data: qcPlans = [] } = useQuery({
        queryKey: ['qcPlans'],
        queryFn: () => matrixSales.entities.QCPlan.list(),
        initialData: []
    });

    // KPIs
    const acceptedLots = inspectionLots.filter(l => l.result === 'accepted').length;
    const rejectedLots = inspectionLots.filter(l => l.result === 'rejected').length;
    const totalLots = inspectionLots.length;
    const firstPassYield = totalLots > 0 ? Math.round((acceptedLots / totalLots) * 100) : 0;
    const openNCs = nonConformances.filter(nc => nc.status === 'open' || nc.status === 'under_investigation').length;
    const coasIssued = coas.filter(c => c.status === 'issued').length;

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

    const handlePrint = (item, type) => {
        const printWindow = window.open('', '_blank');
        let content = '';
        
        if (type === 'Inspection Lot') {
            content = `
                <html>
                    <head>
                        <title>Inspection Lot ${item.inspection_lot_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f3f4f6; }
                            .pass { color: #059669; font-weight: bold; }
                            .fail { color: #dc2626; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <h1>Inspection Lot</h1>
                        <p><strong>Lot #:</strong> ${item.inspection_lot_number}</p>
                        <p><strong>Date:</strong> ${item.lot_date}</p>
                        <p><strong>Material:</strong> ${item.material_name}</p>
                        <p><strong>Batch:</strong> ${item.batch_number || 'N/A'}</p>
                        <p><strong>Inspector:</strong> ${item.inspector_name}</p>
                        <table>
                            <tr>
                                <th>Quantity to Inspect</th>
                                <th>Sample Size</th>
                                <th>Inspection Type</th>
                                <th>Result</th>
                            </tr>
                            <tr>
                                <td>${item.quantity_to_inspect} ${item.unit_of_measure || ''}</td>
                                <td>${item.sample_size}</td>
                                <td>${item.inspection_type}</td>
                                <td class="${item.result === 'accepted' ? 'pass' : item.result === 'rejected' ? 'fail' : ''}">${item.result?.toUpperCase()}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px;"><strong>Disposition:</strong> ${item.disposition}</p>
                        <p><strong>Status:</strong> ${item.status}</p>
                    </body>
                </html>
            `;
        } else if (type === 'Non-Conformance') {
            content = `
                <html>
                    <head>
                        <title>Non-Conformance Report ${item.nc_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #dc2626; }
                            .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                            .section h3 { color: #059669; margin-top: 0; }
                        </style>
                    </head>
                    <body>
                        <h1>Non-Conformance Report</h1>
                        <p><strong>NC #:</strong> ${item.nc_number}</p>
                        <p><strong>Date:</strong> ${item.nc_date}</p>
                        <p><strong>Material:</strong> ${item.material_name}</p>
                        <p><strong>Batch:</strong> ${item.batch_number || 'N/A'}</p>
                        <div class="section">
                            <h3>Defect Description</h3>
                            <p>${item.defect_description}</p>
                        </div>
                        <div class="section">
                            <h3>Root Cause</h3>
                            <p>${item.root_cause || 'Pending investigation'}</p>
                        </div>
                        <div class="section">
                            <h3>Containment Action</h3>
                            <p>${item.containment_action || 'N/A'}</p>
                        </div>
                        <p><strong>Disposition:</strong> ${item.disposition}</p>
                        <p><strong>Quantity Affected:</strong> ${item.quantity_affected} ${item.unit_of_measure || ''}</p>
                        <p><strong>Status:</strong> ${item.status}</p>
                        <p><strong>Reported By:</strong> ${item.reported_by}</p>
                    </body>
                </html>
            `;
        } else if (type === 'COA') {
            content = `
                <html>
                    <head>
                        <title>Certificate of Analysis ${item.coa_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; text-align: center; }
                            .header { text-align: center; margin-bottom: 30px; }
                            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                            th { background-color: #f3f4f6; font-weight: bold; }
                            .footer { margin-top: 40px; text-align: right; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>CERTIFICATE OF ANALYSIS</h1>
                            <p><strong>COA #:</strong> ${item.coa_number}</p>
                            <p><strong>Date:</strong> ${item.coa_date}</p>
                        </div>
                        <table>
                            <tr>
                                <th>Material</th>
                                <td>${item.material_name}</td>
                            </tr>
                            <tr>
                                <th>Batch Number</th>
                                <td>${item.batch_number}</td>
                            </tr>
                            <tr>
                                <th>Manufacturing Date</th>
                                <td>${item.manufacturing_date || 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Quantity</th>
                                <td>${item.quantity} ${item.unit_of_measure || ''}</td>
                            </tr>
                            <tr>
                                <th>Customer</th>
                                <td>${item.customer_name || 'N/A'}</td>
                            </tr>
                        </table>
                        <p><strong>Conclusion:</strong> This material ${item.conclusion?.toUpperCase()} with specifications</p>
                        <div class="footer">
                            <p><strong>Approved By:</strong> ${item.approved_by || '_________________'}</p>
                            <p><strong>Date:</strong> ${item.approval_date || '_________________'}</p>
                        </div>
                    </body>
                </html>
            `;
        } else if (type === 'CAPA') {
            content = `
                <html>
                    <head>
                        <title>CAPA ${item.capa_number}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; }
                            h1 { color: #059669; }
                            .section { margin: 20px 0; padding: 15px; background-color: #f9fafb; border-left: 4px solid #059669; }
                            .section h3 { margin-top: 0; }
                        </style>
                    </head>
                    <body>
                        <h1>Corrective & Preventive Action (CAPA)</h1>
                        <p><strong>CAPA #:</strong> ${item.capa_number}</p>
                        <p><strong>Date:</strong> ${item.capa_date}</p>
                        <p><strong>Type:</strong> ${item.capa_type?.toUpperCase()}</p>
                        <p><strong>Source:</strong> ${item.source}</p>
                        <div class="section">
                            <h3>Problem Description</h3>
                            <p>${item.problem_description}</p>
                        </div>
                        <div class="section">
                            <h3>Root Cause Analysis</h3>
                            <p>${item.root_cause_analysis || 'Pending'}</p>
                        </div>
                        <div class="section">
                            <h3>Corrective Action</h3>
                            <p>${item.corrective_action || 'N/A'}</p>
                        </div>
                        <div class="section">
                            <h3>Preventive Action</h3>
                            <p>${item.preventive_action || 'N/A'}</p>
                        </div>
                        <p><strong>Assigned To:</strong> ${item.assigned_to}</p>
                        <p><strong>Target Date:</strong> ${item.target_date}</p>
                        <p><strong>Status:</strong> ${item.status}</p>
                    </body>
                </html>
            `;
        }
        
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    const getBadgeColor = (value) => {
        const colors = {
            accepted: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            conditional: "bg-yellow-100 text-yellow-800",
            pending: "bg-gray-100 text-gray-800",
            created: "bg-gray-100 text-gray-800",
            in_progress: "bg-blue-100 text-blue-800",
            completed: "bg-green-100 text-green-800",
            use_as_is: "bg-green-100 text-green-800",
            rework: "bg-yellow-100 text-yellow-800",
            scrap: "bg-red-100 text-red-800",
            return_to_vendor: "bg-orange-100 text-orange-800",
            open: "bg-red-100 text-red-800",
            under_investigation: "bg-yellow-100 text-yellow-800",
            action_in_progress: "bg-blue-100 text-blue-800",
            closed: "bg-green-100 text-green-800",
            verified: "bg-emerald-100 text-emerald-800",
            draft: "bg-gray-100 text-gray-800",
            approved: "bg-blue-100 text-blue-800",
            issued: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
            incoming: "bg-purple-100 text-purple-800",
            in_process: "bg-yellow-100 text-yellow-800",
            final: "bg-emerald-100 text-emerald-800",
            random: "bg-gray-100 text-gray-800",
            internal: "bg-blue-100 text-blue-800",
            supplier: "bg-orange-100 text-orange-800",
            customer: "bg-purple-100 text-purple-800",
            low: "bg-gray-100 text-gray-800",
            medium: "bg-blue-100 text-blue-800",
            high: "bg-orange-100 text-orange-800",
            critical: "bg-red-100 text-red-800",
            corrective: "bg-teal-100 text-teal-800",
            preventive: "bg-indigo-100 text-indigo-800",
            customer_complaint: "bg-fuchsia-100 text-fuchsia-800",
            internal_audit: "bg-lime-100 text-lime-800",
            supplier_nonconformance: "bg-rose-100 text-rose-800",
            inspection_nonconformance: "bg-sky-100 text-sky-800",
            implemented: "bg-green-100 text-green-800",
            conforming: "bg-green-100 text-green-800",
            non_conforming: "bg-red-100 text-red-800",
            active: "bg-green-100 text-green-800",
            inactive: "bg-gray-100 text-gray-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const inspectionSearchFields = ["inspection_lot_number", "material_name", "batch_number", "inspector_name"];
    const inspectionFilters = [
        {
            field: "result",
            label: "Result",
            values: [
                { value: "pending", label: t('pending') },
                { value: "accepted", label: "Accepted" },
                { value: "rejected", label: "Rejected" },
                { value: "conditional", label: "Conditional" }
            ]
        },
        {
            field: "inspection_type",
            label: t('type'),
            values: [
                { value: "incoming", label: "Incoming" },
                { value: "in_process", label: "In-Process" },
                { value: "final", label: "Final" },
                { value: "random", label: "Random" }
            ]
        },
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "created", label: "Created" },
                { value: "in_progress", label: t('inProgress') },
                { value: "completed", label: t('completed') }
            ]
        }
    ];

    const ncSearchFields = ["nc_number", "material_name", "defect_description", "reported_by", "batch_number"];
    const ncFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "open", label: "Open" },
                { value: "under_investigation", label: "Under Investigation" },
                { value: "action_in_progress", label: "Action in Progress" },
                { value: "closed", label: "Closed" }
            ]
        },
        {
            field: "priority",
            label: t('priority'),
            values: [
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" }
            ]
        },
        {
            field: "nc_type",
            label: "NC Type",
            values: [
                { value: "internal", label: "Internal" },
                { value: "supplier", label: "Supplier" },
                { value: "customer", label: "Customer" }
            ]
        }
    ];

    const capaSearchFields = ["capa_number", "problem_description", "assigned_to", "source", "root_cause_analysis"];
    const capaFilters = [
        {
            field: "capa_type",
            label: t('type'),
            values: [
                { value: "corrective", label: "Corrective" },
                { value: "preventive", label: "Preventive" }
            ]
        },
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "open", label: "Open" },
                { value: "in_progress", label: t('inProgress') },
                { value: "implemented", label: "Implemented" },
                { value: "verified", label: "Verified" },
                { value: "closed", label: "Closed" }
            ]
        },
        {
            field: "priority",
            label: t('priority'),
            values: [
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" }
            ]
        },
        {
            field: "source",
            label: "Source",
            values: [
                { value: "customer_complaint", label: "Customer Complaint" },
                { value: "internal_audit", label: "Internal Audit" },
                { value: "supplier_nonconformance", label: "Supplier Non-conformance" },
                { value: "inspection_nonconformance", label: "Inspection Non-conformance" }
            ]
        }
    ];

    const coaSearchFields = ["coa_number", "material_name", "batch_number", "customer_name", "approved_by"];
    const coaFilters = [
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "draft", label: t('draft') },
                { value: "approved", label: t('approved') },
                { value: "issued", label: "Issued" },
                { value: "cancelled", label: t('cancelled') }
            ]
        },
        {
            field: "conclusion",
            label: "Conclusion",
            values: [
                { value: "conforming", label: "Conforming" },
                { value: "non_conforming", label: "Non-Conforming" }
            ]
        }
    ];

    const qcPlanSearchFields = ["qc_plan_code", "qc_plan_name", "material_name", "sampling_plan"];
    const qcPlanFilters = [
        {
            field: "inspection_type",
            label: t('type'),
            values: [
                { value: "incoming", label: "Incoming" },
                { value: "in_process", label: "In-Process" },
                { value: "final", label: "Final" }
            ]
        },
        {
            field: "status",
            label: t('status'),
            values: [
                { value: "active", label: t('active') },
                { value: "inactive", label: t('inactive') }
            ]
        }
    ];

    const inspectionColumns = [
        { header: "Lot #", key: "inspection_lot_number" },
        { header: t('date'), key: "lot_date" },
        { header: t('type'), key: "inspection_type", isBadge: true },
        { header: t('material'), key: "material_name" },
        { header: "Batch", key: "batch_number" },
        { header: t('quantity'), key: "quantity_to_inspect" },
        { header: "Sample", key: "sample_size" },
        { header: "Inspector", key: "inspector_name" },
        { header: "Result", key: "result", isBadge: true },
        { header: "Disposition", key: "disposition", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const ncColumns = [
        { header: "NC #", key: "nc_number" },
        { header: t('date'), key: "nc_date" },
        { header: t('type'), key: "nc_type", isBadge: true },
        { header: t('material'), key: "material_name" },
        { header: "Batch", key: "batch_number" },
        { header: t('quantity'), key: "quantity_affected" },
        { header: "Defect", key: "defect_description" },
        { header: "Disposition", key: "disposition", isBadge: true },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: "Assigned To", key: "assigned_to" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const capaColumns = [
        { header: "CAPA #", key: "capa_number" },
        { header: t('date'), key: "capa_date" },
        { header: t('type'), key: "capa_type", isBadge: true },
        { header: "Source", key: "source", isBadge: true },
        { header: "Problem", key: "problem_description" },
        { header: "Assigned To", key: "assigned_to" },
        { header: "Target Date", key: "target_date" },
        { header: t('priority'), key: "priority", isBadge: true },
        { header: "Effectiveness", key: "effectiveness_result", isBadge: true },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const coaColumns = [
        { header: "COA #", key: "coa_number" },
        { header: t('date'), key: "coa_date" },
        { header: t('material'), key: "material_name" },
        { header: "Batch", key: "batch_number" },
        { header: t('quantity'), key: "quantity" },
        { header: t('customer'), key: "customer_name" },
        { header: "Conclusion", key: "conclusion", isBadge: true },
        { header: "Approved By", key: "approved_by" },
        { header: t('status'), key: "status", isBadge: true }
    ];

    const qcPlanColumns = [
        { header: "Plan Code", key: "qc_plan_code" },
        { header: "Plan Name", key: "qc_plan_name" },
        { header: t('material'), key: "material_name" },
        { header: t('type'), key: "inspection_type", isBadge: true },
        { header: "Sampling", key: "sampling_plan" },
        { header: "Sample Size", key: "sample_size" },
        { header: "AQL %", key: "aql_percent" },
        { header: "Auto Create", key: "auto_create_lot", render: (val) => val ? "Yes" : "No" },
        { header: t('status'), key: "status", isBadge: true }
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
                    <h1 className="text-3xl font-bold text-gray-900">{t('qualityManagement')}</h1>
                    <p className="text-gray-600 mt-1">Inspection, COA, Non-Conformance & CAPA</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    title={t('firstPassYield')}
                    value={`${firstPassYield}%`}
                    icon={CheckCircle2}
                    trend={`${acceptedLots}/${totalLots} lots`}
                    color="emerald"
                />
                    title={t('rejectedLots')}
                    value={rejectedLots}
                    icon={XCircle}
                    trend="Require disposition"
                    color="red"
                />
                    title={t('openNCs')}
                    value={openNCs}
                    icon={AlertCircle}
                    trend={`${nonConformances.length} total`}
                    color="amber"
                />
                    title={t('coasIssued')}
                    value={coasIssued}
                    icon={FileCheck}
                    trend={`${coas.length} total`}
                    color="blue"
                />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="inspections">{t('inspectionLots')}</TabsTrigger>
                    <TabsTrigger value="ncs">{t('nonConformances')}</TabsTrigger>
                    <TabsTrigger value="capas">{t('capa')}</TabsTrigger>
                    <TabsTrigger value="coas">{t('coas')}</TabsTrigger>
                    <TabsTrigger value="plans">{t('qcPlans')}</TabsTrigger>
                </TabsList>

                <TabsContent value="inspections">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('inspectionLots')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('inspections')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} Inspection Lot
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={inspectionLots}
                                columns={inspectionColumns}
                                searchFields={inspectionSearchFields}
                                filterOptions={inspectionFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'inspections')}
                                onDelete={(item) => handleDelete(item, 'InspectionLot')}
                                onPrint={(item) => handlePrint(item, 'Inspection Lot')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ncs">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('nonConformances')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('ncs')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} NC
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={nonConformances}
                                columns={ncColumns}
                                searchFields={ncSearchFields}
                                filterOptions={ncFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'ncs')}
                                onDelete={(item) => handleDelete(item, 'NonConformance')}
                                onPrint={(item) => handlePrint(item, 'Non-Conformance')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="capas">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Corrective & Preventive Actions ({t('capa')})</CardTitle>
                            <Button 
                                onClick={() => handleCreate('capas')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} CAPA
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={capas}
                                columns={capaColumns}
                                searchFields={capaSearchFields}
                                filterOptions={capaFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'capas')}
                                onDelete={(item) => handleDelete(item, 'CAPA')}
                                onPrint={(item) => handlePrint(item, 'CAPA')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="coas">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Certificates of Analysis</CardTitle>
                            <Button 
                                onClick={() => handleCreate('coas')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Generate COA
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={coas}
                                columns={coaColumns}
                                searchFields={coaSearchFields}
                                filterOptions={coaFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'coas')}
                                onDelete={(item) => handleDelete(item, 'CertificateOfAnalysis')}
                                onPrint={(item) => handlePrint(item, 'COA')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="plans">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('qcPlans')}</CardTitle>
                            <Button 
                                onClick={() => handleCreate('plans')}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('new')} QC Plan
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={qcPlans}
                                columns={qcPlanColumns}
                                searchFields={qcPlanSearchFields}
                                filterOptions={qcPlanFilters}
                                getBadgeColor={getBadgeColor}
                                onEdit={(item) => handleEdit(item, 'plans')}
                                onDelete={(item) => handleDelete(item, 'QCPlan')}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {showDialog && activeTab === 'inspections' && (
                <InspectionLotForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'ncs' && (
                <NonConformanceForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'capas' && (
                <CAPAForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'coas' && (
                <COAForm item={editingItem} onClose={handleCloseDialog} />
            )}
            {showDialog && activeTab === 'plans' && (
                <QCPlanForm item={editingItem} onClose={handleCloseDialog} />
            )}
        </div>
    );
}
