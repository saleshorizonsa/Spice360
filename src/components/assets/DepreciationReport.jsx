import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, TrendingDown, Package2, Calendar } from "lucide-react";

export default function DepreciationReport({ assets, depreciation, period }) {
    const totalAcquisitionCost = assets.reduce((sum, a) => sum + (a.acquisition_cost || 0), 0);
    const totalAccumulatedDep = assets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
    const totalNBV = assets.reduce((sum, a) => sum + (a.net_book_value || 0), 0);
    
    const periodDepreciation = period 
        ? depreciation.filter(d => d.fiscal_year === period.year && d.period === period.month)
        : depreciation;
    
    const totalPeriodDep = periodDepreciation.reduce((sum, d) => sum + (d.depreciation_amount || 0), 0);

    // Group by asset class
    const byClass = assets.reduce((acc, asset) => {
        const cls = asset.asset_class;
        if (!acc[cls]) {
            acc[cls] = {
                count: 0,
                acquisition_cost: 0,
                accumulated_depreciation: 0,
                nbv: 0
            };
        }
        acc[cls].count++;
        acc[cls].acquisition_cost += asset.acquisition_cost || 0;
        acc[cls].accumulated_depreciation += asset.accumulated_depreciation || 0;
        acc[cls].nbv += asset.net_book_value || 0;
        return acc;
    }, {});

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Depreciation Report ${period ? `- ${period.year}-${period.month}` : ''}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
                    h2 { color: #047857; margin-top: 30px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
                    .summary-grid {
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
                <h1>Fixed Assets Depreciation Report</h1>
                <p style="color: #6b7280; margin: 10px 0;">
                    ${period ? `Period: ${period.year}-${period.month}` : 'All Periods'} | 
                    Generated: ${new Date().toLocaleString()}
                </p>

                <div class="summary-grid">
                    <div class="kpi-card">
                        <div class="kpi-value">${assets.length}</div>
                        <div class="kpi-label">Total Assets</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">LKR ${(totalAcquisitionCost / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Acquisition Cost</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">LKR ${(totalAccumulatedDep / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Accumulated Depreciation</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">LKR ${(totalNBV / 1000000).toFixed(1)}M</div>
                        <div class="kpi-label">Net Book Value</div>
                    </div>
                </div>

                ${period ? `
                    <h2>Period Depreciation Summary</h2>
                    <div class="kpi-card" style="max-width: 300px; margin: 15px 0;">
                        <div class="kpi-value">LKR ${totalPeriodDep.toLocaleString()}</div>
                        <div class="kpi-label">Total Depreciation for ${period.year}-${period.month}</div>
                    </div>
                ` : ''}

                <h2>Depreciation by Asset Class</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Asset Class</th>
                            <th>Count</th>
                            <th>Acquisition Cost (LKR)</th>
                            <th>Accumulated Dep. (LKR)</th>
                            <th>NBV (LKR)</th>
                            <th>Dep. %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(byClass).map(([cls, data]) => {
                            const depPercent = data.acquisition_cost > 0 
                                ? (data.accumulated_depreciation / data.acquisition_cost * 100).toFixed(1)
                                : 0;
                            return `
                                <tr>
                                    <td style="text-align: left; text-transform: capitalize;">${cls}</td>
                                    <td style="text-align: center;">${data.count}</td>
                                    <td>${data.acquisition_cost.toLocaleString()}</td>
                                    <td>${data.accumulated_depreciation.toLocaleString()}</td>
                                    <td>${data.nbv.toLocaleString()}</td>
                                    <td style="text-align: center;">${depPercent}%</td>
                                </tr>
                            `;
                        }).join('')}
                        <tr class="total-row">
                            <td style="text-align: left;">TOTAL</td>
                            <td style="text-align: center;">${assets.length}</td>
                            <td>${totalAcquisitionCost.toLocaleString()}</td>
                            <td>${totalAccumulatedDep.toLocaleString()}</td>
                            <td>${totalNBV.toLocaleString()}</td>
                            <td style="text-align: center;">${((totalAccumulatedDep / totalAcquisitionCost) * 100).toFixed(1)}%</td>
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
                            <th>Life (Yrs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assets.map(asset => `
                            <tr>
                                <td style="text-align: left;">${asset.asset_number}</td>
                                <td style="text-align: left;">${asset.asset_name}</td>
                                <td style="text-align: center; text-transform: capitalize;">${asset.asset_class}</td>
                                <td style="text-align: center; text-transform: capitalize;">${asset.depreciation_method.replace('_', ' ')}</td>
                                <td>${asset.acquisition_cost.toLocaleString()}</td>
                                <td>${(asset.accumulated_depreciation || 0).toLocaleString()}</td>
                                <td>${asset.net_book_value.toLocaleString()}</td>
                                <td style="text-align: center;">${asset.useful_life_years}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #d1d5db; text-align: center; color: #6b7280; font-size: 11px;">
                    <p>Fixed Assets Depreciation Report | Company Asset Management System</p>
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

    const handleDownload = () => {
        const data = assets.map(a => ({
            'Asset Number': a.asset_number,
            'Asset Name': a.asset_name,
            'Asset Class': a.asset_class,
            'Acquisition Date': a.acquisition_date,
            'Acquisition Cost': a.acquisition_cost,
            'Useful Life (Years)': a.useful_life_years,
            'Depreciation Method': a.depreciation_method,
            'Salvage Value': a.salvage_value || 0,
            'Accumulated Depreciation': a.accumulated_depreciation || 0,
            'Net Book Value': a.net_book_value,
            'Location': a.location_code,
            'Status': a.status
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

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-emerald-600" />
                            Depreciation Report
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            {period ? `Period: ${period.year}-${period.month}` : 'All Assets'} | 
                            Generated: {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <Package2 className="w-5 h-5 text-gray-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
                        <p className="text-xs text-gray-600">Total Assets</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <TrendingDown className="w-5 h-5 text-blue-600 mb-2" />
                        <p className="text-2xl font-bold text-blue-900">
                            LKR {(totalAcquisitionCost / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-blue-600">Acquisition Cost</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <TrendingDown className="w-5 h-5 text-red-600 mb-2" />
                        <p className="text-2xl font-bold text-red-900">
                            LKR {(totalAccumulatedDep / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-red-600">Accumulated Depreciation</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                        <TrendingDown className="w-5 h-5 text-emerald-600 mb-2" />
                        <p className="text-2xl font-bold text-emerald-900">
                            LKR {(totalNBV / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-emerald-600">Net Book Value</p>
                    </div>
                </div>

                {period && (
                    <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-6 h-6 text-indigo-600" />
                                <div>
                                    <p className="text-sm text-indigo-700 font-medium">
                                        Period Depreciation
                                    </p>
                                    <p className="text-xs text-indigo-600">
                                        {period.year} - Period {period.month}
                                    </p>
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-indigo-900">
                                LKR {totalPeriodDep.toLocaleString()}
                            </p>
                        </div>
                    </div>
                )}

                {/* By Asset Class */}
                <div>
                    <h3 className="font-semibold text-lg mb-3">Depreciation by Asset Class</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border p-2 text-left">Asset Class</th>
                                    <th className="border p-2 text-center">Count</th>
                                    <th className="border p-2 text-right">Acq. Cost (LKR)</th>
                                    <th className="border p-2 text-right">Accum. Dep. (LKR)</th>
                                    <th className="border p-2 text-right">NBV (LKR)</th>
                                    <th className="border p-2 text-center">Dep. %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(byClass).map(([cls, data]) => {
                                    const depPercent = data.acquisition_cost > 0 
                                        ? ((data.accumulated_depreciation / data.acquisition_cost) * 100).toFixed(1)
                                        : 0;
                                    return (
                                        <tr key={cls} className="hover:bg-gray-50">
                                            <td className="border p-2 capitalize font-medium">{cls}</td>
                                            <td className="border p-2 text-center">{data.count}</td>
                                            <td className="border p-2 text-right">
                                                {data.acquisition_cost.toLocaleString()}
                                            </td>
                                            <td className="border p-2 text-right">
                                                {data.accumulated_depreciation.toLocaleString()}
                                            </td>
                                            <td className="border p-2 text-right font-semibold text-emerald-700">
                                                {data.nbv.toLocaleString()}
                                            </td>
                                            <td className="border p-2 text-center">
                                                <Badge variant="outline">{depPercent}%</Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-emerald-50 font-bold">
                                    <td className="border p-2">TOTAL</td>
                                    <td className="border p-2 text-center">{assets.length}</td>
                                    <td className="border p-2 text-right">
                                        {totalAcquisitionCost.toLocaleString()}
                                    </td>
                                    <td className="border p-2 text-right">
                                        {totalAccumulatedDep.toLocaleString()}
                                    </td>
                                    <td className="border p-2 text-right text-emerald-700">
                                        {totalNBV.toLocaleString()}
                                    </td>
                                    <td className="border p-2 text-center">
                                        {((totalAccumulatedDep / totalAcquisitionCost) * 100).toFixed(1)}%
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Asset Details */}
                <div>
                    <h3 className="font-semibold text-lg mb-3">Asset Details</h3>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full border-collapse text-xs">
                            <thead className="sticky top-0 bg-gray-50">
                                <tr>
                                    <th className="border p-2 text-left">Asset #</th>
                                    <th className="border p-2 text-left">Asset Name</th>
                                    <th className="border p-2">Class</th>
                                    <th className="border p-2">Method</th>
                                    <th className="border p-2 text-right">Acq. Cost</th>
                                    <th className="border p-2 text-right">Accum. Dep.</th>
                                    <th className="border p-2 text-right">NBV</th>
                                    <th className="border p-2">Life</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="border p-2">{asset.asset_number}</td>
                                        <td className="border p-2">{asset.asset_name}</td>
                                        <td className="border p-2 text-center capitalize">{asset.asset_class}</td>
                                        <td className="border p-2 text-center capitalize text-xs">
                                            {asset.depreciation_method.replace('_', ' ')}
                                        </td>
                                        <td className="border p-2 text-right">
                                            {asset.acquisition_cost.toLocaleString()}
                                        </td>
                                        <td className="border p-2 text-right">
                                            {(asset.accumulated_depreciation || 0).toLocaleString()}
                                        </td>
                                        <td className="border p-2 text-right font-semibold">
                                            {asset.net_book_value.toLocaleString()}
                                        </td>
                                        <td className="border p-2 text-center">{asset.useful_life_years}y</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}