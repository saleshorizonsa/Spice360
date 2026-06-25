import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../components/utils/languageContext";

export default function KPIDashboard() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().substring(0, 7));
    const [showKPIForm, setShowKPIForm] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: kpis = [] } = useQuery({
        queryKey: ['kpis', selectedPeriod],
        queryFn: () => matrixSales.entities.KPI.filter({ period: selectedPeriod }),
        initialData: []
    });

    const filteredKPIs = filterCategory === 'all' 
        ? kpis 
        : kpis.filter(k => k.kpi_category === filterCategory);

    const kpiColumns = [
        { header: "KPI Name", key: "kpi_name" },
        { header: "Category", key: "kpi_category", isBadge: true },
        { header: "Owner", key: "owner" },
        { header: "Target", key: "target_value" },
        { header: "Actual", key: "actual_value" },
        { 
            header: "Achievement", 
            key: "variance_percent",
            render: (val, row) => {
                const achievement = (row.actual_value / row.target_value) * 100;
                return <span className={achievement >= 90 ? 'text-green-600 font-semibold' : achievement >= 70 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {achievement.toFixed(1)}%
                </span>;
            }
        },
        { header: "Trend", key: "trend", isBadge: true },
        { header: "Status", key: "status", isBadge: true },
        { header: "Update Freq", key: "update_frequency", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            on_target: "bg-green-100 text-green-800",
            at_risk: "bg-yellow-100 text-yellow-800",
            off_target: "bg-red-100 text-red-800",
            improving: "bg-green-100 text-green-800",
            stable: "bg-blue-100 text-blue-800",
            declining: "bg-red-100 text-red-800",
            financial: "bg-emerald-100 text-emerald-800",
            operational: "bg-blue-100 text-blue-800",
            customer: "bg-purple-100 text-purple-800",
            employee: "bg-pink-100 text-pink-800",
            quality: "bg-indigo-100 text-indigo-800",
            supply_chain: "bg-amber-100 text-amber-800",
            daily: "bg-blue-100 text-blue-800",
            weekly: "bg-indigo-100 text-indigo-800",
            monthly: "bg-purple-100 text-purple-800",
            quarterly: "bg-pink-100 text-pink-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const categoryKPIs = (category) => kpis.filter(k => k.kpi_category === category);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('kpiDashboard')}</h1>
                    <p className="text-gray-600 mt-1">{t('trackMonitorKPIs')}</p>
                </div>
                <Button onClick={() => setShowKPIForm(true)} className="bg-emerald-600">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('addKPI')}
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-7 w-full">
                    <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                    <TabsTrigger value="financial">{t('financial')}</TabsTrigger>
                    <TabsTrigger value="operational">{t('operational')}</TabsTrigger>
                    <TabsTrigger value="customer">{t('customer')}</TabsTrigger>
                    <TabsTrigger value="employee">{t('employee')}</TabsTrigger>
                    <TabsTrigger value="quality">{t('quality')}</TabsTrigger>
                    <TabsTrigger value="supply_chain">{t('supplyChain')}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{t('allKPIs')}</CardTitle>
                                <div className="flex gap-2">
                                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Categories</SelectItem>
                                            <SelectItem value="financial">Financial</SelectItem>
                                            <SelectItem value="operational">Operational</SelectItem>
                                            <SelectItem value="customer">Customer</SelectItem>
                                            <SelectItem value="employee">Employee</SelectItem>
                                            <SelectItem value="quality">Quality</SelectItem>
                                            <SelectItem value="supply_chain">Supply Chain</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input 
                                        type="month" 
                                        value={selectedPeriod} 
                                        onChange={(e) => setSelectedPeriod(e.target.value)}
                                        className="w-48"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={filteredKPIs}
                                columns={kpiColumns}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {['financial', 'operational', 'customer', 'employee', 'quality', 'supply_chain'].map(category => (
                    <TabsContent key={category} value={category}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="capitalize">{category} KPIs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataTable
                                    data={categoryKPIs(category)}
                                    columns={kpiColumns}
                                    getBadgeColor={getBadgeColor}
                                    showSearch={false}
                                />
                                {categoryKPIs(category).length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        No {category} KPIs defined for {selectedPeriod}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            {showKPIForm && (
                <Dialog open={showKPIForm} onOpenChange={setShowKPIForm}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add KPI</DialogTitle>
                        </DialogHeader>
                        <div className="text-center py-8 text-gray-500">
                            KPI form implementation - Use BudgetManagementForm as reference
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
