import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    RefreshCw
} from "lucide-react";
import InspectionResultsReport from "../components/reports/InspectionResultsReport";
import NCCAPARegister from "../components/reports/NCCAPARegister";
import COALogReport from "../components/reports/COALogReport";
import PMComplianceReport from "../components/reports/PMComplianceReport";
import BreakdownMaintenanceCostReport from "../components/reports/BreakdownMaintenanceCostReport";

export default function QualityMaintenanceReports() {
    const [activeTab, setActiveTab] = useState("inspection_results");

    const { data: inspectionLots = [] } = useQuery({
        queryKey: ['inspectionLots'],
        queryFn: () => base44.entities.InspectionLot.list('-inspection_start_date'),
        initialData: []
    });

    const { data: nonConformances = [] } = useQuery({
        queryKey: ['nonConformances'],
        queryFn: () => base44.entities.NonConformance.list('-nc_date'),
        initialData: []
    });

    const { data: capas = [] } = useQuery({
        queryKey: ['capas'],
        queryFn: () => base44.entities.CAPA.list('-capa_date'),
        initialData: []
    });

    const { data: coas = [] } = useQuery({
        queryKey: ['coas'],
        queryFn: () => base44.entities.CertificateOfAnalysis.list('-coa_date'),
        initialData: []
    });

    const { data: workOrders = [] } = useQuery({
        queryKey: ['workOrders'],
        queryFn: () => base44.entities.WorkOrder.list('-created_date'),
        initialData: []
    });

    const { data: pmPlans = [] } = useQuery({
        queryKey: ['pmPlans'],
        queryFn: () => base44.entities.PMPlan.list(),
        initialData: []
    });

    // KPIs
    const passRate = inspectionLots.length > 0
        ? ((inspectionLots.filter(i => i.result === 'accepted').length / inspectionLots.length) * 100).toFixed(1)
        : 0;
    const openNCs = nonConformances.filter(nc => nc.status === 'open' || nc.status === 'under_investigation').length;
    const overdueCapas = capas.filter(c => c.status !== 'closed' && c.target_date < new Date().toISOString().split('T')[0]).length;
    const pmCompliance = pmPlans.length > 0
        ? ((pmPlans.filter(pm => pm.last_execution_date >= pm.next_execution_date).length / pmPlans.length) * 100).toFixed(1)
        : 0;
    const mttrAvg = workOrders.filter(wo => wo.order_type === 'breakdown' && wo.status === 'completed')
        .reduce((sum, wo) => sum + (wo.downtime_hours || 0), 0) / 
        (workOrders.filter(wo => wo.order_type === 'breakdown' && wo.status === 'completed').length || 1);
    const maintenanceCostMonth = workOrders
        .filter(wo => wo.created_date >= new Date(new Date().setDate(1)).toISOString().split('T')[0])
        .reduce((sum, wo) => sum + (wo.total_cost || 0), 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Quality & Maintenance Reports</h1>
                    <p className="text-gray-600 mt-1">Inspection results, non-conformances, PM compliance & maintenance analytics</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh Data
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-600">Quality Pass Rate</p>
                            <p className="text-2xl font-bold text-green-600">{passRate}%</p>
                            <p className="text-xs text-gray-500 mt-1">{inspectionLots.length} inspections</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-600">Open NCs</p>
                            <p className="text-2xl font-bold text-orange-600">{openNCs}</p>
                            <p className="text-xs text-gray-500 mt-1">Requires action</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-600">Overdue CAPAs</p>
                            <p className="text-2xl font-bold text-red-600">{overdueCapas}</p>
                            <p className="text-xs text-gray-500 mt-1">Past target date</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-600">PM Compliance</p>
                            <p className="text-2xl font-bold text-blue-600">{pmCompliance}%</p>
                            <p className="text-xs text-gray-500 mt-1">{pmPlans.length} PM plans</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-600">Avg MTTR</p>
                            <p className="text-2xl font-bold text-indigo-600">{mttrAvg.toFixed(1)}h</p>
                            <p className="text-xs text-gray-500 mt-1">Mean repair time</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                    <CardContent className="p-4">
                        <div className="flex flex-col">
                            <p className="text-sm text-gray-600">Maintenance Cost</p>
                            <p className="text-xl font-bold text-gray-900">
                                {(maintenanceCostMonth / 1000).toFixed(0)}K
                            </p>
                            <p className="text-xs text-gray-500 mt-1">This month</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 lg:grid-cols-5 w-full">
                    <TabsTrigger value="inspection_results">Inspection Results</TabsTrigger>
                    <TabsTrigger value="nc_capa">NC & CAPA</TabsTrigger>
                    <TabsTrigger value="coa_log">COA Log</TabsTrigger>
                    <TabsTrigger value="pm_compliance">PM Compliance</TabsTrigger>
                    <TabsTrigger value="breakdown_cost">Breakdown & Cost</TabsTrigger>
                </TabsList>

                <TabsContent value="inspection_results">
                    <InspectionResultsReport />
                </TabsContent>

                <TabsContent value="nc_capa">
                    <NCCAPARegister />
                </TabsContent>

                <TabsContent value="coa_log">
                    <COALogReport />
                </TabsContent>

                <TabsContent value="pm_compliance">
                    <PMComplianceReport />
                </TabsContent>

                <TabsContent value="breakdown_cost">
                    <BreakdownMaintenanceCostReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}