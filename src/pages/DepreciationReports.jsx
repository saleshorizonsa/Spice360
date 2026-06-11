import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
    TrendingDown, 
    Download, 
    Printer, 
    BarChart3, 
    PieChart as PieChartIcon,
    Calendar,
    Filter,
    Package2
} from "lucide-react";
import { 
    BarChart, 
    Bar, 
    LineChart, 
    Line, 
    PieChart, 
    Pie, 
    Cell,
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer 
} from 'recharts';

export default function DepreciationReports() {
    const [filters, setFilters] = useState({
        assetClass: 'all',
        status: 'all',
        dateFrom: '',
        dateTo: '',
        fiscalYear: new Date().getFullYear().toString(),
        method: 'all'
    });

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list(),
        initialData: []
    });

    const { data: depreciation = [] } = useQuery({
        queryKey: ['depreciation'],
        queryFn: () => matrixSales.entities.AssetDepreciation.list('-depreciation_date'),
        initialData: []
    });

    // Apply filters
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            if (filters.assetClass !== 'all' && asset.asset_class !== filters.assetClass) return false;
            if (filters.status !== 'all' && asset.status !== filters.status) return false;
            if (filters.method !== 'all' && asset.depreciation_method !== filters.method) return false;
            if (filters.dateFrom && asset.acquisition_date < filters.dateFrom) return false;
            if (filters.dateTo && asset.acquisition_date > filters.dateTo) return false;
            return true;
        });
    }, [assets, filters]);

    const filteredDepreciation = useMemo(() => {
        return depreciation.filter(dep => {
            if (filters.fiscalYear !== 'all' && dep.fiscal_year !== filters.fiscalYear) return false;
            if (filters.dateFrom && dep.depreciation_date < filters.dateFrom) return false;
            if (filters.dateTo && dep.depreciation_date > filters.dateTo) return false;
            
            // Filter by asset criteria
            const asset = assets.find(a => a.asset_number === dep.asset_number);
            if (!asset) return false;
            if (filters.assetClass !== 'all' && asset.asset_class !== filters.assetClass) return false;
            if (filters.status !== 'all' && asset.status !== filters.status) return false;
            if (filters.method !== 'all' && asset.depreciation_method !== filters.method) return false;
            
            return true;
        });
    }, [depreciation, assets, filters]);

    // Calculate KPIs
    const totalAcquisitionCost = filteredAssets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
    const totalAccumulatedDep = filteredAssets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
    const totalNBV = filteredAssets.reduce((sum, a) => sum + (a.net_book_value || 0), 0);
    const totalPeriodDep = filteredDepreciation.reduce((sum, d) => sum + (d.depreciation_amount || 0), 0);
    const avgDepreciationRate = totalAcquisitionCost > 0 
        ? ((totalAccumulatedDep / totalAcquisitionCost) * 100).toFixed(1) 
        : 0;

    // Prepare chart data - By Asset Class
    const depreciationByClass = useMemo(() => {
        const grouped = filteredAssets.reduce((acc, asset) => {
            const cls = asset.asset_class;
            if (!acc[cls]) {
                acc[cls] = {
                    class: cls,
                    acquisition_cost: 0,
                    accumulated_depreciation: 0,
                    nbv: 0,
                    count: 0
                };
            }
            acc[cls].acquisition_cost += asset.acquisition_cost || 0;
            acc[cls].accumulated_depreciation += asset.accumulated_depreciation || 0;
            acc[cls].nbv += asset.net_book_value || 0;
            acc[cls].count += 1;
            return acc;
        }, {});
        return Object.values(grouped);
    }, [filteredAssets]);

    // Prepare monthly trend data
    const monthlyTrend = useMemo(() => {
        const grouped = filteredDepreciation.reduce((acc, dep) => {
            const key = `${dep.fiscal_year}-${dep.period}`;
            if (!acc[key]) {
                acc[key] = {
                    period: key,
                    depreciation: 0,
                    count: 0
                };
            }
            acc[key].depreciation += dep.depreciation_amount || 0;
            acc[key].count += 1;
            return acc;
        }, {});
        return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
    }, [filteredDepreciation]);

    // Prepare data for depreciation method distribution
    const methodDistribution = useMemo(() => {
        const grouped = filteredAssets.reduce((acc, asset) => {
            const method = asset.depreciation_method || 'unknown';
            if (!acc[method]) {
                acc[method] = {
                    name: method.replace('_', ' ').toUpperCase(),
                    value: 0,
                    count: 0
                };
            }
            acc[method].value += asset.acquisition_cost || 0;
            acc[method].count += 1;
            return acc;
        }, {});
        return Object.values(grouped);
    }, [filteredAssets]);

    // NBV vs Accumulated Depreciation by class
    const nbvVsDepByClass = useMemo(() => {
        return depreciationByClass.map(item => ({
            class: item.class.toUpperCase(),
            NBV: item.nbv,
            'Accumulated Dep.': item.accumulated_depreciation
        }));
    }, [depreciationByClass]);

    const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    const handleExportCSV = () => {
        const data = filteredAssets.map(a => ({
            'Asset Number': a.asset_number,
            'Asset Name': a.asset_name,
            'Asset Class': a.asset_class,
            'Status': a.status,
            'Acquisition Date': a.acquisition_date,
            'Acquisition Cost': a.acquisition_cost,
            'Useful Life (Years)': a.useful_life_years,
            'Depreciation Method': a.depreciation_method,
            'Salvage Value': a.salvage_value || 0,
            'Accumulated Depreciation': a.accumulated_depreciation || 0,
            'Net Book Value': a.net_book_value,
            'Depreciation Rate %': a.acquisition_cost > 0 
                ? (((a.accumulated_depreciation || 0) / a.acquisition_cost) * 100).toFixed(2)
                : 0,
            'Location': a.location_code,
            'Responsible Person': a.responsible_person
        }));

        const csv = [
            Object.keys(data[0]).join(','),
            ...data.map(row => Object.values(row).map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depreciation-report-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Depreciation Analysis Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
                    h2 { color: #047857; margin-top: 30px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
                    .filters {
                        background: #f3f4f6;
                        padding: 15px;
                        border-radius: 8px;
                        margin: 20px 0;
                    }
                    .filter-item {
                        display: inline-block;
                        margin-right: 20px;
                        margin-bottom: 10px;
                    }
                    .label { font-weight: bold; color: #6b7280; }
                    .kpi-grid {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        gap: 15px;
                        margin: 20px 0;
                    }
                    .kpi-card {
                        padding: 15px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .kpi-value {
                        font-size: 24px;
                        font-weight: bold;
                        color: #059669;
                    }
                    .kpi-label {
                        font-size: 11px;
                        color: #6b7280;
                        margin-top: 5px;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 15px;
                        font-size: 11px;
                    }
                    th, td { 
                        border: 1px solid #d1d5db; 
                        padding: 8px; 
                        text-align: right; 
                    }
                    th { 
                        background-color: #f9fafb; 
                        font-weight: bold;
                    }
                    .total-row {
                        background-color: #ecfdf5;
                        font-weight: bold;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <h1>Fixed Assets Depreciation Analysis Report</h1>
                <p style="color: #6b7280;">Generated: ${new Date().toLocaleString()}</p>

                <div class="filters">
                    <h3 style="margin-top: 0;">Applied Filters</h3>
                    ${filters.assetClass !== 'all' ? `<div class="filter-item"><span class="label">Asset Class:</span> ${filters.assetClass}</div>` : ''}
                    ${filters.status !== 'all' ? `<div class="filter-item"><span class="label">Status:</span> ${filters.status}</div>` : ''}
                    ${filters.method !== 'all' ? `<div class="filter-item"><span class="label">Method:</span> ${filters.method}</div>` : ''}
                    ${filters.fiscalYear !== 'all' ? `<div class="filter-item"><span class="label">Fiscal Year:</span> ${filters.fiscalYear}</div>` : ''}
                    ${filters.dateFrom ? `<div class="filter-item"><span class="label">Date From:</span> ${filters.dateFrom}</div>` : ''}
                    ${filters.dateTo ? `<div class="filter-item"><span class="label">Date To:</span> ${filters.dateTo}</div>` : ''}
                </div>

                <h2>Summary Statistics</h2>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${filteredAssets.length}</div>
                        <div class="kpi-label">Assets</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">LKR ${(totalAcquisitionCost / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Acquisition Cost</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">LKR ${(totalAccumulatedDep / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Accumulated Dep.</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">LKR ${(totalNBV / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Net Book Value</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${avgDepreciationRate}%</div>
                        <div class="kpi-label">Avg. Dep. Rate</div>
                    </div>
                </div>

                <h2>Depreciation by Asset Class</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Asset Class</th>
                            <th>Count</th>
                            <th>Acquisition Cost</th>
                            <th>Accumulated Dep.</th>
                            <th>NBV</th>
                            <th>Dep. %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${depreciationByClass.map(item => {
                            const depPercent = item.acquisition_cost > 0 
                                ? ((item.accumulated_depreciation / item.acquisition_cost) * 100).toFixed(1)
                                : 0;
                            return `
                                <tr>
                                    <td style="text-align: left; text-transform: capitalize;">${item.class}</td>
                                    <td style="text-align: center;">${item.count}</td>
                                    <td>LKR ${item.acquisition_cost.toLocaleString()}</td>
                                    <td>LKR ${item.accumulated_depreciation.toLocaleString()}</td>
                                    <td>LKR ${item.nbv.toLocaleString()}</td>
                                    <td style="text-align: center;">${depPercent}%</td>
                                </tr>
                            `;
                        }).join('')}
                        <tr class="total-row">
                            <td style="text-align: left;">TOTAL</td>
                            <td style="text-align: center;">${filteredAssets.length}</td>
                            <td>LKR ${totalAcquisitionCost.toLocaleString()}</td>
                            <td>LKR ${totalAccumulatedDep.toLocaleString()}</td>
                            <td>LKR ${totalNBV.toLocaleString()}</td>
                            <td style="text-align: center;">${avgDepreciationRate}%</td>
                        </tr>
                    </tbody>
                </table>

                <h2>Asset Details</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Asset #</th>
                            <th style="text-align: left;">Asset Name</th>
                            <th>Class</th>
                            <th>Method</th>
                            <th>Acq. Cost</th>
                            <th>Accum. Dep.</th>
                            <th>NBV</th>
                            <th>Dep. %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredAssets.map(asset => {
                            const depPercent = asset.acquisition_cost > 0 
                                ? (((asset.accumulated_depreciation || 0) / asset.acquisition_cost) * 100).toFixed(1)
                                : 0;
                            return `
                                <tr>
                                    <td style="text-align: left;">${asset.asset_number}</td>
                                    <td style="text-align: left;">${asset.asset_name}</td>
                                    <td style="text-align: center; text-transform: capitalize;">${asset.asset_class}</td>
                                    <td style="text-align: center; text-transform: capitalize;">${asset.depreciation_method.replace('_', ' ')}</td>
                                    <td>LKR ${asset.acquisition_cost.toLocaleString()}</td>
                                    <td>LKR ${(asset.accumulated_depreciation || 0).toLocaleString()}</td>
                                    <td>LKR ${asset.net_book_value.toLocaleString()}</td>
                                    <td style="text-align: center;">${depPercent}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #d1d5db; text-align: center; color: #6b7280; font-size: 11px;">
                    <p>Fixed Assets Depreciation Analysis Report | Company Asset Management System</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const resetFilters = () => {
        setFilters({
            assetClass: 'all',
            status: 'all',
            dateFrom: '',
            dateTo: '',
            fiscalYear: new Date().getFullYear().toString(),
            method: 'all'
        });
    };

    // Get unique fiscal years from depreciation data
    const fiscalYears = useMemo(() => {
        const years = new Set(depreciation.map(d => d.fiscal_year));
        return ['all', ...Array.from(years).sort().reverse()];
    }, [depreciation]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Depreciation Analysis & Reports</h1>
                    <p className="text-gray-600 mt-1">Advanced depreciation analytics with filtering and visualizations</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print Report
                    </Button>
                </div>
            </div>

            {/* Filters Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-emerald-600" />
                            Filters
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={resetFilters}>
                            Reset Filters
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <Label>Asset Class</Label>
                            <Select 
                                value={filters.assetClass} 
                                onValueChange={(val) => setFilters({...filters, assetClass: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Classes</SelectItem>
                                    <SelectItem value="land">Land</SelectItem>
                                    <SelectItem value="building">Building</SelectItem>
                                    <SelectItem value="machinery">Machinery</SelectItem>
                                    <SelectItem value="equipment">Equipment</SelectItem>
                                    <SelectItem value="vehicles">Vehicles</SelectItem>
                                    <SelectItem value="furniture">Furniture</SelectItem>
                                    <SelectItem value="computers">Computers</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Status</Label>
                            <Select 
                                value={filters.status} 
                                onValueChange={(val) => setFilters({...filters, status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="disposed">Disposed</SelectItem>
                                    <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Method</Label>
                            <Select 
                                value={filters.method} 
                                onValueChange={(val) => setFilters({...filters, method: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Methods</SelectItem>
                                    <SelectItem value="straight_line">Straight Line</SelectItem>
                                    <SelectItem value="declining_balance">Declining Balance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Fiscal Year</Label>
                            <Select 
                                value={filters.fiscalYear} 
                                onValueChange={(val) => setFilters({...filters, fiscalYear: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {fiscalYears.map(year => (
                                        <SelectItem key={year} value={year}>
                                            {year === 'all' ? 'All Years' : year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Date From</Label>
                            <Input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                            />
                        </div>

                        <div>
                            <Label>Date To</Label>
                            <Input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Active Filters Display */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {filters.assetClass !== 'all' && (
                            <Badge variant="secondary">Class: {filters.assetClass}</Badge>
                        )}
                        {filters.status !== 'all' && (
                            <Badge variant="secondary">Status: {filters.status}</Badge>
                        )}
                        {filters.method !== 'all' && (
                            <Badge variant="secondary">Method: {filters.method.replace('_', ' ')}</Badge>
                        )}
                        {filters.fiscalYear !== 'all' && (
                            <Badge variant="secondary">Year: {filters.fiscalYear}</Badge>
                        )}
                        {filters.dateFrom && (
                            <Badge variant="secondary">From: {filters.dateFrom}</Badge>
                        )}
                        {filters.dateTo && (
                            <Badge variant="secondary">To: {filters.dateTo}</Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Assets</p>
                                <p className="text-2xl font-bold text-gray-900">{filteredAssets.length}</p>
                            </div>
                            <Package2 className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Acquisition Cost</p>
                                <p className="text-2xl font-bold text-blue-900">
                                    LKR {(totalAcquisitionCost / 1000000).toFixed(1)}M
                                </p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Accumulated Dep.</p>
                                <p className="text-2xl font-bold text-red-900">
                                    LKR {(totalAccumulatedDep / 1000000).toFixed(1)}M
                                </p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Net Book Value</p>
                                <p className="text-2xl font-bold text-emerald-900">
                                    LKR {(totalNBV / 1000000).toFixed(1)}M
                                </p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Avg. Dep. Rate</p>
                                <p className="text-2xl font-bold text-purple-900">{avgDepreciationRate}%</p>
                            </div>
                            <BarChart3 className="w-8 h-8 text-purple-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts and Analytics */}
            <Tabs defaultValue="by-class" className="space-y-4">
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="by-class">By Asset Class</TabsTrigger>
                    <TabsTrigger value="trend">Monthly Trend</TabsTrigger>
                    <TabsTrigger value="method">By Method</TabsTrigger>
                    <TabsTrigger value="comparison">NBV vs Dep.</TabsTrigger>
                </TabsList>

                <TabsContent value="by-class">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-emerald-600" />
                                Depreciation by Asset Class
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={depreciationByClass}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="class" 
                                        tick={{ fontSize: 12 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip 
                                        formatter={(value) => `LKR ${value.toLocaleString()}`}
                                        contentStyle={{ fontSize: 12 }}
                                    />
                                    <Legend />
                                    <Bar dataKey="acquisition_cost" fill="#3b82f6" name="Acquisition Cost" />
                                    <Bar dataKey="accumulated_depreciation" fill="#ef4444" name="Accumulated Dep." />
                                    <Bar dataKey="nbv" fill="#059669" name="NBV" />
                                </BarChart>
                            </ResponsiveContainer>

                            {/* Summary Table */}
                            <div className="mt-6 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-2 text-left">Class</th>
                                            <th className="p-2 text-center">Count</th>
                                            <th className="p-2 text-right">Acq. Cost</th>
                                            <th className="p-2 text-right">Accum. Dep.</th>
                                            <th className="p-2 text-right">NBV</th>
                                            <th className="p-2 text-center">Dep. %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {depreciationByClass.map((item, idx) => {
                                            const depPercent = item.acquisition_cost > 0 
                                                ? ((item.accumulated_depreciation / item.acquisition_cost) * 100).toFixed(1)
                                                : 0;
                                            return (
                                                <tr key={idx} className="border-t hover:bg-gray-50">
                                                    <td className="p-2 capitalize font-medium">{item.class}</td>
                                                    <td className="p-2 text-center">{item.count}</td>
                                                    <td className="p-2 text-right">{item.acquisition_cost.toLocaleString()}</td>
                                                    <td className="p-2 text-right">{item.accumulated_depreciation.toLocaleString()}</td>
                                                    <td className="p-2 text-right font-semibold text-emerald-700">
                                                        {item.nbv.toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <Badge variant="outline">{depPercent}%</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="trend">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                                Monthly Depreciation Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="period" 
                                        tick={{ fontSize: 11 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip 
                                        formatter={(value) => `LKR ${value.toLocaleString()}`}
                                        contentStyle={{ fontSize: 12 }}
                                    />
                                    <Legend />
                                    <Line 
                                        type="monotone" 
                                        dataKey="depreciation" 
                                        stroke="#059669" 
                                        strokeWidth={2}
                                        name="Depreciation Amount"
                                        dot={{ fill: '#059669' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>

                            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-sm text-blue-700">Total Periods</p>
                                        <p className="text-2xl font-bold text-blue-900">{monthlyTrend.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-blue-700">Total Depreciation</p>
                                        <p className="text-2xl font-bold text-blue-900">
                                            LKR {totalPeriodDep.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-blue-700">Avg. per Period</p>
                                        <p className="text-2xl font-bold text-blue-900">
                                            LKR {monthlyTrend.length > 0 
                                                ? (totalPeriodDep / monthlyTrend.length).toLocaleString(undefined, {
                                                    maximumFractionDigits: 0
                                                })
                                                : 0
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="method">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChartIcon className="w-5 h-5 text-emerald-600" />
                                Depreciation Method Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={methodDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {methodDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(value) => `LKR ${value.toLocaleString()}`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="space-y-3">
                                    <h4 className="font-semibold text-gray-900">Method Breakdown</h4>
                                    {methodDistribution.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-4 h-4 rounded"
                                                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                                />
                                                <span className="font-medium">{item.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">
                                                    {item.count} assets
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    LKR {(item.value / 1000000).toFixed(1)}M
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="comparison">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-emerald-600" />
                                NBV vs Accumulated Depreciation Comparison
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={nbvVsDepByClass}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="class" 
                                        tick={{ fontSize: 12 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip 
                                        formatter={(value) => `LKR ${value.toLocaleString()}`}
                                        contentStyle={{ fontSize: 12 }}
                                    />
                                    <Legend />
                                    <Bar dataKey="NBV" fill="#059669" name="Net Book Value" />
                                    <Bar dataKey="Accumulated Dep." fill="#ef4444" name="Accumulated Depreciation" />
                                </BarChart>
                            </ResponsiveContainer>

                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                                    <p className="text-sm text-emerald-700 font-medium">Total Net Book Value</p>
                                    <p className="text-3xl font-bold text-emerald-900 mt-2">
                                        LKR {(totalNBV / 1000000).toFixed(2)}M
                                    </p>
                                    <p className="text-xs text-emerald-600 mt-1">
                                        {((totalNBV / totalAcquisitionCost) * 100).toFixed(1)}% of acquisition cost
                                    </p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                                    <p className="text-sm text-red-700 font-medium">Total Accumulated Depreciation</p>
                                    <p className="text-3xl font-bold text-red-900 mt-2">
                                        LKR {(totalAccumulatedDep / 1000000).toFixed(2)}M
                                    </p>
                                    <p className="text-xs text-red-600 mt-1">
                                        {((totalAccumulatedDep / totalAcquisitionCost) * 100).toFixed(1)}% of acquisition cost
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}