import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function ProjectReports({ projects, tasks, expenses, timesheets, resourceAllocations }) {
    const [activeReport, setActiveReport] = useState("summary");

    // Project Status Distribution
    const statusData = projects.reduce((acc, p) => {
        const status = p.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const statusChartData = Object.entries(statusData).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value
    }));

    // Budget vs Actual by Project
    const budgetData = projects.slice(0, 10).map(p => ({
        name: p.project_code,
        budget: p.budget_cost || 0,
        actual: p.actual_cost || 0,
        hours_budget: p.budget_hours || 0,
        hours_actual: p.actual_hours || 0
    }));

    // Resource Utilization
    const resourceData = resourceAllocations.reduce((acc, r) => {
        if (!acc[r.employee_name]) {
            acc[r.employee_name] = { name: r.employee_name, allocation: 0, count: 0 };
        }
        acc[r.employee_name].allocation += r.allocation_percent || 0;
        acc[r.employee_name].count += 1;
        return acc;
    }, {});

    const resourceChartData = Object.values(resourceData).map(r => ({
        name: r.name,
        avgAllocation: Math.round(r.allocation / r.count)
    }));

    // Monthly Expenses Trend
    const expensesByMonth = expenses.reduce((acc, e) => {
        const month = e.expense_date?.substring(0, 7) || 'Unknown';
        acc[month] = (acc[month] || 0) + (e.amount || 0);
        return acc;
    }, {});

    const expenseTrendData = Object.entries(expensesByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const exportToCSV = (data, filename) => {
        const csv = [
            Object.keys(data[0]).join(','),
            ...data.map(row => Object.values(row).join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    return (
        <div className="space-y-6">
            <Tabs value={activeReport} onValueChange={setActiveReport}>
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="budget">Budget Analysis</TabsTrigger>
                    <TabsTrigger value="resources">Resources</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Project Status Distribution</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportToCSV(statusChartData, 'project-status.csv')}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={statusChartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {statusChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-600">Total Projects</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{projects.length}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-600">Active Tasks</p>
                                    <p className="text-3xl font-bold text-blue-600 mt-2">
                                        {tasks.filter(t => t.status === 'in_progress').length}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-600">Total Resources</p>
                                    <p className="text-3xl font-bold text-purple-600 mt-2">
                                        {resourceAllocations.length}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="budget" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Budget vs Actual Cost</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportToCSV(budgetData, 'budget-analysis.csv')}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={budgetData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="budget" fill="#10b981" name="Budget Cost" />
                                    <Bar dataKey="actual" fill="#3b82f6" name="Actual Cost" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Budget vs Actual Hours</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={budgetData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="hours_budget" fill="#8b5cf6" name="Budget Hours" />
                                    <Bar dataKey="hours_actual" fill="#f59e0b" name="Actual Hours" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="resources" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Resource Allocation Overview</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportToCSV(resourceChartData, 'resource-allocation.csv')}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={resourceChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="avgAllocation" fill="#ec4899" name="Avg Allocation %" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Monthly Expense Trend</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportToCSV(expenseTrendData, 'expense-trend.csv')}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={expenseTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} name="Total Expenses (SAR)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div>
                                    <p className="text-sm text-gray-600">Total Expenses</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">
                                        SAR {expenses.reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString()}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div>
                                    <p className="text-sm text-gray-600">Pending Approval</p>
                                    <p className="text-3xl font-bold text-amber-600 mt-2">
                                        {expenses.filter(e => e.status === 'submitted').length}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}