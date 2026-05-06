import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Wrench, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function PredictiveMaintenanceAlert() {
    const [analyzing, setAnalyzing] = useState(false);
    const [predictions, setPredictions] = useState(null);
    const { toast } = useToast();

    const { data: equipment = [] } = useQuery({
        queryKey: ['equipment'],
        queryFn: () => matrixSales.entities.Equipment.list(),
        initialData: []
    });

    const { data: maintenanceRecords = [] } = useQuery({
        queryKey: ['maintenanceRecords'],
        queryFn: () => matrixSales.entities.MaintenanceRecord.list('-maintenance_date', 100),
        initialData: []
    });

    const analyzeMaintenance = async () => {
        setAnalyzing(true);
        try {
            const equipmentData = equipment.map(e => ({
                id: e.equipment_id,
                name: e.equipment_name,
                type: e.equipment_type,
                installation_date: e.installation_date,
                last_maintenance: maintenanceRecords.find(m => m.equipment_id === e.equipment_id)?.maintenance_date,
                total_maintenance_cost: maintenanceRecords
                    .filter(m => m.equipment_id === e.equipment_id)
                    .reduce((sum, m) => sum + (m.total_cost || 0), 0),
                maintenance_count: maintenanceRecords.filter(m => m.equipment_id === e.equipment_id).length
            }));

            const response = await matrixSales.integrations.Core.InvokeLLM({
                prompt: `You are a predictive maintenance AI expert. Analyze this equipment and maintenance history data to predict maintenance needs.

Equipment Data:
${JSON.stringify(equipmentData, null, 2)}

Recent Maintenance History:
${JSON.stringify(maintenanceRecords.slice(0, 30), null, 2)}

Predict maintenance requirements and provide:
1. Equipment requiring immediate attention
2. Predicted failure risks in next 30/60/90 days
3. Recommended preventive actions
4. Cost-benefit analysis of proactive maintenance

Return in JSON format:`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        immediate_alerts: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    equipment_id: { type: "string" },
                                    equipment_name: { type: "string" },
                                    urgency: { type: "string" },
                                    predicted_issue: { type: "string" },
                                    recommended_action: { type: "string" },
                                    estimated_cost: { type: "number" }
                                }
                            }
                        },
                        risk_timeline: {
                            type: "object",
                            properties: {
                                next_30_days: { type: "array", items: { type: "string" } },
                                next_60_days: { type: "array", items: { type: "string" } },
                                next_90_days: { type: "array", items: { type: "string" } }
                            }
                        },
                        preventive_recommendations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    equipment: { type: "string" },
                                    action: { type: "string" },
                                    priority: { type: "string" },
                                    estimated_downtime_hours: { type: "number" },
                                    cost_savings: { type: "number" }
                                }
                            }
                        },
                        overall_health_score: { type: "number" }
                    }
                }
            });

            setPredictions(response);
            toast({ title: "Success", description: "Maintenance analysis complete" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to analyze maintenance", variant: "destructive" });
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Predictive Maintenance Alerts
                    </CardTitle>
                    <Button
                        onClick={analyzeMaintenance}
                        disabled={analyzing}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Analyze Equipment
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {!predictions && !analyzing && (
                    <div className="text-center py-8 text-gray-500">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>Click "Analyze Equipment" for AI-powered maintenance predictions</p>
                    </div>
                )}

                {predictions && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border">
                            <h4 className="font-semibold mb-2">Overall Equipment Health</h4>
                            <div className="text-3xl font-bold text-indigo-600">
                                {predictions.overall_health_score}%
                            </div>
                        </div>

                        {predictions.immediate_alerts?.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    Immediate Attention Required
                                </h4>
                                <div className="space-y-2">
                                    {predictions.immediate_alerts.map((alert, idx) => (
                                        <div key={idx} className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-semibold">{alert.equipment_name}</p>
                                                    <p className="text-sm text-gray-600">{alert.equipment_id}</p>
                                                </div>
                                                <Badge className="bg-red-600">{alert.urgency}</Badge>
                                            </div>
                                            <p className="text-sm mb-2"><strong>Issue:</strong> {alert.predicted_issue}</p>
                                            <p className="text-sm mb-2"><strong>Action:</strong> {alert.recommended_action}</p>
                                            <p className="text-sm text-gray-700">
                                                <strong>Est. Cost:</strong> SAR {alert.estimated_cost?.toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="font-semibold mb-3">Risk Timeline</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-yellow-50 p-3 rounded border">
                                    <p className="font-semibold text-sm mb-2">Next 30 Days</p>
                                    <ul className="text-xs space-y-1">
                                        {predictions.risk_timeline?.next_30_days?.map((item, i) => (
                                            <li key={i}>• {item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-orange-50 p-3 rounded border">
                                    <p className="font-semibold text-sm mb-2">Next 60 Days</p>
                                    <ul className="text-xs space-y-1">
                                        {predictions.risk_timeline?.next_60_days?.map((item, i) => (
                                            <li key={i}>• {item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-red-50 p-3 rounded border">
                                    <p className="font-semibold text-sm mb-2">Next 90 Days</p>
                                    <ul className="text-xs space-y-1">
                                        {predictions.risk_timeline?.next_90_days?.map((item, i) => (
                                            <li key={i}>• {item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                Preventive Recommendations
                            </h4>
                            <div className="space-y-2">
                                {predictions.preventive_recommendations?.map((rec, idx) => (
                                    <div key={idx} className="bg-green-50 p-3 rounded border border-green-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-medium">{rec.equipment}</p>
                                            <Badge className={
                                                rec.priority === 'high' ? 'bg-red-600' :
                                                rec.priority === 'medium' ? 'bg-yellow-600' :
                                                'bg-green-600'
                                            }>{rec.priority}</Badge>
                                        </div>
                                        <p className="text-sm mb-1">{rec.action}</p>
                                        <div className="flex gap-4 text-xs text-gray-600">
                                            <span>Downtime: {rec.estimated_downtime_hours}h</span>
                                            <span>Savings: SAR {rec.cost_savings?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}