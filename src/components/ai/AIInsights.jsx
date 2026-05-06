import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AIInsights() {
    const [insights, setInsights] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const { data: sales = [] } = useQuery({
        queryKey: ['sales'],
        queryFn: async () => {
            try {
                return await matrixSales.entities.SalesOrder.list('-order_date', 100);
            } catch (error) {
                console.error("Error fetching sales:", error);
                return [];
            }
        },
        initialData: []
    });

    const { data: purchases = [] } = useQuery({
        queryKey: ['purchases'],
        queryFn: async () => {
            try {
                return await matrixSales.entities.PurchaseOrder.list('-po_date', 100);
            } catch (error) {
                console.error("Error fetching purchases:", error);
                return [];
            }
        },
        initialData: []
    });

    const { data: stockLevels = [] } = useQuery({
        queryKey: ['stockLevels'],
        queryFn: async () => {
            try {
                return await matrixSales.entities.StockLevel.list();
            } catch (error) {
                console.error("Error fetching stock levels:", error);
                return [];
            }
        },
        initialData: []
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            try {
                return await matrixSales.entities.Invoice.list('-invoice_date', 100);
            } catch (error) {
                console.error("Error fetching invoices:", error);
                return [];
            }
        },
        initialData: []
    });

    const { data: arRecords = [] } = useQuery({
        queryKey: ['ar'],
        queryFn: async () => {
            try {
                return await matrixSales.entities.AccountsReceivable.list();
            } catch (error) {
                console.error("Error fetching AR:", error);
                return [];
            }
        },
        initialData: []
    });

    const generateInsights = async () => {
        setIsGenerating(true);
        
        try {
            const businessData = {
                sales_summary: {
                    total_orders: sales.length,
                    total_revenue: sales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
                    avg_order_value: sales.length > 0 ? sales.reduce((sum, s) => sum + (s.total_amount || 0), 0) / sales.length : 0,
                    pending_orders: sales.filter(s => s.status === 'pending_approval' || s.status === 'draft').length
                },
                inventory_summary: {
                    total_stock_value: stockLevels.reduce((sum, s) => sum + (s.total_value || 0), 0),
                    low_stock_items: stockLevels.filter(s => (s.available_quantity || 0) < (s.reorder_point || 0)).length,
                    slow_moving_items: stockLevels.filter(s => (s.aging_days || 0) > 90).length
                },
                finance_summary: {
                    outstanding_ar: arRecords.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0),
                    overdue_ar: arRecords.filter(ar => (ar.aging_days || 0) > 30).length,
                    total_invoices: invoices.length,
                    unpaid_invoices: invoices.filter(i => i.payment_status === 'unpaid').length
                },
                purchasing_summary: {
                    total_pos: purchases.length,
                    total_spend: purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
                    pending_approval: purchases.filter(p => p.status === 'pending_approval').length
                }
            };

            const response = await matrixSales.integrations.Core.InvokeLLM({
                prompt: `You are a business intelligence analyst for an ERP system. Analyze the following business data and provide actionable insights, trends, and recommendations.

Business Data:
${JSON.stringify(businessData, null, 2)}

Provide your analysis in the following JSON format:
{
    "executive_summary": "Brief overview of business health",
    "key_insights": [
        {
            "category": "sales|inventory|finance|purchasing",
            "type": "positive|negative|warning|neutral",
            "title": "Insight title",
            "description": "Detailed description",
            "metric": "Key metric or number",
            "recommendation": "What action to take"
        }
    ],
    "trends": [
        {
            "area": "Area name",
            "direction": "up|down|stable",
            "description": "Trend description"
        }
    ],
    "alerts": [
        {
            "severity": "high|medium|low",
            "message": "Alert message",
            "action_needed": "What to do"
        }
    ],
    "opportunities": [
        {
            "title": "Opportunity title",
            "potential_impact": "Impact description",
            "next_steps": "Recommended steps"
        }
    ]
}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        executive_summary: { type: "string" },
                        key_insights: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    category: { type: "string" },
                                    type: { type: "string" },
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    metric: { type: "string" },
                                    recommendation: { type: "string" }
                                }
                            }
                        },
                        trends: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    area: { type: "string" },
                                    direction: { type: "string" },
                                    description: { type: "string" }
                                }
                            }
                        },
                        alerts: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    severity: { type: "string" },
                                    message: { type: "string" },
                                    action_needed: { type: "string" }
                                }
                            }
                        },
                        opportunities: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    potential_impact: { type: "string" },
                                    next_steps: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            setInsights(response);
            toast({ title: "Success", description: "AI insights generated successfully" });
        } catch (error) {
            console.error("Error generating insights:", error);
            toast({ 
                title: "Error", 
                description: "Failed to generate insights. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const getInsightIcon = (type) => {
        switch(type) {
            case 'positive': return TrendingUp;
            case 'negative': return TrendingDown;
            case 'warning': return AlertTriangle;
            default: return Lightbulb;
        }
    };

    const getInsightColor = (type) => {
        switch(type) {
            case 'positive': return 'bg-green-50 border-green-200';
            case 'negative': return 'bg-red-50 border-red-200';
            case 'warning': return 'bg-amber-50 border-amber-200';
            default: return 'bg-blue-50 border-blue-200';
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-600" />
                            AI-Powered Business Insights
                        </CardTitle>
                        <Button
                            onClick={generateInsights}
                            disabled={isGenerating}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Insights
                                </>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                {insights && (
                    <CardContent className="space-y-6">
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-lg border border-emerald-200">
                            <h3 className="font-semibold text-lg mb-2 text-emerald-900">Executive Summary</h3>
                            <p className="text-gray-700">{insights.executive_summary}</p>
                        </div>

                        {insights.key_insights && insights.key_insights.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-lg mb-4">Key Insights</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {insights.key_insights.map((insight, idx) => {
                                        const Icon = getInsightIcon(insight.type);
                                        return (
                                            <Card key={idx} className={`border-2 ${getInsightColor(insight.type)}`}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <Icon className="w-5 h-5 mt-0.5" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="outline">{insight.category}</Badge>
                                                                <h4 className="font-semibold">{insight.title}</h4>
                                                            </div>
                                                            <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                                                            {insight.metric && (
                                                                <div className="text-2xl font-bold text-gray-900 mb-2">
                                                                    {insight.metric}
                                                                </div>
                                                            )}
                                                            {insight.recommendation && (
                                                                <div className="bg-white p-2 rounded border mt-2">
                                                                    <p className="text-xs font-medium text-gray-600">
                                                                        💡 {insight.recommendation}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {insights.trends && insights.trends.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-lg mb-4">Business Trends</h3>
                                <div className="space-y-2">
                                    {insights.trends.map((trend, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            {trend.direction === 'up' ? (
                                                <TrendingUp className="w-5 h-5 text-green-600" />
                                            ) : trend.direction === 'down' ? (
                                                <TrendingDown className="w-5 h-5 text-red-600" />
                                            ) : (
                                                <span className="w-5 h-5 flex items-center justify-center text-gray-600">→</span>
                                            )}
                                            <div className="flex-1">
                                                <span className="font-medium">{trend.area}:</span>{' '}
                                                <span className="text-gray-700">{trend.description}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {insights.alerts && insights.alerts.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-lg mb-4">Alerts & Action Items</h3>
                                <div className="space-y-3">
                                    {insights.alerts.map((alert, idx) => (
                                        <Card key={idx} className={`border-l-4 ${
                                            alert.severity === 'high' ? 'border-red-500 bg-red-50' :
                                            alert.severity === 'medium' ? 'border-amber-500 bg-amber-50' :
                                            'border-blue-500 bg-blue-50'
                                        }`}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className={`w-5 h-5 ${
                                                        alert.severity === 'high' ? 'text-red-600' :
                                                        alert.severity === 'medium' ? 'text-amber-600' :
                                                        'text-blue-600'
                                                    }`} />
                                                    <div>
                                                        <Badge className="mb-2">{alert.severity}</Badge>
                                                        <p className="font-medium mb-1">{alert.message}</p>
                                                        <p className="text-sm text-gray-700">
                                                            <strong>Action:</strong> {alert.action_needed}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {insights.opportunities && insights.opportunities.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-lg mb-4">Growth Opportunities</h3>
                                <div className="space-y-3">
                                    {insights.opportunities.map((opp, idx) => (
                                        <Card key={idx} className="border-emerald-200 bg-emerald-50">
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <Lightbulb className="w-5 h-5 text-emerald-600 mt-0.5" />
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold mb-2">{opp.title}</h4>
                                                        <p className="text-sm text-gray-700 mb-2">
                                                            <strong>Impact:</strong> {opp.potential_impact}
                                                        </p>
                                                        <p className="text-sm text-gray-700">
                                                            <strong>Next Steps:</strong> {opp.next_steps}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {!insights && !isGenerating && (
                <Card className="border-dashed border-2">
                    <CardContent className="py-12 text-center">
                        <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">AI-Powered Business Intelligence</h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            Let AI analyze your business data and provide actionable insights, identify trends, 
                            and uncover opportunities for growth.
                        </p>
                        <Button
                            onClick={generateInsights}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate AI Insights Now
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}