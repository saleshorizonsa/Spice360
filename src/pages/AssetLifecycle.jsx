import React, { useState, useMemo } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    TrendingDown, 
    TrendingUp,
    Download, 
    Printer,
    Package2,
    Calendar,
    DollarSign,
    Wrench,
    BarChart3,
    PieChart as PieChartIcon
} from "lucide-react";
import DataTable from "../components/erp/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "../components/utils/languageContext";
import { 
    BarChart, 
    Bar, 
    PieChart, 
    Pie, 
    Cell,
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    ScatterChart,
    Scatter
} from 'recharts';

export default function AssetLifecycle() {
    const { t } = useLanguage();
    const [filters, setFilters] = useState({
        assetClass: 'all',
        disposalType: 'all',
        dateFrom: '',
        dateTo: '',
        yearFrom: new Date().getFullYear() - 5,
        yearTo: new Date().getFullYear()
    });

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: assets = [] } = useQuery({
        queryKey: ['assets'],
        queryFn: () => matrixSales.entities.FixedAsset.list(),
        initialData: []
    });

    const { data: disposals = [] } = useQuery({
        queryKey: ['disposals'],
        queryFn: () => matrixSales.entities.AssetDisposal.list('-disposal_date'),
        initialData: []
    });

    const { data: maintenance = [] } = useQuery({
        queryKey: ['maintenance'],
        queryFn: () => matrixSales.entities.AssetMaintenance.list(),
        initialData: []
    });

    // Filter disposals
    const filteredDisposals = useMemo(() => {
        return disposals.filter(d => {
            if (filters.assetClass !== 'all') {
                const asset = assets.find(a => a.asset_number === d.asset_number);
                if (!asset || asset.asset_class !== filters.assetClass) return false;
            }
            if (filters.disposalType !== 'all' && d.disposal_type !== filters.disposalType) return false;
            if (filters.dateFrom && d.disposal_date < filters.dateFrom) return false;
            if (filters.dateTo && d.disposal_date > filters.dateTo) return false;
            return true;
        });
    }, [disposals, assets, filters]);

    // Calculate KPIs
    const activeAssets = assets.filter(a => a.status === 'active').length;
    const disposedAssets = disposals.length;
    const totalDisposalValue = filteredDisposals.reduce((sum, d) => sum + (d.disposal_value || 0), 0);
    const totalGainLoss = filteredDisposals.reduce((sum, d) => sum + (d.gain_loss || 0), 0);
    const avgROI = filteredDisposals.length > 0 
        ? (filteredDisposals.reduce((sum, d) => sum + (d.roi_percentage || 0), 0) / filteredDisposals.length).toFixed(1)
        : 0;
    const pendingDisposals = disposals.filter(d => d.status === 'pending_approval').length;

    // Disposal by type
    const disposalByType = useMemo(() => {
        const grouped = filteredDisposals.reduce((acc, d) => {
            const type = d.disposal_type;
            if (!acc[type]) {
                acc[type] = {
                    name: type.replace('_', ' ').toUpperCase(),
                    count: 0,
                    value: 0,
                    gainLoss: 0
                };
            }
            acc[type].count += 1;
            acc[type].value += d.disposal_value || 0;
            acc[type].gainLoss += d.gain_loss || 0;
            return acc;
        }, {});
        return Object.values(grouped);
    }, [filteredDisposals]);

    // Disposal by year
    const disposalByYear = useMemo(() => {
        const grouped = filteredDisposals.reduce((acc, d) => {
            const year = new Date(d.disposal_date).getFullYear();
            if (year < filters.yearFrom || year > filters.yearTo) return acc;
            
            if (!acc[year]) {
                acc[year] = {
                    year: year.toString(),
                    count: 0,
                    disposalValue: 0,
                    gainLoss: 0,
                    nbv: 0
                };
            }
            acc[year].count += 1;
            acc[year].disposalValue += d.disposal_value || 0;
            acc[year].gainLoss += d.gain_loss || 0;
            acc[year].nbv += d.net_book_value || 0;
            return acc;
        }, {});
        return Object.values(grouped).sort((a, b) => a.year.localeCompare(b.year));
    }, [filteredDisposals, filters.yearFrom, filters.yearTo]);

    // Asset lifecycle analysis (age vs maintenance cost)
    const lifecycleAnalysis = useMemo(() => {
        return assets.filter(a => a.status === 'active').map(asset => {
            const assetMaintenance = maintenance.filter(m => m.asset_number === asset.asset_number);
            const maintenanceCost = assetMaintenance.reduce((sum, m) => sum + (m.total_cost || 0), 0);
            const acquisitionDate = new Date(asset.acquisition_date);
            const ageYears = ((new Date() - acquisitionDate) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
            
            return {
                asset_number: asset.asset_number,
                name: asset.asset_name,
                age: parseFloat(ageYears),
                maintenanceCost: maintenanceCost,
                nbv: asset.net_book_value,
                class: asset.asset_class
            };
        });
    }, [assets, maintenance]);

    // Disposal ROI distribution
    const roiDistribution = useMemo(() => {
        const ranges = {
            'High Loss (< -20%)': 0,
            'Loss (-20% to 0%)': 0,
            'Break Even (0% to 10%)': 0,
            'Good (10% to 30%)': 0,
            'Excellent (> 30%)': 0
        };

        filteredDisposals.forEach(d => {
            const roi = d.roi_percentage || 0;
            if (roi < -20) ranges['High Loss (< -20%)']++;
            else if (roi < 0) ranges['Loss (-20% to 0%)']++;
            else if (roi < 10) ranges['Break Even (0% to 10%)']++;
            else if (roi < 30) ranges['Good (10% to 30%)']++;
            else ranges['Excellent (> 30%)']++;
        });

        return Object.entries(ranges).map(([name, value]) => ({ name, value }));
    }, [filteredDisposals]);

    const COLORS = ['#dc2626', '#f59e0b', '#3b82f6', '#059669', '#10b981'];

    const disposalColumns = [
        { header: "Disposal ID", key: "disposal_id" },
        { header: "Asset #", key: "asset_number" },
        { header: "Asset Name", key: "asset_name" },
        { header: "Type", key: "disposal_type", isBadge: true },
        { header: "Date", key: "disposal_date" },
        { header: "NBV (SAR)", key: "net_book_value", render: (val) => val?.toLocaleString() },
        { header: "Disposal Value (SAR)", key: "disposal_value", render: (val) => val?.toLocaleString() },
        { 
            header: "Gain/Loss (SAR)", 
            key: "gain_loss", 
            render: (val) => (
                <span className={val >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                    {val >= 0 ? '+' : ''}{val?.toLocaleString()}
                </span>
            )
        },
        { 
            header: "ROI %", 
            key: "roi_percentage", 
            render: (val) => (
                <span className={val >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                    {val >= 0 ? '+' : ''}{val?.toFixed(1)}%
                </span>
            )
        },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (value) => {
        const colors = {
            sale: "bg-blue-100 text-blue-800",
            scrap: "bg-gray-100 text-gray-800",
            donation: "bg-purple-100 text-purple-800",
            trade_in: "bg-indigo-100 text-indigo-800",
            write_off: "bg-red-100 text-red-800",
            transfer: "bg-green-100 text-green-800",
            pending_approval: "bg-yellow-100 text-yellow-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            completed: "bg-emerald-100 text-emerald-800",
            cancelled: "bg-gray-100 text-gray-800"
        };
        return colors[value] || "bg-gray-100 text-gray-800";
    };

    const handleExportCSV = () => {
        const data = filteredDisposals.map(d => ({
            'Disposal ID': d.disposal_id,
            'Asset Number': d.asset_number,
            'Asset Name': d.asset_name,
            'Disposal Type': d.disposal_type,
            'Disposal Date': d.disposal_date,
            'Original Cost': d.original_acquisition_cost,
            'Accumulated Depreciation': d.accumulated_depreciation,
            'Net Book Value': d.net_book_value,
            'Disposal Value': d.disposal_value,
            'Gain/Loss': d.gain_loss,
            'ROI %': d.roi_percentage?.toFixed(2),
            'Maintenance Cost': d.total_maintenance_cost,
            'Months in Use': d.useful_life_months_utilized,
            'Buyer': d.buyer_name || '',
            'Condition': d.condition_at_disposal,
            'Reason': d.reason_for_disposal,
            'Status': d.status
        }));

        const csv = [
            Object.keys(data[0]).join(','),
            ...data.map(row => Object.values(row).map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asset-lifecycle-report-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Asset Lifecycle & Disposal Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
                    h2 { color: #047857; margin-top: 30px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
                    .kpi-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
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
                    .gain { color: #059669; font-weight: bold; }
                    .loss { color: #dc2626; font-weight: bold; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <h1>Asset Lifecycle & Disposal Analysis Report</h1>
                <p style="color: #6b7280;">Generated: ${new Date().toLocaleString()}</p>

                <h2>Summary Statistics</h2>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${disposedAssets}</div>
                        <div class="kpi-label">Assets Disposed</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">SAR ${(totalDisposalValue / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Disposal Value</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value ${totalGainLoss >= 0 ? 'gain' : 'loss'}">
                            SAR ${(totalGainLoss / 1000).toFixed(0)}K
                        </div>
                        <div class="kpi-label">Total Gain/Loss</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${avgROI}%</div>
                        <div class="kpi-label">Average ROI</div>
                    </div>
                </div>

                <h2>Disposal Transactions</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Disposal ID</th>
                            <th style="text-align: left;">Asset</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>NBV</th>
                            <th>Disposal Value</th>
                            <th>Gain/Loss</th>
                            <th>ROI %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredDisposals.map(d => `
                            <tr>
                                <td style="text-align: left;">${d.disposal_id}</td>
                                <td style="text-align: left;">${d.asset_name}</td>
                                <td>${d.disposal_date}</td>
                                <td style="text-align: center; text-transform: capitalize;">${d.disposal_type.replace('_', ' ')}</td>
                                <td>SAR ${d.net_book_value.toLocaleString()}</td>
                                <td>SAR ${d.disposal_value.toLocaleString()}</td>
                                <td class="${d.gain_loss >= 0 ? 'gain' : 'loss'}">
                                    ${d.gain_loss >= 0 ? '+' : ''}SAR ${d.gain_loss.toLocaleString()}
                                </td>
                                <td style="text-align: center;" class="${d.roi_percentage >= 0 ? 'gain' : 'loss'}">
                                    ${d.roi_percentage?.toFixed(1)}%
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #d1d5db; text-align: center; color: #6b7280; font-size: 11px;">
                    <p>Asset Lifecycle & Disposal Report | Company Asset Management System</p>
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
            disposalType: 'all',
            dateFrom: '',
            dateTo: '',
            yearFrom: new Date().getFullYear() - 5,
            yearTo: new Date().getFullYear()
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('assetLifecycleMgmt')}</h1>
                    <p className="text-gray-600 mt-1">{t('trackAssetDisposalDesc')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('exportCSV')}
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" />
                        {t('printReport')}
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Filters</CardTitle>
                        <Button variant="outline" size="sm" onClick={resetFilters}>
                            Reset
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
                                    <SelectItem value="machinery">Machinery</SelectItem>
                                    <SelectItem value="equipment">Equipment</SelectItem>
                                    <SelectItem value="vehicles">Vehicles</SelectItem>
                                    <SelectItem value="computers">Computers</SelectItem>
                                    <SelectItem value="furniture">Furniture</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Disposal Type</Label>
                            <Select 
                                value={filters.disposalType} 
                                onValueChange={(val) => setFilters({...filters, disposalType: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="sale">Sale</SelectItem>
                                    <SelectItem value="scrap">Scrap</SelectItem>
                                    <SelectItem value="donation">Donation</SelectItem>
                                    <SelectItem value="trade_in">Trade-In</SelectItem>
                                    <SelectItem value="write_off">Write-Off</SelectItem>
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

                        <div>
                            <Label>Year From</Label>
                            <Input
                                type="number"
                                value={filters.yearFrom}
                                onChange={(e) => setFilters({...filters, yearFrom: parseInt(e.target.value)})}
                            />
                        </div>

                        <div>
                            <Label>Year To</Label>
                            <Input
                                type="number"
                                value={filters.yearTo}
                                onChange={(e) => setFilters({...filters, yearTo: parseInt(e.target.value)})}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs */}

            {/* Charts */}
            <Tabs defaultValue="by-type" className="space-y-4">
                <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="by-type">By Type</TabsTrigger>
                    <TabsTrigger value="by-year">By Year</TabsTrigger>
                    <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
                    <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>

                <TabsContent value="by-type">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChartIcon className="w-5 h-5 text-emerald-600" />
                                Disposal by Type
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={disposalByType}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="count"
                                        >
                                            {disposalByType.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="space-y-3">
                                    <h4 className="font-semibold">Breakdown</h4>
                                    {disposalByType.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-4 h-4 rounded"
                                                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                                />
                                                <span className="font-medium">{item.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">{item.count} assets</p>
                                                <p className="text-sm text-gray-600">
                                                    SAR {(item.value / 1000).toFixed(0)}K
                                                </p>
                                                <p className={`text-xs font-semibold ${item.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {item.gainLoss >= 0 ? '+' : ''}SAR {(item.gainLoss / 1000).toFixed(0)}K
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="by-year">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                                Disposal Trend by Year
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={disposalByYear}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" />
                                    <YAxis yAxisId="left" orientation="left" />
                                    <YAxis yAxisId="right" orientation="right" />
                                    <Tooltip formatter={(value) => value.toLocaleString()} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Asset Count" />
                                    <Bar yAxisId="right" dataKey="disposalValue" fill="#059669" name="Disposal Value (SAR)" />
                                    <Bar yAxisId="right" dataKey="gainLoss" fill="#f59e0b" name="Gain/Loss (SAR)" />
                                </BarChart>
                            </ResponsiveContainer>

                            <div className="mt-6 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-2 text-center">Year</th>
                                            <th className="p-2 text-center">Count</th>
                                            <th className="p-2 text-right">NBV (SAR)</th>
                                            <th className="p-2 text-right">Disposal Value (SAR)</th>
                                            <th className="p-2 text-right">Gain/Loss (SAR)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {disposalByYear.map((year, idx) => (
                                            <tr key={idx} className="border-t hover:bg-gray-50">
                                                <td className="p-2 text-center font-semibold">{year.year}</td>
                                                <td className="p-2 text-center">{year.count}</td>
                                                <td className="p-2 text-right">{year.nbv.toLocaleString()}</td>
                                                <td className="p-2 text-right">{year.disposalValue.toLocaleString()}</td>
                                                <td className={`p-2 text-right font-semibold ${year.gainLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {year.gainLoss >= 0 ? '+' : ''}{year.gainLoss.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="roi">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                ROI Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={roiDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, value }) => value > 0 ? `${name.split(' ')[0]}: ${value}` : null}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {roiDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="space-y-2">
                                    <h4 className="font-semibold mb-3">ROI Categories</h4>
                                    {roiDistribution.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded"
                                                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                                />
                                                <span className="text-sm">{item.name}</span>
                                            </div>
                                            <Badge variant="outline">{item.value} assets</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <Card className={totalGainLoss >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                                    <CardContent className="pt-4">
                                        <p className="text-sm text-gray-700">Total Gain/Loss</p>
                                        <p className={`text-3xl font-bold ${totalGainLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            {totalGainLoss >= 0 ? '+' : ''}SAR {totalGainLoss.toLocaleString()}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-purple-50 border-purple-200">
                                    <CardContent className="pt-4">
                                        <p className="text-sm text-purple-700">Average ROI</p>
                                        <p className="text-3xl font-bold text-purple-900">{avgROI}%</p>
                                        <p className="text-xs text-purple-600">{filteredDisposals.length} disposals</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="lifecycle">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-emerald-600" />
                                Asset Age vs Maintenance Cost
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        type="number" 
                                        dataKey="age" 
                                        name="Age (Years)" 
                                        label={{ value: 'Age (Years)', position: 'insideBottom', offset: -5 }}
                                    />
                                    <YAxis 
                                        type="number" 
                                        dataKey="maintenanceCost" 
                                        name="Maintenance Cost" 
                                        label={{ value: 'Maintenance Cost (SAR)', angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip 
                                        cursor={{ strokeDasharray: '3 3' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 border rounded shadow-lg">
                                                        <p className="font-semibold">{data.name}</p>
                                                        <p className="text-sm">Age: {data.age} years</p>
                                                        <p className="text-sm">Maintenance: SAR {data.maintenanceCost.toLocaleString()}</p>
                                                        <p className="text-sm">NBV: SAR {data.nbv.toLocaleString()}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Scatter name="Assets" data={lifecycleAnalysis} fill="#059669" />
                                </ScatterChart>
                            </ResponsiveContainer>

                            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-blue-900 mb-2">Insights</h4>
                                <ul className="text-sm text-blue-800 space-y-1">
                                    <li>• Assets older than 7 years typically show higher maintenance costs</li>
                                    <li>• Consider disposal when maintenance cost exceeds 20% of NBV annually</li>
                                    <li>• Avg maintenance per active asset: SAR {activeAssets > 0 ? (
                                        lifecycleAnalysis.reduce((sum, a) => sum + a.maintenanceCost, 0) / activeAssets
                                    ).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="details">
                    <Card>
                        <CardHeader>
                            <CardTitle>Disposal Transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={filteredDisposals}
                                columns={disposalColumns}
                                searchFields={["disposal_id", "asset_number", "asset_name", "buyer_name"]}
                                getBadgeColor={getBadgeColor}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}