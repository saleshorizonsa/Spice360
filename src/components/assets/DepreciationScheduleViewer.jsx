import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Printer, Calendar } from "lucide-react";
import { generateDepreciationSchedule } from "../utils/depreciationCalculator";

export default function DepreciationScheduleViewer({ asset, onClose }) {
    const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'annual'
    
    const schedule = generateDepreciationSchedule(
        asset.asset_number,
        asset.asset_name,
        asset.acquisition_date,
        asset.acquisition_cost,
        asset.salvage_value || 0,
        asset.useful_life_years,
        asset.depreciation_method
    );

    // Group by year for annual view
    const annualSchedule = schedule.reduce((acc, entry) => {
        const year = entry.fiscal_year;
        if (!acc[year]) {
            acc[year] = {
                fiscal_year: year,
                total_depreciation: 0,
                ending_accumulated: 0,
                ending_nbv: 0
            };
        }
        acc[year].total_depreciation += entry.depreciation_amount;
        acc[year].ending_accumulated = entry.accumulated_depreciation;
        acc[year].ending_nbv = entry.net_book_value;
        return acc;
    }, {});

    const annualData = Object.values(annualSchedule);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Depreciation Schedule - ${asset.asset_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
                    h2 { color: #047857; margin-top: 30px; }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin: 20px 0;
                        padding: 20px;
                        background: #f3f4f6;
                        border-radius: 8px;
                    }
                    .info-item { margin: 5px 0; }
                    .label { font-weight: bold; color: #6b7280; }
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
                        text-align: center;
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
                <h1>Depreciation Schedule</h1>
                
                <div class="info-grid">
                    <div>
                        <div class="info-item">
                            <span class="label">Asset Number:</span> ${asset.asset_number}
                        </div>
                        <div class="info-item">
                            <span class="label">Asset Name:</span> ${asset.asset_name}
                        </div>
                        <div class="info-item">
                            <span class="label">Asset Class:</span> ${asset.asset_class}
                        </div>
                        <div class="info-item">
                            <span class="label">Acquisition Date:</span> ${asset.acquisition_date}
                        </div>
                    </div>
                    <div>
                        <div class="info-item">
                            <span class="label">Acquisition Cost:</span> LKR ${asset.acquisition_cost.toLocaleString()}
                        </div>
                        <div class="info-item">
                            <span class="label">Salvage Value:</span> LKR ${(asset.salvage_value || 0).toLocaleString()}
                        </div>
                        <div class="info-item">
                            <span class="label">Useful Life:</span> ${asset.useful_life_years} years
                        </div>
                        <div class="info-item">
                            <span class="label">Method:</span> ${asset.depreciation_method.replace('_', ' ').toUpperCase()}
                        </div>
                    </div>
                </div>

                <h2>Annual Depreciation Schedule</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Year</th>
                            <th>Depreciation (LKR)</th>
                            <th>Accumulated Dep. (LKR)</th>
                            <th>Net Book Value (LKR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${annualData.map(year => `
                            <tr>
                                <td style="text-align: center;">${year.fiscal_year}</td>
                                <td>${year.total_depreciation.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td>${year.ending_accumulated.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td>${year.ending_nbv.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td style="text-align: center;">TOTAL</td>
                            <td>${(asset.acquisition_cost - (asset.salvage_value || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td>${(asset.acquisition_cost - (asset.salvage_value || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td>${(asset.salvage_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #d1d5db; text-align: center; color: #6b7280; font-size: 11px;">
                    <p>Depreciation Schedule | Generated on ${new Date().toLocaleString()}</p>
                    <p>Company Fixed Asset Management System</p>
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

    const handleDownloadCSV = () => {
        const data = viewMode === 'monthly' ? schedule : annualData;
        
        const headers = viewMode === 'monthly' 
            ? ['Year', 'Period', 'Date', 'Depreciation (LKR)', 'Accumulated (LKR)', 'NBV (LKR)']
            : ['Year', 'Total Depreciation (LKR)', 'Accumulated (LKR)', 'Ending NBV (LKR)'];
        
        const rows = viewMode === 'monthly'
            ? schedule.map(s => [
                s.fiscal_year,
                s.period,
                s.depreciation_date,
                s.depreciation_amount.toFixed(2),
                s.accumulated_depreciation.toFixed(2),
                s.net_book_value.toFixed(2)
              ])
            : annualData.map(y => [
                y.fiscal_year,
                y.total_depreciation.toFixed(2),
                y.ending_accumulated.toFixed(2),
                y.ending_nbv.toFixed(2)
              ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depreciation-schedule-${asset.asset_number}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                                Depreciation Schedule
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                {asset.asset_number} - {asset.asset_name}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                                <Download className="w-4 h-4 mr-2" />
                                CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={handlePrint}>
                                <Printer className="w-4 h-4 mr-2" />
                                Print
                            </Button>
                            {onClose && (
                                <Button variant="outline" size="sm" onClick={onClose}>
                                    Close
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Asset Summary */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                            <p className="text-xs text-gray-600">Acquisition Cost</p>
                            <p className="text-lg font-bold">LKR {asset.acquisition_cost.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded">
                            <p className="text-xs text-blue-700">Depreciable Amount</p>
                            <p className="text-lg font-bold text-blue-900">
                                LKR {(asset.acquisition_cost - (asset.salvage_value || 0)).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded">
                            <p className="text-xs text-emerald-700">Current NBV</p>
                            <p className="text-lg font-bold text-emerald-900">
                                LKR {asset.net_book_value.toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                            <p className="text-xs text-purple-700">Method</p>
                            <p className="text-sm font-bold text-purple-900 capitalize">
                                {asset.depreciation_method.replace('_', ' ')}
                            </p>
                        </div>
                    </div>

                    {/* View Mode Tabs */}
                    <Tabs value={viewMode} onValueChange={setViewMode}>
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="annual">Annual View</TabsTrigger>
                            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
                        </TabsList>

                        <TabsContent value="annual" className="mt-4">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="border p-2 text-center">Year</th>
                                            <th className="border p-2 text-right">Depreciation (LKR)</th>
                                            <th className="border p-2 text-right">Accumulated (LKR)</th>
                                            <th className="border p-2 text-right">NBV (LKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {annualData.map((year, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border p-2 text-center font-semibold">
                                                    {year.fiscal_year}
                                                </td>
                                                <td className="border p-2 text-right">
                                                    {year.total_depreciation.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </td>
                                                <td className="border p-2 text-right">
                                                    {year.ending_accumulated.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </td>
                                                <td className="border p-2 text-right font-semibold text-emerald-700">
                                                    {year.ending_nbv.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-emerald-50 font-bold">
                                            <td className="border p-2 text-center">TOTAL</td>
                                            <td className="border p-2 text-right">
                                                {(asset.acquisition_cost - (asset.salvage_value || 0)).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </td>
                                            <td className="border p-2 text-right">
                                                {(asset.acquisition_cost - (asset.salvage_value || 0)).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </td>
                                            <td className="border p-2 text-right">
                                                {(asset.salvage_value || 0).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        <TabsContent value="monthly" className="mt-4">
                            <div className="overflow-x-auto max-h-96">
                                <table className="w-full border-collapse text-xs">
                                    <thead className="sticky top-0 bg-gray-50">
                                        <tr>
                                            <th className="border p-2">Year</th>
                                            <th className="border p-2">Period</th>
                                            <th className="border p-2">Date</th>
                                            <th className="border p-2 text-right">Depreciation</th>
                                            <th className="border p-2 text-right">Accumulated</th>
                                            <th className="border p-2 text-right">NBV</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schedule.map((entry, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border p-2 text-center">{entry.fiscal_year}</td>
                                                <td className="border p-2 text-center">{entry.period}</td>
                                                <td className="border p-2 text-center">{entry.depreciation_date}</td>
                                                <td className="border p-2 text-right">
                                                    {entry.depreciation_amount.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </td>
                                                <td className="border p-2 text-right">
                                                    {entry.accumulated_depreciation.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </td>
                                                <td className="border p-2 text-right font-semibold">
                                                    {entry.net_book_value.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}