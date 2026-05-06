import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Calendar, Package, Settings } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AIProductionOptimizer() {
    const [optimizing, setOptimizing] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState(null);
    const { toast } = useToast();

    const { data: productionOrders = [] } = useQuery({
        queryKey: ['productionOrders'],
        queryFn: () => base44.entities.ProductionOrder.list(),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['materials'],
        queryFn: () => base44.entities.Material.list(),
        initialData: []
    });

    const { data: workCenters = [] } = useQuery({
        queryKey: ['workCenters'],
        queryFn: () => base44.entities.WorkCenter.list(),
        initialData: []
    });

    const { data: salesOrders = [] } = useQuery({
        queryKey: ['salesOrders'],
        queryFn: () => base44.entities.SalesOrder.list('-order_date', 50),
        initialData: []
    });

    const optimizeSchedule = async () => {
        setOptimizing(true);
        try {
            const pendingOrders = productionOrders.filter(po => po.status === 'planned');
            const demandData = salesOrders.filter(so => so.status !== 'cancelled').slice(0, 20);
            const materialStock = materials.map(m => ({
                code: m.material_code,
                name: m.material_name,
                available: m.current_stock || 0,
                reorder_point: m.reorder_point || 0
            }));
            const machineCapacity = workCenters.map(wc => ({
                id: wc.work_center_code,
                name: wc.work_center_name,
                capacity: wc.capacity_hours || 8,
                efficiency: wc.efficiency_rate || 85
            }));

            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a production planning AI expert. Analyze this manufacturing data and create an optimized production schedule.

Production Orders (Pending):
${JSON.stringify(pendingOrders.slice(0, 10), null, 2)}

Demand Forecast (Recent Sales Orders):
${JSON.stringify(demandData, null, 2)}

Material Availability:
${JSON.stringify(materialStock.slice(0, 15), null, 2)}

Work Center Capacity:
${JSON.stringify(machineCapacity, null, 2)}

Provide optimized production schedule with:
1. Priority ranking of production orders
2. Resource allocation recommendations
3. Material procurement needs
4. Capacity utilization optimization
5. Estimated completion timeline
6. Risk factors and bottlenecks

Return in JSON format:`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        priority_schedule: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    order_number: { type: "string" },
                                    priority: { type: "string" },
                                    recommended_start: { type: "string" },
                                    estimated_completion: { type: "string" },
                                    work_center: { type: "string" },
                                    reasoning: { type: "string" }
                                }
                            }
                        },
                        material_requirements: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    material: { type: "string" },
                                    required_quantity: { type: "number" },
                                    current_stock: { type: "number" },
                                    procurement_needed: { type: "boolean" },
                                    urgency: { type: "string" }
                                }
                            }
                        },
                        capacity_plan: {
                            type: "object",
                            properties: {
                                utilization_rate: { type: "number" },
                                bottlenecks: { type: "array", items: { type: "string" } },
                                recommendations: { type: "array", items: { type: "string" } }
                            }
                        },
                        risks: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    risk_type: { type: "string" },
                                    severity: { type: "string" },
                                    mitigation: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            setOptimizationResult(response);
            toast({ title: "Success", description: "Production schedule optimized" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to optimize schedule", variant: "destructive" });
        } finally {
            setOptimizing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Production Schedule Optimizer
                    </CardTitle>
                    <Button
                        onClick={optimizeSchedule}
                        disabled={optimizing}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {optimizing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Optimizing...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Optimize Schedule
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {!optimizationResult && !optimizing && (
                    <div className="text-center py-8 text-gray-500">
                        <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>Click "Optimize Schedule" to generate AI-powered production plan</p>
                    </div>
                )}

                {optimizationResult && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Priority Schedule
                            </h4>
                            <div className="space-y-2">
                                {optimizationResult.priority_schedule?.map((item, idx) => (
                                    <div key={idx} className="border p-3 rounded-lg bg-gray-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <Badge className="mb-1">{item.order_number}</Badge>
                                                <Badge className={
                                                    item.priority === 'high' ? 'bg-red-100 text-red-800 ml-2' :
                                                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 ml-2' :
                                                    'bg-green-100 text-green-800 ml-2'
                                                }>{item.priority}</Badge>
                                            </div>
                                            <span className="text-xs text-gray-600">{item.work_center}</span>
                                        </div>
                                        <div className="text-sm space-y-1">
                                            <p><strong>Start:</strong> {item.recommended_start}</p>
                                            <p><strong>Complete:</strong> {item.estimated_completion}</p>
                                            <p className="text-gray-600">{item.reasoning}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Material Requirements
                            </h4>
                            <div className="space-y-2">
                                {optimizationResult.material_requirements?.map((item, idx) => (
                                    <div key={idx} className={`border p-3 rounded-lg ${
                                        item.procurement_needed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
                                    }`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-medium">{item.material}</p>
                                                <p className="text-sm text-gray-600">
                                                    Required: {item.required_quantity} | Stock: {item.current_stock}
                                                </p>
                                            </div>
                                            {item.procurement_needed && (
                                                <Badge className="bg-red-600">{item.urgency}</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Capacity & Bottlenecks
                            </h4>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <p className="text-lg font-bold mb-2">
                                    Utilization: {optimizationResult.capacity_plan?.utilization_rate}%
                                </p>
                                {optimizationResult.capacity_plan?.bottlenecks?.length > 0 && (
                                    <div className="mb-3">
                                        <p className="font-semibold text-sm mb-1">Bottlenecks:</p>
                                        <ul className="list-disc list-inside text-sm">
                                            {optimizationResult.capacity_plan.bottlenecks.map((b, i) => (
                                                <li key={i}>{b}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-sm mb-1">Recommendations:</p>
                                    <ul className="list-disc list-inside text-sm">
                                        {optimizationResult.capacity_plan?.recommendations?.map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {optimizationResult.risks?.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3">Risk Assessment</h4>
                                <div className="space-y-2">
                                    {optimizationResult.risks.map((risk, idx) => (
                                        <div key={idx} className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium">{risk.risk_type}</p>
                                                <Badge className="bg-red-600">{risk.severity}</Badge>
                                            </div>
                                            <p className="text-sm text-gray-700">{risk.mitigation}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}