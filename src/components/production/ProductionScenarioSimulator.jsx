import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LineChart, DollarSign, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ProductionScenarioSimulator() {
    const [simulating, setSimulating] = useState(false);
    const [results, setResults] = useState(null);
    const { toast } = useToast();

    const [scenario, setScenario] = useState({
        production_volume: 1000,
        shift_pattern: 'single',
        overtime_hours: 0,
        machine_efficiency: 85,
        material_cost_variation: 0,
        labor_cost_per_hour: 50
    });

    const simulateScenario = async () => {
        setSimulating(true);
        try {
            const response = await matrixSales.integrations.Core.InvokeLLM({
                prompt: `You are a production simulation expert. Analyze this production scenario and provide detailed impact analysis.

Scenario Parameters:
- Production Volume: ${scenario.production_volume} units
- Shift Pattern: ${scenario.shift_pattern} (single=8h, double=16h, triple=24h)
- Overtime Hours: ${scenario.overtime_hours}
- Machine Efficiency: ${scenario.machine_efficiency}%
- Material Cost Variation: ${scenario.material_cost_variation}%
- Labor Cost: SAR ${scenario.labor_cost_per_hour}/hour

Provide comprehensive analysis with:
1. Total production cost breakdown
2. Estimated delivery timeline
3. Resource utilization
4. Break-even analysis
5. Risk factors
6. Comparison with alternative scenarios

Return in JSON format:`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        cost_analysis: {
                            type: "object",
                            properties: {
                                material_cost: { type: "number" },
                                labor_cost: { type: "number" },
                                overhead_cost: { type: "number" },
                                total_cost: { type: "number" },
                                cost_per_unit: { type: "number" }
                            }
                        },
                        timeline: {
                            type: "object",
                            properties: {
                                estimated_days: { type: "number" },
                                earliest_delivery: { type: "string" },
                                latest_delivery: { type: "string" },
                                buffer_days: { type: "number" }
                            }
                        },
                        resource_utilization: {
                            type: "object",
                            properties: {
                                machine_hours: { type: "number" },
                                labor_hours: { type: "number" },
                                utilization_rate: { type: "number" },
                                bottleneck_areas: { type: "array", items: { type: "string" } }
                            }
                        },
                        break_even: {
                            type: "object",
                            properties: {
                                units_to_break_even: { type: "number" },
                                revenue_required: { type: "number" },
                                profit_margin_percent: { type: "number" }
                            }
                        },
                        alternative_scenarios: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    scenario_name: { type: "string" },
                                    cost_impact: { type: "string" },
                                    time_impact: { type: "string" },
                                    recommendation: { type: "string" }
                                }
                            }
                        },
                        risk_assessment: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            });

            setResults(response);
            toast({ title: "Success", description: "Scenario simulation complete" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to simulate scenario", variant: "destructive" });
        } finally {
            setSimulating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5 text-blue-600" />
                    Production Scenario Simulator
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label>Production Volume (units)</Label>
                        <Input
                            type="number"
                            value={scenario.production_volume}
                            onChange={(e) => setScenario(prev => ({ ...prev, production_volume: parseInt(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <Label>Shift Pattern</Label>
                        <select
                            className="w-full border rounded px-3 py-2"
                            value={scenario.shift_pattern}
                            onChange={(e) => setScenario(prev => ({ ...prev, shift_pattern: e.target.value }))}
                        >
                            <option value="single">Single (8h)</option>
                            <option value="double">Double (16h)</option>
                            <option value="triple">Triple (24h)</option>
                        </select>
                    </div>
                    <div>
                        <Label>Overtime Hours</Label>
                        <Input
                            type="number"
                            value={scenario.overtime_hours}
                            onChange={(e) => setScenario(prev => ({ ...prev, overtime_hours: parseInt(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <Label>Machine Efficiency (%)</Label>
                        <Input
                            type="number"
                            value={scenario.machine_efficiency}
                            onChange={(e) => setScenario(prev => ({ ...prev, machine_efficiency: parseInt(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <Label>Material Cost Variation (%)</Label>
                        <Input
                            type="number"
                            value={scenario.material_cost_variation}
                            onChange={(e) => setScenario(prev => ({ ...prev, material_cost_variation: parseInt(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <Label>Labor Cost (SAR/hour)</Label>
                        <Input
                            type="number"
                            value={scenario.labor_cost_per_hour}
                            onChange={(e) => setScenario(prev => ({ ...prev, labor_cost_per_hour: parseInt(e.target.value) }))}
                        />
                    </div>
                </div>

                <Button
                    onClick={simulateScenario}
                    disabled={simulating}
                    className="w-full bg-blue-600 hover:bg-blue-700 mb-6"
                >
                    {simulating ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Simulating...
                        </>
                    ) : (
                        <>
                            <LineChart className="w-4 h-4 mr-2" />
                            Run Simulation
                        </>
                    )}
                </Button>

                {results && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-5 h-5 text-green-600" />
                                    <h4 className="font-semibold">Total Cost</h4>
                                </div>
                                <p className="text-2xl font-bold">SAR {results.cost_analysis?.total_cost?.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">
                                    Cost per unit: SAR {results.cost_analysis?.cost_per_unit?.toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                    <h4 className="font-semibold">Timeline</h4>
                                </div>
                                <p className="text-2xl font-bold">{results.timeline?.estimated_days} days</p>
                                <p className="text-sm text-gray-600">
                                    Delivery: {results.timeline?.earliest_delivery}
                                </p>
                            </div>
                        </div>

                        <div className="border p-4 rounded-lg">
                            <h4 className="font-semibold mb-3">Cost Breakdown</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Material Cost:</span>
                                    <span className="font-medium">SAR {results.cost_analysis?.material_cost?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Labor Cost:</span>
                                    <span className="font-medium">SAR {results.cost_analysis?.labor_cost?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Overhead Cost:</span>
                                    <span className="font-medium">SAR {results.cost_analysis?.overhead_cost?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="border p-4 rounded-lg">
                            <h4 className="font-semibold mb-3">Resource Utilization</h4>
                            <div className="space-y-2 text-sm">
                                <p>Machine Hours: {results.resource_utilization?.machine_hours}</p>
                                <p>Labor Hours: {results.resource_utilization?.labor_hours}</p>
                                <p>Utilization Rate: {results.resource_utilization?.utilization_rate}%</p>
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-4 rounded-lg border">
                            <h4 className="font-semibold mb-3">Break-Even Analysis</h4>
                            <div className="space-y-2 text-sm">
                                <p>Units to Break Even: {results.break_even?.units_to_break_even}</p>
                                <p>Revenue Required: SAR {results.break_even?.revenue_required?.toLocaleString()}</p>
                                <p>Profit Margin: {results.break_even?.profit_margin_percent}%</p>
                            </div>
                        </div>

                        {results.alternative_scenarios?.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3">Alternative Scenarios</h4>
                                <div className="space-y-2">
                                    {results.alternative_scenarios.map((alt, idx) => (
                                        <div key={idx} className="bg-gray-50 p-3 rounded border">
                                            <p className="font-medium mb-1">{alt.scenario_name}</p>
                                            <p className="text-sm text-gray-600 mb-1">
                                                Cost: {alt.cost_impact} | Time: {alt.time_impact}
                                            </p>
                                            <p className="text-sm">{alt.recommendation}</p>
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