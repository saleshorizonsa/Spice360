import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Clock, TrendingUp, AlertTriangle } from "lucide-react";

export default function ProjectBudgetTracker({ project }) {
    const budgetUtilization = project.budget_cost > 0 
        ? Math.round((project.actual_cost / project.budget_cost) * 100) 
        : 0;
    
    const hoursUtilization = project.budget_hours > 0 
        ? Math.round((project.actual_hours / project.budget_hours) * 100) 
        : 0;

    const budgetVariance = project.budget_cost - project.actual_cost;
    const hoursVariance = project.budget_hours - project.actual_hours;
    
    const margin = project.revenue_recognized > 0 
        ? Math.round(((project.revenue_recognized - project.actual_cost) / project.revenue_recognized) * 100) 
        : 0;

    const getBudgetStatus = (utilization) => {
        if (utilization > 100) return { color: "text-red-600", bg: "bg-red-50", status: "Over Budget" };
        if (utilization > 90) return { color: "text-yellow-600", bg: "bg-yellow-50", status: "At Risk" };
        if (utilization > 75) return { color: "text-blue-600", bg: "bg-blue-50", status: "On Track" };
        return { color: "text-green-600", bg: "bg-green-50", status: "Under Budget" };
    };

    const costStatus = getBudgetStatus(budgetUtilization);
    const hoursStatus = getBudgetStatus(hoursUtilization);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        Cost Budget Tracking
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Budget Utilization</p>
                            <p className="text-2xl font-bold text-gray-900">{budgetUtilization}%</p>
                        </div>
                        <Badge className={`${costStatus.bg} ${costStatus.color}`}>
                            {costStatus.status}
                        </Badge>
                    </div>
                    
                    <Progress value={Math.min(budgetUtilization, 100)} className="h-3" />
                    
                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                            <p className="text-xs text-gray-600">Budgeted</p>
                            <p className="text-lg font-semibold text-gray-900">
                                LKR {project.budget_cost?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Actual</p>
                            <p className="text-lg font-semibold text-blue-600">
                                LKR {project.actual_cost?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Variance</p>
                            <p className={`text-lg font-semibold ${budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {budgetVariance >= 0 ? '+' : ''}LKR {budgetVariance?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        Hours Budget Tracking
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Hours Utilization</p>
                            <p className="text-2xl font-bold text-gray-900">{hoursUtilization}%</p>
                        </div>
                        <Badge className={`${hoursStatus.bg} ${hoursStatus.color}`}>
                            {hoursStatus.status}
                        </Badge>
                    </div>
                    
                    <Progress value={Math.min(hoursUtilization, 100)} className="h-3" />
                    
                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                            <p className="text-xs text-gray-600">Budgeted</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {project.budget_hours?.toLocaleString() || 0}h
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Actual</p>
                            <p className="text-lg font-semibold text-blue-600">
                                {project.actual_hours?.toLocaleString() || 0}h
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Variance</p>
                            <p className={`text-lg font-semibold ${hoursVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {hoursVariance >= 0 ? '+' : ''}{hoursVariance?.toLocaleString() || 0}h
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        Revenue & Margin
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">Revenue Recognized</p>
                            <p className="text-xl font-bold text-gray-900">
                                LKR {project.revenue_recognized?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">Billed Amount</p>
                            <p className="text-xl font-bold text-blue-600">
                                LKR {project.billed_amount?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">Unbilled Revenue</p>
                            <p className="text-xl font-bold text-amber-600">
                                LKR {project.unbilled_revenue?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-600">Gross Margin</p>
                            <p className={`text-xl font-bold ${margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {margin}%
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {(budgetUtilization > 90 || hoursUtilization > 90) && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-red-900">Budget Alert</h4>
                                <p className="text-sm text-red-700 mt-1">
                                    This project is approaching or exceeding budget limits. Review resource allocation and project scope.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}